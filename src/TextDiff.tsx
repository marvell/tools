import "./index.css";
import { useDeferredValue, useMemo, useState } from "react";

type SequenceOp<T> =
  | { type: "equal"; value: T }
  | { type: "delete"; value: T }
  | { type: "insert"; value: T };

type RowKind = "equal" | "modified" | "removed" | "added";

interface TokenPart {
  text: string;
  changed: boolean;
}

interface DiffRow {
  kind: RowKind;
  leftLineNumber: number | null;
  rightLineNumber: number | null;
  leftParts: TokenPart[];
  rightParts: TokenPart[];
}

interface DiffStats {
  leftLines: number;
  rightLines: number;
  rows: number;
  changedRows: number;
  identical: boolean;
}

const LINE_TOKEN_REGEX = /(\s+|[A-Za-z0-9_]+|[^\sA-Za-z0-9_]+)/g;

type EqualityFn<T> = (left: T, right: T) => boolean;

function equalOp<T>(value: T): SequenceOp<T> {
  return { type: "equal", value };
}

function insertOp<T>(value: T): SequenceOp<T> {
  return { type: "insert", value };
}

function deleteOp<T>(value: T): SequenceOp<T> {
  return { type: "delete", value };
}

function splitLines(text: string): string[] {
  return text.length === 0 ? [] : text.split("\n");
}

function tokenizeLine(line: string): string[] {
  if (line.length === 0) return [];
  return line.match(LINE_TOKEN_REGEX) ?? [line];
}

function backtrackDiff<T>(left: T[], right: T[], trace: number[][]): SequenceOp<T>[] {
  const operations: SequenceOp<T>[] = [];
  const offset = left.length + right.length;
  let leftIndex = left.length;
  let rightIndex = right.length;

  for (let distance = trace.length - 1; distance > 0; distance--) {
    const vector = trace[distance]!;
    const diagonal = leftIndex - rightIndex;
    const moveDown =
      diagonal === -distance ||
      (diagonal !== distance && (vector[offset + diagonal - 1] ?? -1) < (vector[offset + diagonal + 1] ?? -1));

    const previousDiagonal = moveDown ? diagonal + 1 : diagonal - 1;
    const previousLeftIndex = vector[offset + previousDiagonal] ?? 0;
    const previousRightIndex = previousLeftIndex - previousDiagonal;

    while (leftIndex > previousLeftIndex && rightIndex > previousRightIndex) {
      leftIndex--;
      rightIndex--;
      operations.push({ type: "equal", value: left[leftIndex]! });
    }

    if (moveDown) {
      rightIndex--;
      operations.push({ type: "insert", value: right[rightIndex]! });
    } else {
      leftIndex--;
      operations.push({ type: "delete", value: left[leftIndex]! });
    }
  }

  while (leftIndex > 0 && rightIndex > 0) {
    leftIndex--;
    rightIndex--;
    operations.push({ type: "equal", value: left[leftIndex]! });
  }

  while (leftIndex > 0) {
    leftIndex--;
    operations.push({ type: "delete", value: left[leftIndex]! });
  }

  while (rightIndex > 0) {
    rightIndex--;
    operations.push({ type: "insert", value: right[rightIndex]! });
  }

  return operations.reverse();
}

