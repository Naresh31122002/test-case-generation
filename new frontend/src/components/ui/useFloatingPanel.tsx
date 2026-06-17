"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

export type Placement = "bottom" | "top";

interface FloatingPosition {
  /** Fixed-position coordinates (viewport space). */
  top: number;
  left: number;
  /** Resolved placement after collision detection. */
  placement: Placement;
}

interface UseFloatingPanelOptions {
  /** Preferred side; flips to the other if there isn't room. Default "bottom". */
  preferred?: Placement;
  /** Gap between the trigger and the panel, in px. Default 6. */
  gap?: number;
  /** Viewport padding kept clear on every edge, in px. Default 8. */
  viewportPadding?: number;
}

/**
 * Smart floating-panel positioning.
 *
 * Anchors a fixed-position panel to a trigger element, measures the available
 * space above/below, flips to the side with room (never overflows the viewport),
 * and clamps horizontally to stay on-screen. The panel is rendered through a
 * portal so it is never clipped by an ancestor's `overflow: hidden`.
 *
 * Usage:
 *   const { triggerRef, panelRef, position, open, setOpen, Portal } = useFloatingPanel();
 *   <div ref={triggerRef} onMouseEnter={() => setOpen(true)} ... />
 *   {open && <Portal><div ref={panelRef} style={{ ... }}>…</div></Portal>}
 */
export function useFloatingPanel<
  T extends HTMLElement = HTMLDivElement,
  P extends HTMLElement = HTMLDivElement,
>(options: UseFloatingPanelOptions = {}) {
  const { preferred = "bottom", gap = 6, viewportPadding = 8 } = options;
  const triggerRef = useRef<T>(null);
  const panelRef = useRef<P>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const compute = useCallback(() => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const t = trigger.getBoundingClientRect();
    const panelH = panel.offsetHeight;
    const panelW = panel.offsetWidth;
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const spaceBelow = vh - t.bottom - gap;
    const spaceAbove = t.top - gap;

    // Prefer the requested side; flip only if it doesn't fit but the other does.
    let placement: Placement = preferred;
    if (preferred === "bottom" && spaceBelow < panelH && spaceAbove > spaceBelow) {
      placement = "top";
    } else if (preferred === "top" && spaceAbove < panelH && spaceBelow > spaceAbove) {
      placement = "bottom";
    }

    let top =
      placement === "bottom" ? t.bottom + gap : t.top - gap - panelH;
    // Clamp vertically so the panel never leaves the viewport.
    top = Math.max(viewportPadding, Math.min(top, vh - panelH - viewportPadding));

    // Left-align to the trigger, then clamp horizontally.
    let left = t.left;
    left = Math.max(viewportPadding, Math.min(left, vw - panelW - viewportPadding));

    setPosition({ top, left, placement });
  }, [preferred, gap, viewportPadding]);

  // Recompute on open, and on scroll/resize while open.
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    compute();
    const onChange = () => compute();
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    return () => {
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
    };
  }, [open, compute]);

  const Portal = useCallback(
    ({ children }: { children: React.ReactNode }) =>
      typeof document === "undefined"
        ? null
        : createPortal(children, document.body),
    []
  );

  return { triggerRef, panelRef, position, open, setOpen, Portal } as const;
}
