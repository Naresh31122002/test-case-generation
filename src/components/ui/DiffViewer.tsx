import { type DiffLine } from "@/lib/seed";

interface DiffViewerProps {
  lines: DiffLine[];
}

export function DiffViewer({ lines }: DiffViewerProps) {
  return (
    <div className="w-full rounded-lg border border-border overflow-hidden font-mono text-[13px]">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`flex items-start ${
            line.type === "added"
              ? "bg-[#ECFDF5]"
              : line.type === "removed"
              ? "bg-[#FEF2F2]"
              : "bg-white"
          }`}
        >
          {/* Line number gutter */}
          <span className="w-10 flex-shrink-0 text-right pr-3 py-1 text-[11px] text-muted select-none border-r border-border">
            {line.lineNum}
          </span>
          {/* +/- gutter */}
          <span
            className={`w-5 flex-shrink-0 text-center py-1 select-none font-bold ${
              line.type === "added"
                ? "text-[#065F46]"
                : line.type === "removed"
                ? "text-[#991B1B]"
                : "text-transparent"
            }`}
          >
            {line.type === "added" ? "+" : line.type === "removed" ? "−" : " "}
          </span>
          {/* Code content */}
          <span
            className={`flex-1 px-4 py-1 whitespace-pre-wrap break-all ${
              line.type === "added"
                ? "text-[#065F46]"
                : line.type === "removed"
                ? "text-[#991B1B]"
                : "text-muted"
            }`}
          >
            {line.content}
          </span>
        </div>
      ))}
    </div>
  );
}