function diffSequence<T>(left: T[], right: T[], equal: EqualityFn<T> = (leftValue, rightValue) => leftValue === rightValue): SequenceOp<T>[] {
  let prefixLength = 0;
  let leftEnd = left.length;
  let rightEnd = right.length;

  while (prefixLength < leftEnd && prefixLength < rightEnd && equal(left[prefixLength]!, right[prefixLength]!)) {
    prefixLength++;
  }

  while (leftEnd > prefixLength && rightEnd > prefixLength && equal(left[leftEnd - 1]!, right[rightEnd - 1]!)) {
    leftEnd--;
    rightEnd--;
  }

  const operations: SequenceOp<T>[] = left
    .slice(0, prefixLength)
    .map(equalOp);

  const middleLeft = left.slice(prefixLength, leftEnd);
  const middleRight = right.slice(prefixLength, rightEnd);

  if (middleLeft.length === 0) {
    operations.push(...middleRight.map(insertOp));
  } else if (middleRight.length === 0) {
    operations.push(...middleLeft.map(deleteOp));
  } else {
    const max = middleLeft.length + middleRight.length;
    const offset = max;
    let vector = Array<number>(2 * max + 1).fill(-1);
    vector[offset + 1] = 0;
    const trace: number[][] = [];

    outer: for (let distance = 0; distance <= max; distance++) {
      trace.push(vector.slice());

      for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
        const vectorIndex = offset + diagonal;
        const moveDown =
          diagonal === -distance ||
          (diagonal !== distance && (vector[vectorIndex - 1] ?? -1) < (vector[vectorIndex + 1] ?? -1));

        let leftIndex = moveDown ? (vector[vectorIndex + 1] ?? -1) : (vector[vectorIndex - 1] ?? -1) + 1;
        let rightIndex = leftIndex - diagonal;

        while (
          leftIndex < middleLeft.length &&
          rightIndex < middleRight.length &&
          equal(middleLeft[leftIndex]!, middleRight[rightIndex]!)
        ) {
          leftIndex++;
          rightIndex++;
        }

        vector[vectorIndex] = leftIndex;

        if (leftIndex >= middleLeft.length && rightIndex >= middleRight.length) {
          operations.push(...backtrackDiff(middleLeft, middleRight, trace));
          break outer;
        }
      }
    }
  }

  operations.push(
    ...left.slice(leftEnd).map(equalOp),
  );

  return operations;
}

function diffTokens(leftLine: string, rightLine: string): { leftParts: TokenPart[]; rightParts: TokenPart[] } {
  const operations = diffSequence(tokenizeLine(leftLine), tokenizeLine(rightLine));
  const leftParts: TokenPart[] = [];
  const rightParts: TokenPart[] = [];

  for (const operation of operations) {
    if (operation.type === "equal") {
      leftParts.push({ text: operation.value, changed: false });
      rightParts.push({ text: operation.value, changed: false });
      continue;
    }

    if (operation.type === "delete") {
      leftParts.push({ text: operation.value, changed: true });
      continue;
    }

    rightParts.push({ text: operation.value, changed: true });
  }

  return { leftParts, rightParts };
}

function buildDiff(leftText: string, rightText: string): { rows: DiffRow[]; stats: DiffStats } {
  const leftLines = splitLines(leftText);
  const rightLines = splitLines(rightText);
  const operations = diffSequence(leftLines, rightLines);
  const rows: DiffRow[] = [];

  let pendingLeft: string[] = [];
  let pendingRight: string[] = [];
  let leftLineNumber = 1;
  let rightLineNumber = 1;

  const flushPending = () => {
    if (pendingLeft.length === 0 && pendingRight.length === 0) return;

    const rowCount = Math.max(pendingLeft.length, pendingRight.length);

    for (let index = 0; index < rowCount; index++) {
      const leftLine = pendingLeft[index] ?? null;
      const rightLine = pendingRight[index] ?? null;

      if (leftLine !== null && rightLine !== null) {
        const tokenDiff = diffTokens(leftLine, rightLine);
        rows.push({
          kind: "modified",
          leftLineNumber: leftLineNumber++,
          rightLineNumber: rightLineNumber++,
          leftParts: tokenDiff.leftParts,
          rightParts: tokenDiff.rightParts,
        });
        continue;
      }

      if (leftLine !== null) {
        rows.push({
          kind: "removed",
          leftLineNumber: leftLineNumber++,
          rightLineNumber: null,
          leftParts: [{ text: leftLine, changed: true }],
          rightParts: [],
        });
        continue;
      }

      rows.push({
        kind: "added",
        leftLineNumber: null,
        rightLineNumber: rightLineNumber++,
        leftParts: [],
        rightParts: [{ text: rightLine ?? "", changed: true }],
      });
    }

    pendingLeft = [];
    pendingRight = [];
  };

  for (const operation of operations) {
    if (operation.type === "equal") {
      flushPending();
      const line = operation.value;
      rows.push({
        kind: "equal",
        leftLineNumber: leftLineNumber++,
        rightLineNumber: rightLineNumber++,
        leftParts: [{ text: line, changed: false }],
        rightParts: [{ text: line, changed: false }],
      });
      continue;
    }

    if (operation.type === "delete") {
      pendingLeft.push(operation.value);
      continue;
    }

    pendingRight.push(operation.value);
  }

  flushPending();

  const changedRows = rows.filter((row) => row.kind !== "equal").length;

  return {
    rows,
    stats: {
      leftLines: leftLines.length,
      rightLines: rightLines.length,
      rows: rows.length,
      changedRows,
      identical: changedRows === 0 && leftText === rightText,
    },
  };
}

