"use client";

import { type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import { HeaderActions } from "@/components/HeaderActions";
import { useFullscreen } from "@/contexts/FullscreenContext";

/**
 * Standard page layout system.
 *
 * Every page wraps its content in <PageLayout> and its header in <PageHeader>,
 * with right-side controls in <PageActions>. This guarantees a single,
 * width-constrained layout across the whole app:
 *
 *   - Max width 1600px, centered, full width.
 *   - Responsive padding: 16px mobile / 20px tablet / 24px desktop.
 *   - Header is flex space-between; actions never overflow the container.
 *
 * No visual redesign — only spacing, alignment, container consistency.
 */

/* ---------------- FullscreenButton ---------------- */

/**
 * Top-right "Full Screen" toggle for reading mode. Enters Full Screen Reading
 * Mode (hides chrome, expands content). Exit is handled by the floating control
 * and ESC inside FullscreenProvider.
 */
export function FullscreenButton() {
  const { enter } = useFullscreen();
  return (
    <button
      type="button"
      onClick={enter}
      title="Full screen reading mode"
      className="flex-shrink-0 inline-flex items-center gap-2 h-9 px-3 rounded-btn border border-border bg-white text-sm font-medium text-navy hover:bg-gray-50 transition-colors whitespace-nowrap"
    >
      <Maximize2 size={15} />
      Full Screen
    </button>
  );
}

/* ---------------- PageActions ---------------- */

/**
 * Right-side actions container.
 * Desktop: single row (gap 12px). Tablet: wraps. Mobile: stacks under title.
 *
 * Pass `primary` for an optional primary action (e.g. New Story); the global
 * HeaderActions (Project Selector · Credits · Notifications) always render.
 * Pass `fullscreen` to include the Full Screen reading-mode toggle.
 */
export function PageActions({
  primary,
  fullscreen,
}: {
  primary?: ReactNode;
  fullscreen?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-3 w-full sm:w-auto">
      {primary}
      {fullscreen && <FullscreenButton />}
      <HeaderActions />
    </div>
  );
}

/* ---------------- PageHeader ---------------- */

export function PageHeader({
  title,
  subtitle,
  actions,
  /** Optional element rendered before the title (e.g. back arrow / breadcrumb). */
  leading,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  leading?: ReactNode;
}) {
  const { fullscreen } = useFullscreen();
  // In Full Screen Reading Mode the header chrome is hidden.
  if (fullscreen) return null;

  return (
    <div className="sticky top-0 z-30 bg-white border-b border-border">
      <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-5 lg:px-6 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          {/* Left: title + optional subtitle */}
          <div className="min-w-0 flex items-center gap-3">
            {leading}
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold text-navy leading-tight truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted truncate">{subtitle}</p>
              )}
            </div>
          </div>

          {/* Right: actions */}
          {actions}
        </div>
      </div>
    </div>
  );
}

/* ---------------- PageLayout ---------------- */

export function PageLayout({ children }: { children: ReactNode }) {
  return <div className="flex flex-col h-full">{children}</div>;
}

/* ---------------- PageBody ---------------- */

/** The scrollable, width-constrained content region beneath the header. */
export function PageBody({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`mx-auto w-full max-w-[1600px] px-4 sm:px-5 lg:px-6 py-6 ${className}`}>
        {children}
      </div>
    </div>
  );
}
