"use client";

interface CoverageRingProps {
  coverage: number;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function CoverageRing({
  coverage,
  size = 48,
  strokeWidth = 5,
  showLabel = false,
}: CoverageRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - coverage / 100);
  const center = size / 2;

  return (
    <div className="flex items-center gap-1.5">
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={strokeWidth}
        />
        {/* Filled arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#06B6D4"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {showLabel && (
        <span className="text-xs font-semibold text-navy">{coverage}%</span>
      )}
    </div>
  );
}
