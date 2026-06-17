"use client";

import { Sparkles } from "lucide-react";
import { Tooltip } from "./Tooltip";

export type ConfidenceLevel = "High" | "Medium" | "Low";

/** Map a 0–100 confidence number to a level. */
export function confidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

const styles: Record<ConfidenceLevel, string> = {
  High: "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
};

export function AIConfidenceBadge({
  level,
  score,
}: {
  level: ConfidenceLevel;
  score?: number;
}) {
  return (
    <Tooltip
      content={
        score != null
          ? `AI confidence: ${level} (${score}%)`
          : `AI confidence: ${level}`
      }
    >
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${styles[level]}`}
      >
        <Sparkles size={10} />
        {level}
      </span>
    </Tooltip>
  );
}
