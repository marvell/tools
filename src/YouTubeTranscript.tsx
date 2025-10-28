import "./index.css";
import { useState } from "react";

// Types
interface TranscriptSegment {
  text: string;
  duration: number;
  offset: number;
}

interface VideoMetadata {
  title: string;
  description: string;
  thumbnail: string;
}

// Utility function to extract video ID from various YouTube URL formats
const extractVideoId = (url: string): string | null => {
  if (!url.trim()) return null;

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\?\/]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
};

// Format timestamp from seconds to HH:MM:SS or MM:SS
const formatTimestamp = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
};

export function YouTubeTranscript() {
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [videoId, setVideoId] = useState("");
  const [metadata, setMetadata] = useState<VideoMetadata | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const fetchTranscript = async () => {
    setError("");
    setTranscript([]);
    setVideoId("");
    setMetadata(null);
    setIsDescriptionExpanded(false);

    const extractedId = extractVideoId(url);

    if (!extractedId) {
      setError("Invalid YouTube URL or video ID. Please try again.");
      return;
    }

    setVideoId(extractedId);
    setLoading(true);

    try {
      const response = await fetch(`/api/transcript/${extractedId}`);
      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to fetch transcript.");
        return;
      }

      setTranscript(data.transcript);
      setMetadata(data.metadata);
    } catch (err) {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTranscript();
  };

  const copyTranscript = () => {
    const text = transcript.map(segment => segment.text).join(" ");
    navigator.clipboard.writeText(text);
  };

  const copyTranscriptWithTimestamps = () => {
    const text = transcript
      .map(segment => `[${formatTimestamp(segment.offset / 1000)}] ${segment.text}`)
      .join("\n");
    navigator.clipboard.writeText(text);
  };

  const downloadTranscript = () => {
    const text = transcript.map(segment => segment.text).join(" ");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube-transcript-${videoId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTranscriptWithTimestamps = () => {
    const text = transcript
      .map(segment => `[${formatTimestamp(segment.offset / 1000)}] ${segment.text}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `youtube-transcript-${videoId}-timestamped.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const clear = () => {
    setUrl("");
    setTranscript([]);
    setError("");
    setVideoId("");
    setMetadata(null);
    setIsDescriptionExpanded(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl md:text-5xl font-bold text-foreground">
            YouTube Transcripts
          </h1>
          <p className="text-lg text-muted-foreground">
            Get transcripts from any YouTube video instantly
          </p>
        </div>

        {/* Input form */}
        <div className="bg-card border border-border rounded-lg p-6 md:p-8 shadow-sm space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-card-foreground">
                YouTube URL or Video ID
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="e.g., https://www.youtube.com/watch?v=dQw4w9WgXcQ or dQw4w9WgXcQ"
                className="w-full px-4 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                disabled={loading}
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading || !url.trim()}
                className="flex-1 px-4 py-2 border border-input rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Fetching..." : "Get Transcript"}
              </button>
              {transcript.length > 0 && (
                <button
                  type="button"
                  onClick={clear}
                  className="px-4 py-2 border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </form>

          {/* Error message */}
          {error && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Video metadata */}
          {metadata && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  <img
                    src={metadata.thumbnail}
                    alt={metadata.title}
                    className="w-full md:w-64 rounded-md object-cover"
                  />
                </div>

                {/* Title and Description */}
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold text-card-foreground">
                    {metadata.title}
                  </h3>
                  {metadata.description && (
                    <div className="space-y-2">
                      <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!isDescriptionExpanded ? "line-clamp-6" : ""}`}>
                        {metadata.description}
                      </p>
                      {metadata.description.length > 300 && (
                        <button
                          onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                          className="text-sm text-primary hover:underline"
                        >
                          {isDescriptionExpanded ? "Показать меньше" : "Показать больше"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Transcript display */}
          {transcript.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-card-foreground">
                  Transcript
                </h2>
                <div className="flex gap-2">
                  <button
                    onClick={copyTranscript}
                    className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Copy
                  </button>
                  <button
                    onClick={copyTranscriptWithTimestamps}
                    className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Copy with Timestamps
                  </button>
                  <button
                    onClick={downloadTranscript}
                    className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Download
                  </button>
                  <button
                    onClick={downloadTranscriptWithTimestamps}
                    className="px-3 py-1 text-sm border border-input rounded-md bg-background text-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    Download with Timestamps
                  </button>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto p-4 bg-muted/30 rounded-md border border-border space-y-2">
                {transcript.map((segment, index) => (
                  <div key={index} className="flex gap-3">
                    <span className="text-xs text-muted-foreground font-mono min-w-[60px]">
                      {formatTimestamp(segment.offset / 1000)}
                    </span>
                    <span className="text-sm text-foreground">{segment.text}</span>
                  </div>
                ))}
              </div>

              <div className="text-sm text-muted-foreground text-center">
                {transcript.length} segments • Video ID: {videoId}
              </div>
            </div>
          )}
        </div>

        {/* Help text */}
        <div className="text-center text-sm text-muted-foreground space-y-2">
          <p>
            Paste any YouTube video URL or video ID to retrieve the transcript.
          </p>
          <p>
            Supported formats: youtube.com/watch?v=..., youtu.be/..., or just the video ID
          </p>
        </div>

        {/* Back to home */}
        <div className="text-center">
          <a
            href="/"
            className="text-sm text-primary hover:underline"
          >
            ← Back to Marvell Tools
          </a>
        </div>
      </div>
    </div>
  );
}

export default YouTubeTranscript;
