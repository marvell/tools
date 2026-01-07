import "./index.css";
import { useState, useEffect, useCallback, useMemo } from "react";

// JSON syntax highlighter with muted, utilitarian colors
function highlightJSON(json: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  const addToken = (text: string, className?: string) => {
    tokens.push(
      <span key={key++} className={className}>
        {text}
      </span>
    );
  };

  const charAt = (idx: number): string => json[idx] ?? "";

  while (i < json.length) {
    const char = charAt(i);

    if (/\s/.test(char)) {
      let ws = "";
      while (i < json.length && /\s/.test(charAt(i))) {
        ws += charAt(i++);
      }
      addToken(ws);
      continue;
    }

    if (char === '"') {
      let str = '"';
      i++;
      while (i < json.length && charAt(i) !== '"') {
        if (charAt(i) === "\\") str += charAt(i++);
        str += charAt(i++);
      }
      str += '"';
      i++;

      let j = i;
      while (j < json.length && /\s/.test(charAt(j))) j++;
      const isKey = charAt(j) === ":";

      addToken(str, isKey ? "text-[#8b9eb0]" : "text-[#a3be8c]");
      continue;
    }

    if (/[-0-9]/.test(char)) {
      let num = "";
      while (i < json.length && /[-0-9.eE+]/.test(charAt(i))) {
        num += charAt(i++);
      }
      addToken(num, "text-[#d08770]");
      continue;
    }

    if (json.slice(i, i + 4) === "true") {
      addToken("true", "text-[#b48ead]");
      i += 4;
      continue;
    }
    if (json.slice(i, i + 5) === "false") {
      addToken("false", "text-[#b48ead]");
      i += 5;
      continue;
    }
    if (json.slice(i, i + 4) === "null") {
      addToken("null", "text-[#616e7c]");
      i += 4;
      continue;
    }

    if ("{}[]".includes(char)) {
      addToken(char, "text-[#4c566a]");
      i++;
      continue;
    }
    if (char === ":") {
      addToken(": ", "text-[#4c566a]");
      i++;
      if (charAt(i) === " ") i++;
      continue;
    }
    if (char === ",") {
      addToken(",", "text-[#4c566a]");
      i++;
      continue;
    }

    addToken(char);
    i++;
  }

  return tokens;
}

// Types
interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens?: number;
    ephemeral_1h_input_tokens?: number;
  };
  service_tier?: string;
  server_tool_use?: {
    web_search_requests?: number;
  };
}

interface ContentBlock {
  type: string;
  [key: string]: unknown;
}

interface Message {
  id: string;
  type: string;
  role: string;
  model: string;
  content: ContentBlock[];
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: Usage;
}

interface SSEEvent {
  event: string;
  data: Record<string, unknown>;
}

interface ContentBlockEntry {
  block: ContentBlock;
  partialJson: string;
}

function parseSSE(raw: string): SSEEvent[] {
  const events: SSEEvent[] = [];
  const lines = raw.split("\n");

  let currentEvent: string | null = null;
  let currentData: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("event:")) {
      if (currentEvent && currentData) {
        try {
          events.push({ event: currentEvent, data: JSON.parse(currentData) });
        } catch {
          /* skip */
        }
      }
      currentEvent = trimmed.slice(6).trim();
      currentData = null;
    } else if (trimmed.startsWith("data:")) {
      currentData = trimmed.slice(5).trim();
    } else if (trimmed === "" && currentEvent && currentData) {
      try {
        events.push({ event: currentEvent, data: JSON.parse(currentData) });
      } catch {
        /* skip */
      }
      currentEvent = null;
      currentData = null;
    }
  }

  if (currentEvent && currentData) {
    try {
      events.push({ event: currentEvent, data: JSON.parse(currentData) });
    } catch {
      /* skip */
    }
  }

  return events;
}

function assembleStream(events: SSEEvent[]): Message | null {
  let message: Message | null = null;
  const contentBlocks = new Map<number, ContentBlockEntry>();

  for (const { data } of events) {
    const type = data.type as string;

    switch (type) {
      case "message_start": {
        const msg = data.message as Record<string, unknown>;
        message = {
          id: msg.id as string,
          type: msg.type as string,
          role: msg.role as string,
          model: msg.model as string,
          content: [],
          stop_reason: (msg.stop_reason as string) || null,
          stop_sequence: (msg.stop_sequence as string) || null,
          usage: msg.usage as Usage,
        };
        break;
      }

      case "content_block_start": {
        const index = data.index as number;
        const block = data.content_block as ContentBlock;
        contentBlocks.set(index, { block: { ...block }, partialJson: "" });
        break;
      }

      case "content_block_delta": {
        const index = data.index as number;
        const delta = data.delta as Record<string, unknown>;
        const entry = contentBlocks.get(index);

        if (entry) {
          const deltaType = delta.type as string;
          if (deltaType === "text_delta") {
            entry.block.text =
              ((entry.block.text as string) || "") + (delta.text as string);
          } else if (deltaType === "input_json_delta") {
            entry.partialJson += delta.partial_json as string;
          } else if (deltaType === "thinking_delta") {
            entry.block.thinking =
              ((entry.block.thinking as string) || "") +
              (delta.thinking as string);
          } else if (deltaType === "signature_delta") {
            entry.block.signature = delta.signature as string;
          }
        }
        break;
      }

      case "content_block_stop": {
        const index = data.index as number;
        const entry = contentBlocks.get(index);
        if (entry && entry.partialJson) {
          try {
            entry.block.input = JSON.parse(entry.partialJson);
          } catch {
            entry.block.input = entry.partialJson;
          }
        }
        break;
      }

      case "message_delta": {
        if (message) {
          const delta = data.delta as Record<string, unknown>;
          if (delta.stop_reason !== undefined)
            message.stop_reason = delta.stop_reason as string;
          if (delta.stop_sequence !== undefined)
            message.stop_sequence = delta.stop_sequence as string;
          if (data.usage) message.usage = data.usage as Usage;
        }
        break;
      }
    }
  }

  if (message) {
    message.content = Array.from(contentBlocks.entries())
      .sort(([a], [b]) => a - b)
      .map(([, entry]) => entry.block);
  }

  return message;
}

