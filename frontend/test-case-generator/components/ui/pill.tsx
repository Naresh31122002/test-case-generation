"use client"

import * as React from "react"
import { AlertCircle, CircleOff } from "lucide-react"

const pillBase: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  padding: "3px 10px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: "nowrap",
}

/**
 * Impacted badge — teal when count > 0, neutral grey when 0.
 * Icon: warning-circle for >0, circle-off for 0.
 */
export function ImpactedBadge({
  count,
  onClick,
  style,
}: {
  count: number
  onClick?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
}) {
  const hasImpact = count > 0
  const s = hasImpact
    ? { background: "#FFE4E8", color: "#E11D48", border: "1px solid #FF4D6D" }
    : { background: "#F1EFE8", color: "#5F5E5A", border: "1px solid #D3D1C7" }
  const Icon = hasImpact ? AlertCircle : CircleOff
  return (
    <button onClick={onClick} style={{ ...pillBase, ...s, cursor: onClick ? "pointer" : "default", ...style }}>
      <Icon className="w-3.5 h-3.5" />
      {count} Impacted
    </button>
  )
}

type StatusPillKind = "navy" | "teal" | "project"

const statusStyle: Record<StatusPillKind, React.CSSProperties> = {
  // navy pill carries a hairline light border so it reads on a dark navy banner
  navy: { background: "#1A1A2E", color: "#ffffff", border: "1px solid rgba(255,255,255,0.22)" },
  teal: { background: "#FF4D6D", color: "#ffffff" },
  project: { background: "#F1EFE8", color: "#5F5E5A" },
}

/**
 * Header status pill used in the Test Cases dark banner.
 * kind: "navy" (count), "teal" (AI Generated), "project" (Alpha/Beta/Gamma tag)
 */
export function StatusPill({
  kind,
  children,
  style,
}: {
  kind: StatusPillKind
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <span
      style={{
        ...pillBase,
        ...statusStyle[kind],
        padding: "3px 9px",
        fontSize: 11,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
