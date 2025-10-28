import { serve } from "bun";
import index from "./index.html";
import runningCalc from "./running-calc.html";
import youtubeTranscript from "./youtube-transcript.html";
import { Innertube } from "youtubei.js";

// Rate limiter: track IP addresses and their request timestamps
interface RateLimitEntry {
  count: number;
  firstRequest: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds
const RATE_LIMIT_MAX_REQUESTS = 10;

// Clean up old entries every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap.entries()) {
    if (now - entry.firstRequest > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}, 10 * 60 * 1000);

// Rate limiter function
function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW };
  }

  // Check if the window has expired
  if (now - entry.firstRequest > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { count: 1, firstRequest: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW };
  }

  // Check if limit exceeded
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = RATE_LIMIT_WINDOW - (now - entry.firstRequest);
    return { allowed: false, remaining: 0, resetIn };
  }

  // Increment count
  entry.count++;
  rateLimitMap.set(ip, entry);
  return {
    allowed: true,
    remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
    resetIn: RATE_LIMIT_WINDOW - (now - entry.firstRequest)
  };
}

// Validate YouTube Video ID
function isValidVideoId(videoId: string): boolean {
  // YouTube video IDs are 11 characters long and contain only alphanumeric, underscore, and hyphen
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

// Logger function
function logRequest(ip: string, videoId: string, status: number, message: string) {
  const timestamp = new Date().toISOString();
  console.log(JSON.stringify({
    timestamp,
    ip,
    videoId,
    status,
    message,
    endpoint: "/api/transcript"
  }));
}

const server = serve({
  routes: {
    // API endpoint for fetching YouTube transcripts
    "/api/transcript/:videoId": {
      async GET(req) {
        const videoId = req.params.videoId;
        // Get IP address: prefer X-Forwarded-For (from proxy), fallback to direct connection IP
        const forwardedFor = req.headers.get("x-forwarded-for");
        const realIp = req.headers.get("x-real-ip");
        const remoteAddress = server.requestIP(req);
        const ip = forwardedFor?.split(',')[0].trim() || realIp || remoteAddress?.address || "127.0.0.1";

        // Validate Video ID
        if (!videoId) {
          logRequest(ip, "none", 400, "Video ID is required");
          return Response.json(
            { success: false, error: "Video ID is required" },
            { status: 400 }
          );
        }

        if (!isValidVideoId(videoId)) {
          logRequest(ip, videoId, 400, "Invalid Video ID format");
          return Response.json(
            { success: false, error: "Invalid Video ID format" },
            { status: 400 }
          );
        }

        // Check rate limit
        const rateLimit = checkRateLimit(ip);
        if (!rateLimit.allowed) {
          const resetInMinutes = Math.ceil(rateLimit.resetIn / 60000);
          logRequest(ip, videoId, 429, `Rate limit exceeded. Reset in ${resetInMinutes}m`);
          return Response.json(
            {
              success: false,
              error: `Rate limit exceeded. Try again in ${resetInMinutes} minutes.`,
              retryAfter: resetInMinutes
            },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": Math.ceil(rateLimit.resetIn / 1000).toString()
              }
            }
          );
        }

        try {
          const yt = await Innertube.create();
          const info = await yt.getInfo(videoId);
          const transcriptData = await info.getTranscript();

          if (!transcriptData?.transcript?.content?.body?.initial_segments) {
            logRequest(ip, videoId, 404, "No transcript available");
            return Response.json(
              { success: false, error: "No transcript available for this video" },
              {
                status: 404,
                headers: {
                  "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
                  "X-RateLimit-Remaining": rateLimit.remaining.toString(),
                  "X-RateLimit-Reset": Math.ceil(rateLimit.resetIn / 1000).toString()
                }
              }
            );
          }

          // Transform youtubei.js format to our expected format
          const transcript = transcriptData.transcript.content.body.initial_segments.map((segment: any) => ({
            text: segment.snippet.text,
            duration: parseInt(segment.end_ms) - parseInt(segment.start_ms),
            offset: parseInt(segment.start_ms),
          }));

          // Extract video metadata - handle Text objects by converting to strings
          const title = info.basic_info.title?.toString() || info.basic_info.title || "Unknown Title";
          const description = info.basic_info.short_description?.toString() || info.basic_info.short_description || "";

          // Debug logging for troubleshooting metadata issues
          if (title === "Unknown Title" || !description) {
            console.error("[DEBUG] Metadata extraction issue:", {
              videoId,
              titleType: typeof info.basic_info.title,
              titleValue: info.basic_info.title,
              descType: typeof info.basic_info.short_description,
              descValue: info.basic_info.short_description,
              availableKeys: Object.keys(info.basic_info)
            });
          }

          const metadata = {
            title,
            description,
            thumbnail: info.basic_info.thumbnail?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
          };

          logRequest(ip, videoId, 200, `Success: ${transcript.length} segments`);
          return Response.json(
            { success: true, transcript, metadata },
            {
              headers: {
                "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
                "X-RateLimit-Remaining": rateLimit.remaining.toString(),
                "X-RateLimit-Reset": Math.ceil(rateLimit.resetIn / 1000).toString()
              }
            }
          );
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          logRequest(ip, videoId, 400, `Error: ${errorMessage}`);
          return Response.json(
            { success: false, error: errorMessage },
            {
              status: 400,
              headers: {
                "X-RateLimit-Limit": RATE_LIMIT_MAX_REQUESTS.toString(),
                "X-RateLimit-Remaining": rateLimit.remaining.toString(),
                "X-RateLimit-Reset": Math.ceil(rateLimit.resetIn / 1000).toString()
              }
            }
          );
        }
      },
    },

    // Tool pages
    "/running-calc": runningCalc,
    "/youtube-transcript": youtubeTranscript,

    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
