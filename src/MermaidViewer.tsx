import "./index.css";
import { useState, useRef, useEffect, useCallback } from "react";
import mermaid from "mermaid";
import { usePanZoom } from "./hooks/usePanZoom";

const MERMAID_COLORS = {
  background: "transparent",
  canvas: "#0f172a",
  text: "#f8fafc",
  primary: "#4f46e5",
  primaryBorder: "#818cf8",
  secondary: "#059669",
  secondaryBorder: "#34d399",
  tertiary: "#9333ea",
  tertiaryBorder: "#c084fc",
  line: "#93c5fd",
} as const;

// Initialize mermaid with a colorful high-contrast dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: "base",
  securityLevel: "loose",
  themeVariables: {
    darkMode: true,
    background: MERMAID_COLORS.background,
    mainBkg: "#1e1b4b",
    secondBkg: "#064e3b",
    tertiaryBkg: "#3b0764",
    primaryColor: MERMAID_COLORS.primary,
    primaryTextColor: MERMAID_COLORS.text,
    primaryBorderColor: MERMAID_COLORS.primaryBorder,
    secondaryColor: MERMAID_COLORS.secondary,
    secondaryTextColor: "#ecfdf5",
    secondaryBorderColor: MERMAID_COLORS.secondaryBorder,
    tertiaryColor: MERMAID_COLORS.tertiary,
    tertiaryTextColor: "#faf5ff",
    tertiaryBorderColor: MERMAID_COLORS.tertiaryBorder,
    lineColor: MERMAID_COLORS.line,
    textColor: MERMAID_COLORS.text,
    border1: MERMAID_COLORS.primaryBorder,
    border2: MERMAID_COLORS.secondaryBorder,
    nodeBkg: "#1e1b4b",
    nodeBorder: MERMAID_COLORS.primaryBorder,
    nodeTextColor: MERMAID_COLORS.text,
    clusterBkg: "#111827",
    clusterBorder: MERMAID_COLORS.secondaryBorder,
    edgeLabelBackground: MERMAID_COLORS.canvas,
    titleColor: MERMAID_COLORS.text,
    noteBkgColor: "#422006",
    noteTextColor: "#fef3c7",
    noteBorderColor: "#f59e0b",
    actorBkg: "#1e3a8a",
    actorTextColor: "#eff6ff",
    actorBorder: "#60a5fa",
    actorLineColor: "#64748b",
    signalColor: MERMAID_COLORS.text,
    signalTextColor: MERMAID_COLORS.text,
    labelBoxBkgColor: MERMAID_COLORS.canvas,
    labelBoxBorderColor: "#38bdf8",
    labelTextColor: MERMAID_COLORS.text,
    loopTextColor: MERMAID_COLORS.text,
    activationBkgColor: "#312e81",
    activationBorderColor: "#a5b4fc",
    sequenceNumberColor: MERMAID_COLORS.canvas,
    cScale0: MERMAID_COLORS.primary,
    cScale1: "#0891b2",
    cScale2: MERMAID_COLORS.secondary,
    cScale3: "#d97706",
    cScale4: "#dc2626",
    cScale5: MERMAID_COLORS.tertiary,
    cScale6: "#db2777",
    cScale7: "#2563eb",
    classText: MERMAID_COLORS.text,
    stateLabelColor: MERMAID_COLORS.text,
    stateBkg: "#1e1b4b",
    labelBackgroundColor: MERMAID_COLORS.canvas,
  },
});

// Zoom constraints
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const PNG_SCALE = 2;
const MAX_CANVAS_DIMENSION = 16384;
const MAX_CANVAS_PIXELS = 67_108_864;

type ExportAction = "download" | "copy";
type ExportFeedback = { type: "success" | "error"; message: string };

const extractMermaidCode = (input: string) => {
  const fenceMatch = input.match(/```[ \t]*mermaid[^\n\r]*\r?\n([\s\S]*?)\r?\n```/i);
  return (fenceMatch?.[1] ?? input).trim();
};

const styleRenderedMermaidSvg = (svgEl: SVGSVGElement) => {
  svgEl.style.maxWidth = "none";
  svgEl.style.maxHeight = "none";
  svgEl.style.background = MERMAID_COLORS.background;
  svgEl.style.color = MERMAID_COLORS.text;
};

