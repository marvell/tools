import "./index.css";
import { buildInfo } from "./buildInfo";

const tools = [
  {
    id: "01",
    name: "running calculator",
    description: "calculate distance, time, or pace for your runs",
    href: "/running-calc",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    id: "02",
    name: "youtube transcripts",
    description: "get transcripts from any youtube video instantly",
    href: "/youtube-transcript",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    id: "03",
    name: "mermaid viewer",
    description: "paste mermaid diagrams and explore with pan & zoom",
    href: "/mermaid-viewer",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
      </svg>
    ),
  },
  {
    id: "04",
    name: "stream assembler",
    description: "assemble anthropic api sse stream events into json",
    href: "/stream-assembler",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16m-7 6h7M4 18h4" />
      </svg>
    ),
  },
  {
    id: "05",
    name: "text diff",
    description: "paste two versions side by side and inspect the exact diff",
    href: "/text-diff",
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4m4-16h4a2 2 0 012 2v12a2 2 0 01-2 2h-4M8 8h4m-4 4h8m-8 4h4" />
      </svg>
    ),
  },
];

export function App() {
  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-4px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .tool-item {
          animation: fadeIn 0.4s ease-out both;
        }
        .tool-item:nth-child(1) { animation-delay: 0.05s; }
        .tool-item:nth-child(2) { animation-delay: 0.1s; }
        .tool-item:nth-child(3) { animation-delay: 0.15s; }
        .tool-item:nth-child(4) { animation-delay: 0.2s; }
        .tool-item:nth-child(5) { animation-delay: 0.25s; }
        .tool-item:nth-child(6) { animation-delay: 0.3s; }

        .tool-link {
          position: relative;
        }
        .tool-link::before {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 2px;
          background: #58a6ff;
          opacity: 0;
          transform: scaleY(0);
          transition: all 0.2s ease-out;
        }
        .tool-link:hover::before,
        .tool-link:focus::before {
          opacity: 1;
          transform: scaleY(1);
        }

        .tool-link .tool-icon {
          color: #3d444d;
          transition: color 0.2s ease, transform 0.2s ease;
        }
        .tool-link:hover .tool-icon,
        .tool-link:focus .tool-icon {
          color: #6e7681;
          transform: scale(1.1);
        }

        .tool-link .tool-name {
          color: #adbac7;
          transition: color 0.2s ease;
        }
        .tool-link:hover .tool-name,
        .tool-link:focus .tool-name {
          color: #58a6ff;
        }

        .tool-link .tool-desc {
          color: #3d444d;
          transition: color 0.2s ease;
        }
        .tool-link:hover .tool-desc,
        .tool-link:focus .tool-desc {
          color: #545d68;
        }

        .tool-link .tool-arrow {
          opacity: 0;
          transform: translateX(-4px);
          transition: all 0.2s ease;
        }
        .tool-link:hover .tool-arrow,
        .tool-link:focus .tool-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        .tool-link .tool-id {
          color: #2d333b;
          transition: color 0.2s ease;
        }
        .tool-link:hover .tool-id,
        .tool-link:focus .tool-id {
          color: #3d444d;
        }

        .cursor-blink {
          animation: blink 1s step-end infinite;
        }

        .header-text {
          animation: slideIn 0.3s ease-out both;
        }

        .footer-text {
          animation: fadeIn 0.4s ease-out 0.3s both;
        }
      `}</style>

      <div
        className="h-screen flex flex-col select-none"
        style={{
          background: "linear-gradient(180deg, #0d1117 0%, #0a0e14 100%)",
          fontFamily: "'IBM Plex Mono', 'SF Mono', 'Consolas', monospace",
        }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-center px-4 h-10 shrink-0"
          style={{ borderBottom: "1px solid #1b2028" }}
        >
          <span
            className="text-[11px] uppercase tracking-[0.2em] header-text"
            style={{ color: "#6e7681" }}
          >
            marvell tools
            <span className="cursor-blink ml-0.5" style={{ color: "#58a6ff" }}>▋</span>
          </span>
        </header>

        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 overflow-auto">
          <div className="w-full max-w-sm">
            {/* Section label */}
            <div
              className="text-[9px] uppercase tracking-[0.25em] mb-4 pl-1"
              style={{
                color: "#2d333b",
                animation: "fadeIn 0.3s ease-out both"
              }}
            >
              available utilities
            </div>

            {/* Tools list */}
            <div className="space-y-0.5">
              {tools.map((tool) => (
                <div key={tool.id} className="tool-item">
                  <a
                    href={tool.href}
                    className="tool-link group flex items-center gap-3 py-2.5 px-3 rounded-sm focus:outline-none"
                    style={{ background: "transparent" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(88, 166, 255, 0.03)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {/* ID number */}
                    <span className="tool-id text-[9px] tabular-nums font-light">
                      {tool.id}
                    </span>

                    {/* Icon */}
                    <span className="tool-icon shrink-0">
                      {tool.icon}
                    </span>

                    {/* Text content */}
                    <div className="flex-1 min-w-0">
                      <div className="tool-name text-[12px] leading-tight">
                        {tool.name}
                      </div>
                      <div className="tool-desc text-[10px] mt-0.5 leading-tight truncate">
                        {tool.description}
                      </div>
                    </div>

                    {/* Arrow */}
                    <span className="tool-arrow text-[10px]" style={{ color: "#58a6ff" }}>
                      →
                    </span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer
          className="flex items-center justify-center h-8 shrink-0 gap-3"
          style={{ borderTop: "1px solid #1b2028" }}
        >
          <span
            className="footer-text text-[9px] uppercase tracking-[0.15em] tabular-nums"
            style={{ color: "#2d333b" }}
          >
            build {buildInfo.gitHash}
          </span>
          <span
            className="footer-text text-[9px]"
            style={{ color: "#1b2028", animationDelay: "0.35s" }}
          >
            ·
          </span>
          <span
            className="footer-text text-[9px] uppercase tracking-[0.15em]"
            style={{ color: "#2d333b", animationDelay: "0.4s" }}
          >
            bun + react
          </span>
        </footer>
      </div>
    </>
  );
}

export default App;
