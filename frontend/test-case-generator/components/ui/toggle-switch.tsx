"use client"

import * as React from "react"

interface ToggleProps {
  checked: boolean
  onChange: () => void
  label: string
  disabled?: boolean
  /** colour of the label when OFF (defaults to muted slate) */
  offLabelColor?: string
  className?: string
}

/**
 * CoverLoop unified pill toggle. Grey track OFF → teal track ON, sliding white dot.
 * Entire row (track + label) is clickable. Disabled when `disabled`.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  offLabelColor = "#4E7A8A",
  className,
}: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => { if (!disabled) onChange() }}
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "transparent",
        border: "none",
        fontSize: 13,
        fontWeight: checked ? 500 : 400,
        color: checked ? "#1A9FB5" : offLabelColor,
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        pointerEvents: disabled ? "none" : "auto",
      }}
    >
      <span
        style={{
          position: "relative",
          display: "inline-block",
          width: 36,
          height: 20,
          borderRadius: 10,
          background: checked ? "#1A9FB5" : "#D3D1C7",
          transition: "background 0.2s ease",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 3,
            left: checked ? 19 : 3,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#ffffff",
            transition: "left 0.2s ease",
          }}
        />
      </span>
      {label}
    </button>
  )
}
