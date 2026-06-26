"use client";
import { Info } from "lucide-react";
import { Tooltip } from "./Tooltip";

interface InlineTooltipProps {
  content: string;
  className?: string;
  side?: "top" | "bottom";
}

export function InlineTooltip({ content, className = "", side = "top" }: InlineTooltipProps) {
  return (
    <Tooltip content={content} side={side}>
      <span className={`inline-flex items-center ${className}`}>
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted/10 hover:bg-cyan/10 hover:text-cyan transition-colors cursor-help ml-1 flex-shrink-0">
          <Info size={11} className="text-muted/70 hover:text-cyan transition-colors" />
        </span>
      </span>
    </Tooltip>
  );
}

