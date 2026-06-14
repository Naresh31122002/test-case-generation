"use client"

import * as React from "react"

/**
 * CoverLoop brand button system.
 * Brand palette: navy #0D1B2A, teal #1A9FB5, light teal #E1F5F8.
 *
 * Variants:
 *  - primary     : solid navy   (the single most important action)
 *  - secondary   : teal outline (important secondary action)
 *  - ghost       : neutral outline (utility / tertiary)
 *  - dark-ghost  : white outline, ONLY on dark navy banners
 *  - icon-filled : teal circle  (icon action, e.g. download)
 *  - icon-outline: teal ghost circle (icon action, e.g. view)
 */
export type BtnVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "dark-ghost"
  | "icon-filled"
  | "icon-outline"

interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: BtnVariant
  /** make text buttons span the full width of their container */
  fullWidth?: boolean
}

const base: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  fontWeight: 500,
  cursor: "pointer",
  transition: "background-color 0.15s ease, opacity 0.15s ease, color 0.15s ease",
  whiteSpace: "nowrap",
}

const variantStyle: Record<BtnVariant, React.CSSProperties> = {
  // PRIMARY = the master "Trigger Now" teal solid button
  primary: {
    background: "#1A9FB5", color: "#ffffff", border: "none",
    padding: "9px 20px", borderRadius: 8, fontSize: 13,
  },
  secondary: {
    background: "transparent", color: "#1A9FB5", border: "1.5px solid #1A9FB5",
    padding: "8px 18px", borderRadius: 8, fontSize: 13,
  },
  ghost: {
    background: "transparent", color: "#374151", border: "1px solid rgba(0,0,0,0.15)",
    padding: "8px 18px", borderRadius: 8, fontSize: 13,
  },
  "dark-ghost": {
    background: "transparent", color: "#ffffff", border: "1px solid rgba(255,255,255,0.30)",
    padding: "8px 16px", borderRadius: 8, fontSize: 13,
  },
  "icon-filled": {
    background: "#1A9FB5", color: "#ffffff", border: "none",
    width: 34, height: 34, borderRadius: "50%", padding: 0,
  },
  "icon-outline": {
    background: "transparent", color: "#1A9FB5", border: "1.5px solid #1A9FB5",
    width: 34, height: 34, borderRadius: "50%", padding: 0,
  },
}

const hoverBg: Record<BtnVariant, string> = {
  primary: "#178fa3",
  secondary: "#E1F5F8",
  ghost: "rgba(0,0,0,0.04)",
  "dark-ghost": "rgba(255,255,255,0.10)",
  "icon-filled": "#168ca0",
  "icon-outline": "#E1F5F8",
}

export const Btn = React.forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant, fullWidth, style, disabled, onMouseEnter, onMouseLeave, ...props }, ref) => {
    const baseBg = variantStyle[variant].background as string
    return (
      <button
        ref={ref}
        disabled={disabled}
        style={{
          ...base,
          ...variantStyle[variant],
          ...(fullWidth ? { width: "100%" } : null),
          ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : null),
          ...style,
        }}
        onMouseEnter={e => {
          if (!disabled) e.currentTarget.style.background = hoverBg[variant]
          onMouseEnter?.(e)
        }}
        onMouseLeave={e => {
          if (!disabled) e.currentTarget.style.background = baseBg
          onMouseLeave?.(e)
        }}
        {...props}
      />
    )
  }
)
Btn.displayName = "Btn"