function renderParts(parts: TokenPart[], tone: "left" | "right") {
  if (parts.length === 0) {
    return <span className="opacity-30">&nbsp;</span>;
  }

  return parts.map((part, index) => {
    const changedClass =
      tone === "left"
        ? "bg-[#5a2430] text-[#ffd7df]"
        : "bg-[#123c36] text-[#cbfff2]";

    return (
      <span
        key={`${tone}-${index}-${part.text}`}
        className={part.changed ? `${changedClass} rounded-[3px]` : undefined}
      >
        {part.text || "\u00A0"}
      </span>
    );
  });
}

function getCellClass(rowKind: RowKind, tone: "left" | "right") {
  if (rowKind === "equal") {
    return "bg-[#0e131a] text-[#97a4b2]";
  }

  if (rowKind === "modified") {
    return tone === "left"
      ? "bg-[#1f1318] text-[#f6d5db]"
      : "bg-[#101a18] text-[#d6f7ee]";
  }

  if (rowKind === "removed") {
    return tone === "left"
      ? "bg-[#28141a] text-[#ffc7d2]"
      : "bg-[#0e131a] text-[#48576a]";
  }

  return tone === "right"
    ? "bg-[#10201d] text-[#c9fff1]"
    : "bg-[#0e131a] text-[#48576a]";
}

function getLineNumberClass(rowKind: RowKind, tone: "left" | "right") {
  if (rowKind === "equal") {
    return "text-[#4b5a68]";
  }

  if (rowKind === "modified") {
    return tone === "left" ? "text-[#d38a97]" : "text-[#74c4b1]";
  }

  if (rowKind === "removed") {
    return tone === "left" ? "text-[#d38a97]" : "text-[#3f4d5d]";
  }

  return tone === "right" ? "text-[#74c4b1]" : "text-[#3f4d5d]";
}

function DiffCell({
  rowKind,
  lineNumber,
  parts,
  tone,
}: {
  rowKind: RowKind;
  lineNumber: number | null;
  parts: TokenPart[];
  tone: "left" | "right";
}) {
  return (
    <div
      className={`grid grid-cols-[56px_minmax(0,1fr)] shadow-[inset_0_-1px_0_#16202a] ${
        tone === "left" ? "border-r border-[#1c2631]" : ""
      } ${getCellClass(rowKind, tone)}`}
    >
      <div
        className={`border-r border-[#1c2631] px-3 py-0 text-right text-[11px] leading-6 tabular-nums select-none ${getLineNumberClass(rowKind, tone)}`}
      >
        {lineNumber ?? ""}
      </div>
      <div className="overflow-x-auto px-4 py-0 text-[13px] leading-6 whitespace-pre font-mono">
        {renderParts(parts, tone)}
      </div>
    </div>
  );
}