export function StreamAssembler() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<Message | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!input.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    try {
      const events = parseSSE(input);
      if (events.length === 0) {
        setError("no valid events");
        setResult(null);
        return;
      }

      const assembled = assembleStream(events);
      if (!assembled) {
        setError("missing message_start");
        setResult(null);
        return;
      }

      setResult(assembled);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "parse error");
      setResult(null);
    }
  }, [input]);

  const handleClear = useCallback(() => {
    setInput("");
    setResult(null);
    setError(null);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }, [result]);

  const highlightedResult = useMemo(() => {
    if (!result) return null;
    return highlightJSON(JSON.stringify(result, null, 2));
  }, [result]);

  const eventCount = useMemo(() => {
    if (!input.trim()) return 0;
    return parseSSE(input).length;
  }, [input]);

  const blockCount = result?.content.length ?? 0;

  return (
    <div
      className="h-screen flex flex-col"
      style={{
        background: "#0d1117",
        fontFamily: "'IBM Plex Mono', 'SF Mono', 'Consolas', monospace",
      }}
    >
      {/* Minimal header bar */}
      <header
        className="flex items-center justify-between px-4 h-10 shrink-0"
        style={{ borderBottom: "1px solid #21262d" }}
      >
        <div className="flex items-center gap-4">
          <a
            href="/"
            className="text-xs uppercase tracking-widest transition-colors"
            style={{ color: "#484f58" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#8b949e")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
          >
            ← back
          </a>
          <span
            className="text-xs uppercase tracking-widest"
            style={{ color: "#8b949e" }}
          >
            stream assembler
          </span>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-xs" style={{ color: "#f85149" }}>
              {error}
            </span>
          )}
          <button
            onClick={handleClear}
            className="text-xs uppercase tracking-wider px-2 py-1 transition-colors"
            style={{ color: "#484f58" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#8b949e")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#484f58")}
          >
            clear
          </button>
          <button
            onClick={handleCopy}
            disabled={!result}
            className="text-xs uppercase tracking-wider px-2 py-1 transition-colors disabled:opacity-30"
            style={{ color: result ? "#58a6ff" : "#484f58" }}
            onMouseEnter={(e) => {
              if (result) e.currentTarget.style.color = "#79c0ff";
            }}
            onMouseLeave={(e) => {
              if (result) e.currentTarget.style.color = "#58a6ff";
            }}
          >
            {copied ? "copied" : "copy"}
          </button>
        </div>
      </header>

      {/* Main split view */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Input panel */}
        <div
          className="flex-1 flex flex-col min-h-0"
          style={{ borderRight: "1px solid #21262d" }}
        >
          <div
            className="flex items-center justify-between px-4 h-8 shrink-0"
            style={{ borderBottom: "1px solid #21262d" }}
          >
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "#484f58" }}
            >
              input
            </span>
            {eventCount > 0 && (
              <span
                className="text-[10px] tabular-nums"
                style={{ color: "#484f58" }}
              >
                {eventCount} events
              </span>
            )}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="paste sse events..."
            spellCheck={false}
            className="flex-1 resize-none p-4 text-[13px] leading-relaxed focus:outline-none placeholder:lowercase"
            style={{
              background: "transparent",
              color: "#c9d1d9",
              caretColor: "#58a6ff",
            }}
          />
        </div>

        {/* Output panel */}
        <div className="flex-1 flex flex-col min-h-0">
          <div
            className="flex items-center justify-between px-4 h-8 shrink-0"
            style={{ borderBottom: "1px solid #21262d" }}
          >
            <span
              className="text-[10px] uppercase tracking-widest"
              style={{ color: "#484f58" }}
            >
              output
            </span>
            {blockCount > 0 && (
              <span
                className="text-[10px] tabular-nums"
                style={{ color: "#484f58" }}
              >
                {blockCount} blocks
              </span>
            )}
          </div>
          <div className="flex-1 overflow-auto p-4">
            {result ? (
              <pre
                className="text-[13px] leading-relaxed"
                style={{ color: "#c9d1d9" }}
              >
                {highlightedResult}
              </pre>
            ) : (
              <span
                className="text-[13px] lowercase"
                style={{ color: "#30363d" }}
              >
                {input.trim() ? "..." : "json output"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Minimal footer */}
      <footer
        className="flex items-center justify-center h-8 shrink-0"
        style={{ borderTop: "1px solid #21262d" }}
      >
        <span
          className="text-[10px] uppercase tracking-widest"
          style={{ color: "#30363d" }}
        >
          anthropic sse → json
        </span>
      </footer>
    </div>
  );
}

export default StreamAssembler;