const getSvgDimensions = (svgEl: SVGSVGElement) => {
  const viewBox = svgEl.viewBox.baseVal;
  if (viewBox.width > 0 && viewBox.height > 0) {
    return { width: viewBox.width, height: viewBox.height };
  }

  const bounds = svgEl.getBBox();
  if (bounds.width > 0 && bounds.height > 0) {
    return { width: bounds.width, height: bounds.height };
  }

  throw new Error("The diagram has no exportable dimensions.");
};

const getPngFilename = (date = new Date()) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");

  return `mermaid_${timestamp}.png`;
};

const loadSvgImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      resolve(image);
    };
    image.onerror = () => {
      reject(new Error("The diagram could not be rendered as a PNG."));
    };
    image.src = source;
  });

const svgToPngBlob = async (svgEl: SVGSVGElement) => {
  const { width, height } = getSvgDimensions(svgEl);
  const canvasWidth = Math.ceil(width * PNG_SCALE);
  const canvasHeight = Math.ceil(height * PNG_SCALE);

  if (
    canvasWidth > MAX_CANVAS_DIMENSION ||
    canvasHeight > MAX_CANVAS_DIMENSION ||
    canvasWidth * canvasHeight > MAX_CANVAS_PIXELS
  ) {
    throw new Error("The diagram is too large to export as a 2x PNG.");
  }

  const exportSvg = svgEl.cloneNode(true) as SVGSVGElement;
  exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  exportSvg.setAttribute("width", String(width));
  exportSvg.setAttribute("height", String(height));
  exportSvg.style.maxWidth = "none";
  exportSvg.style.maxHeight = "none";
  exportSvg.style.background = "transparent";

  const serializedSvg = new XMLSerializer().serializeToString(exportSvg);
  const image = await loadSvgImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(serializedSvg)}`);
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("PNG export is not supported by this browser.");
  }

  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("The PNG could not be created. The diagram may be too large."));
        }
      }, "image/png");
    } catch {
      reject(new Error("The PNG could not be created. The diagram may contain an external image."));
    }
  });
};

// Example diagrams
const EXAMPLES = [
  {
    name: "Flowchart",
    code: `flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`,
  },
  {
    name: "Sequence",
    code: `sequenceDiagram
    participant U as User
    participant S as Server
    participant D as Database
    U->>S: Request
    S->>D: Query
    D-->>S: Result
    S-->>U: Response`,
  },
  {
    name: "Class",
    code: `classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +fetch()
    }
    class Cat {
        +scratch()
    }
    Animal <|-- Dog
    Animal <|-- Cat`,
  },
];

export function MermaidViewer() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [isRendering, setIsRendering] = useState(false);
  const [exportAction, setExportAction] = useState<ExportAction | null>(null);
  const [exportFeedback, setExportFeedback] = useState<ExportFeedback | null>(null);

  const diagramRef = useRef<HTMLDivElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringControlsRef = useRef(false);

  const { state, controls, handlers, containerRef, setContainerRef } = usePanZoom({
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
  });

  const { zoom, pan, isDragging } = state;
  const { fitToView } = controls;

  const hasCode = code.trim().length > 0;
  const exportDisabled = isRendering || exportAction !== null || error !== null;

  const showExportFeedback = useCallback((feedback: ExportFeedback) => {
    setExportFeedback(feedback);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setExportFeedback(null), 3500);
  }, []);

  useEffect(
    () => () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    },
    [],
  );

  // Auto-hide controls after inactivity
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      if (hasCode && !isHoveringControlsRef.current) setShowControls(false);
    }, 2500);
  }, [hasCode]);

  const keepControlsVisible = useCallback(() => {
    isHoveringControlsRef.current = true;
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, []);

  const releaseControls = useCallback(() => {
    isHoveringControlsRef.current = false;
    showControlsTemporarily();
  }, [showControlsTemporarily]);

  // Render diagram when code changes
  useEffect(() => {
    let isCurrent = true;

    const renderDiagram = async () => {
      if (!code.trim() || !diagramRef.current) {
        return;
      }

      setIsRendering(true);

      try {
        await mermaid.parse(code);
        if (!isCurrent) return;
        setError(null);

        diagramRef.current.innerHTML = "";

        const { svg } = await mermaid.render(`mermaid-${Date.now()}`, code);
        if (!isCurrent) return;
        diagramRef.current.innerHTML = svg;

        // Style the SVG for better appearance
        const svgEl = diagramRef.current.querySelector("svg");
        if (svgEl) {
          styleRenderedMermaidSvg(svgEl);
        }

        // Auto fit-to-view after layout
        requestAnimationFrame(() => {
          if (!isCurrent || !svgEl) return;
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            fitToView(svgEl.clientWidth, svgEl.clientHeight, containerRect.width, containerRect.height);
          }
        });
      } catch (err) {
        if (!isCurrent) return;
        const message = err instanceof Error ? err.message : "Invalid Mermaid syntax";
        setError(message);
      } finally {
        if (isCurrent) setIsRendering(false);
      }
    };

    renderDiagram();
    return () => {
      isCurrent = false;
    };
  }, [code, fitToView]);

  // Global paste listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData("text");
      if (text) {
        setCode(extractMermaidCode(text));
        showControlsTemporarily();
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [showControlsTemporarily, controls]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case "Escape":
          handleClear();
          break;
        case "+":
        case "=":
          e.preventDefault();
          controls.zoomIn();
          showControlsTemporarily();
          break;
        case "-":
          e.preventDefault();
          controls.zoomOut();
          showControlsTemporarily();
          break;
        case "0":
          e.preventDefault();
          controls.reset();
          showControlsTemporarily();
          break;
        case "f":
        case "F":
          e.preventDefault();
          handleFitToView();
          showControlsTemporarily();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showControlsTemporarily, controls]);

  // Mouse movement shows controls
  useEffect(() => {
    const handleMouseMove = () => {
      if (hasCode) showControlsTemporarily();
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [hasCode, showControlsTemporarily]);

  // Control handlers
  const handleFitToView = () => {
    if (!diagramRef.current || !containerRef.current) return;
    const svg = diagramRef.current.querySelector("svg");
    if (!svg) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const svgWidth = svg.clientWidth || svg.getBoundingClientRect().width / zoom;
    const svgHeight = svg.clientHeight || svg.getBoundingClientRect().height / zoom;

    controls.fitToView(svgWidth, svgHeight, containerRect.width, containerRect.height);
  };

  const handleClear = () => {
    setCode("");
    setError(null);
    setExportFeedback(null);
    controls.reset();
    setShowControls(true);
  };

  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setCode(extractMermaidCode(text));
        showControlsTemporarily();
      }
    } catch {
      console.log("Clipboard access denied");
    }
  };

  const handleLoadExample = (example: (typeof EXAMPLES)[0]) => {
    setCode(example.code);
    showControlsTemporarily();
  };

  const createPngBlob = async () => {
    const svgEl = diagramRef.current?.querySelector("svg");
    if (!svgEl) throw new Error("The diagram is not ready to export.");
    return svgToPngBlob(svgEl);
  };

  const handleDownloadPng = async () => {
    setExportAction("download");
    setExportFeedback(null);

    try {
      const png = await createPngBlob();
      const downloadUrl = URL.createObjectURL(png);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = getPngFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(downloadUrl), 0);
      showExportFeedback({ type: "success", message: "PNG downloaded" });
    } catch (exportError) {
      showExportFeedback({
        type: "error",
        message: exportError instanceof Error ? exportError.message : "The PNG could not be downloaded.",
      });
    } finally {
      setExportAction(null);
    }
  };

  const handleCopyPng = async () => {
    setExportAction("copy");
    setExportFeedback(null);

    try {
      if (!window.isSecureContext || !navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("Copying images is not supported by this browser or connection.");
      }

      const png = await createPngBlob();
      await navigator.clipboard.write([new ClipboardItem({ "image/png": png })]);
      showExportFeedback({ type: "success", message: "PNG copied to clipboard" });
    } catch (exportError) {
      const permissionDenied = exportError instanceof DOMException && exportError.name === "NotAllowedError";
      showExportFeedback({
        type: "error",
        message: permissionDenied
          ? "Clipboard permission was denied."
          : exportError instanceof Error
            ? exportError.message
            : "The PNG could not be copied.",
      });
    } finally {
      setExportAction(null);
    }
  };

  // Empty state - invitation to paste
  if (!hasCode) {
    return (
      <div className="fixed inset-0 bg-[#0a0a0f] overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(ellipse 80% 50% at 50% -20%, rgba(99, 102, 241, 0.3), transparent),
                radial-gradient(ellipse 60% 40% at 80% 100%, rgba(139, 92, 246, 0.2), transparent),
                radial-gradient(ellipse 40% 30% at 10% 80%, rgba(59, 130, 246, 0.15), transparent)
              `,
            }}
          />
        </div>

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Main content */}
        <div className="relative z-10 h-full flex flex-col items-center justify-center p-8">
          {/* Title */}
          <div className="text-center mb-12 space-y-3">
            <h1
              className="text-5xl md:text-7xl font-light tracking-tight text-white/90"
              style={{ fontFamily: "'SF Pro Display', -apple-system, sans-serif" }}
            >
              Mermaid<span className="text-indigo-400">.</span>
            </h1>
            <p className="text-lg text-white/40 font-light tracking-wide">diagram viewer</p>
          </div>

          {/* Paste invitation */}
          <button onClick={handlePasteFromClipboard} className="group relative mb-8">
            {/* Glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-indigo-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            {/* Button */}
            <div className="relative px-12 py-6 bg-white/[0.03] border border-white/10 rounded-2xl backdrop-blur-sm hover:bg-white/[0.06] hover:border-white/20 transition-all duration-300">
              <div className="flex items-center gap-4">
                {/* Clipboard icon */}
                <svg
                  className="w-6 h-6 text-white/50 group-hover:text-indigo-400 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
                  />
                </svg>
                <div className="text-left">
                  <div className="text-lg text-white/90 font-medium">Paste from clipboard</div>
                  <div className="text-sm text-white/40">
                    or press{" "}
                    <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-xs font-mono">⌘V</kbd>
                  </div>
                </div>
              </div>
            </div>
          </button>

          {/* Examples */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm text-white/30">Try an example:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example.name}
                onClick={() => handleLoadExample(example)}
                className="px-4 py-2 text-sm text-white/50 hover:text-white/90 bg-white/[0.02] hover:bg-white/[0.06] border border-white/5 hover:border-white/10 rounded-lg transition-all duration-200"
              >
                {example.name}
              </button>
            ))}
          </div>

          {/* Keyboard shortcuts hint */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-6 text-xs text-white/20">
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded font-mono">+/-</kbd> zoom
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded font-mono">0</kbd> reset
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded font-mono">F</kbd> fit
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-white/5 rounded font-mono">Esc</kbd> clear
            </span>
          </div>

          {/* Back link */}
          <a
            href="/"
            className="absolute top-6 left-6 text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            ← Back
          </a>
        </div>
      </div>
    );
  }

  // Viewing state - full screen diagram
  return (
    <div className="fixed inset-0 bg-[#0a0a0f] overflow-hidden">
      {/* Subtle gradient background */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(ellipse 100% 60% at 50% 100%, rgba(99, 102, 241, 0.15), transparent)`,
        }}
      />

      {/* Diagram canvas - full screen */}
      <div
        ref={setContainerRef}
        className="absolute inset-0 z-10"
        style={{ cursor: isDragging ? "grabbing" : "grab" }}
        onMouseDown={handlers.onMouseDown}
        onMouseMove={handlers.onMouseMove}
        onMouseUp={handlers.onMouseUp}
        onMouseLeave={handlers.onMouseUp}
        onTouchStart={handlers.onTouchStart}
        onTouchMove={handlers.onTouchMove}
        onTouchEnd={handlers.onTouchEnd}
      >
        {/* Diagram container */}
        <div
          ref={diagramRef}
          className="absolute inset-0 flex items-center justify-center transition-opacity duration-300"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "center center",
            opacity: isRendering ? 0.5 : 1,
          }}
        />

        {/* Loading indicator */}
        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-lg">
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg backdrop-blur-sm">
            <p className="text-sm text-red-400 font-mono">{error}</p>
          </div>
        </div>
      )}

      {exportFeedback && (
        <div className="absolute top-16 right-4 z-30 max-w-sm" role="status" aria-live="polite">
          <div
            className={`px-4 py-3 border rounded-lg backdrop-blur-sm ${
              exportFeedback.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}
          >
            <p className="text-sm">{exportFeedback.message}</p>
          </div>
        </div>
      )}

      {/* Controls overlay - auto-hiding */}
      <div
        className="absolute inset-0 z-20 pointer-events-none transition-opacity duration-300"
        style={{ opacity: showControls ? 1 : 0 }}
      >
        {/* Top bar */}
        <div
          className="absolute top-0 inset-x-0 p-4 flex items-center justify-between pointer-events-auto"
          onMouseEnter={keepControlsVisible}
          onMouseLeave={releaseControls}
        >
          {/* Back / Clear */}
          <button
            onClick={handleClear}
            className="flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white/90 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 rounded-lg backdrop-blur-sm transition-all"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span>Clear</span>
            <kbd className="ml-2 px-1.5 py-0.5 text-xs bg-white/5 rounded font-mono">Esc</kbd>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 px-2 py-1.5 bg-white/[0.03] border border-white/5 rounded-lg backdrop-blur-sm">
            <button
              onClick={controls.zoomOut}
              className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors"
              title="Zoom out (-)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
              </svg>
            </button>

            <span className="w-16 text-center text-sm text-white/60 font-mono">
              {Math.round(zoom * 100)}%
            </span>

            <button
              onClick={controls.zoomIn}
              className="w-8 h-8 flex items-center justify-center text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors"
              title="Zoom in (+)"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>

            <div className="w-px h-5 bg-white/10 mx-1" />

            <button
              onClick={handleFitToView}
              className="px-3 h-8 flex items-center justify-center text-sm text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors"
              title="Fit to view (F)"
            >
              Fit
            </button>

            <button
              onClick={controls.reset}
              className="px-3 h-8 flex items-center justify-center text-sm text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors"
              title="Reset view (0)"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* PNG export */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/5 rounded-lg backdrop-blur-sm">
              <button
                onClick={handleDownloadPng}
                disabled={exportDisabled}
                title="Download the full diagram as a transparent 2x PNG"
                className="flex items-center gap-2 px-3 h-8 text-sm text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <svg
                  className={`w-4 h-4 ${exportAction === "download" ? "animate-pulse" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
                </svg>
                <span>{exportAction === "download" ? "Exporting…" : "Download PNG"}</span>
              </button>

              <div className="w-px h-5 bg-white/10" />

              <button
                onClick={handleCopyPng}
                disabled={exportDisabled}
                title="Copy the full diagram as a transparent 2x PNG"
                className="flex items-center gap-2 px-3 h-8 text-sm text-white/50 hover:text-white/90 hover:bg-white/10 rounded transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                <svg
                  className={`w-4 h-4 ${exportAction === "copy" ? "animate-pulse" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h7a2 2 0 012 2v11a2 2 0 01-2 2h-2M7 21h7a2 2 0 002-2V8a2 2 0 00-2-2H7a2 2 0 00-2 2v11a2 2 0 002 2z" />
                </svg>
                <span>{exportAction === "copy" ? "Copying…" : "Copy PNG"}</span>
              </button>
            </div>

            {/* Paste new */}
            <button
              onClick={handlePasteFromClipboard}
              title="Paste a new diagram from clipboard (⌘V) — replaces the current one"
              className="flex items-center gap-2 px-3 py-2 text-sm text-white/50 hover:text-white/90 bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-white/10 rounded-lg backdrop-blur-sm transition-all"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125H8.25z"
                />
              </svg>
              <span>Paste new</span>
            </button>
          </div>
        </div>

        {/* Bottom hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/20">
          Two-finger swipe to pan • Pinch or ⌘+scroll to zoom • Drag to pan
        </div>
      </div>
    </div>
  );
}

export default MermaidViewer;