function PaneLabel({
  label,
  lineCount,
  accent,
}: {
  label: string;
  lineCount: number;
  accent: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[#1c2631] px-5 py-3">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
        <span className="text-[10px] uppercase tracking-[0.25em] text-[#708091]">{label}</span>
      </div>
      <span className="text-[10px] tabular-nums text-[#4d5b69]">{lineCount} lines</span>
    </div>
  );
}

export function TextDiff() {
  const [leftText, setLeftText] = useState("");
  const [rightText, setRightText] = useState("");
  const deferredLeftText = useDeferredValue(leftText);
  const deferredRightText = useDeferredValue(rightText);

  const { rows, stats } = useMemo(() => buildDiff(deferredLeftText, deferredRightText), [deferredLeftText, deferredRightText]);
  const hasInput = leftText.length > 0 || rightText.length > 0;
  const isUpdating = leftText !== deferredLeftText || rightText !== deferredRightText;
  const statusLabel = !hasInput
    ? "awaiting input"
    : isUpdating
      ? "updating"
    : stats.identical
      ? "identical"
      : `${stats.changedRows} differing rows`;

  return (
    <div
      className="h-screen flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(circle at top, rgba(103, 120, 138, 0.12), transparent 28%), linear-gradient(180deg, #070b10 0%, #0a1016 100%)",
        fontFamily: "'IBM Plex Mono', 'SF Mono', 'Consolas', monospace",
      }}
    >
      <header className="border-b border-[#1c2631] px-6 py-4">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-4">
            <a
              href="/"
              className="text-[10px] uppercase tracking-[0.28em] text-[#5e6d7e] transition-colors hover:text-[#a7b3bf]"
            >
              ← home
            </a>
            <div>
              <h1
                className="text-[28px] leading-none text-[#edf3f8]"
                style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif" }}
              >
                Text Diff
              </h1>
              <p className="mt-1 text-[11px] uppercase tracking-[0.22em] text-[#5e6d7e]">
                exact compare · line numbers · word highlights
              </p>
            </div>
          </div>

          <div className="text-right text-[11px] uppercase tracking-[0.18em] text-[#7f8d9a]">
            {statusLabel}
            <div className="mt-1 text-[#4d5b69]">
              {stats.leftLines} ↔ {stats.rightLines}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 flex flex-col">
        <section className="grid min-h-0 grid-cols-2 border-b border-[#1c2631]">
          <div className="min-w-0 border-r border-[#1c2631] bg-[#0c1218]/80">
            <PaneLabel label="left" lineCount={stats.leftLines} accent="#d38a97" />
            <textarea
              value={leftText}
              onChange={(event) => setLeftText(event.target.value)}
              spellCheck={false}
              wrap="off"
              placeholder="paste first text"
              className="h-[32vh] w-full resize-none bg-transparent px-5 py-4 text-[13px] leading-6 text-[#e8eef4] placeholder:text-[#41505e] focus:outline-none"
            />
          </div>

          <div className="min-w-0 bg-[#0c1218]/60">
            <PaneLabel label="right" lineCount={stats.rightLines} accent="#74c4b1" />
            <textarea
              value={rightText}
              onChange={(event) => setRightText(event.target.value)}
              spellCheck={false}
              wrap="off"
              placeholder="paste second text"
              className="h-[32vh] w-full resize-none bg-transparent px-5 py-4 text-[13px] leading-6 text-[#e8eef4] placeholder:text-[#41505e] focus:outline-none"
            />
          </div>
        </section>

        <section className="flex-1 min-h-0 overflow-auto">
          <div className="sticky top-0 z-10 grid grid-cols-2 border-b border-[#1c2631] bg-[#091017]/95 backdrop-blur-sm">
            <div className="border-r border-[#1c2631] px-5 py-2 text-[10px] uppercase tracking-[0.24em] text-[#5e6d7e]">
              left diff view
            </div>
            <div className="px-5 py-2 text-[10px] uppercase tracking-[0.24em] text-[#5e6d7e]">
              right diff view
            </div>
          </div>

          {hasInput ? (
            <div className="grid min-w-[980px] grid-cols-2">
              {rows.map((row, index) => (
                <div key={`row-${index}`} className="contents">
                  <DiffCell
                    rowKind={row.kind}
                    lineNumber={row.leftLineNumber}
                    parts={row.leftParts}
                    tone="left"
                  />
                  <DiffCell
                    rowKind={row.kind}
                    lineNumber={row.rightLineNumber}
                    parts={row.rightParts}
                    tone="right"
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full min-h-[220px] items-center justify-center px-6 text-center">
              <div>
                <p
                  className="text-[24px] text-[#eef2f6]"
                  style={{ fontFamily: "'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', serif" }}
                >
                  Paste two versions above.
                </p>
                <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-[#586675]">
                  changes appear instantly with aligned rows and token-level highlights
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-[#1c2631] px-6 py-3 text-[10px] uppercase tracking-[0.22em] text-[#4d5b69]">
        {stats.rows} rendered rows · exact text comparison only
      </footer>
    </div>
  );
}

export default TextDiff;
