"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom";
}) {
  const [show, setShow] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: side });
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  function computeCoords() {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const TOOLTIP_HEIGHT = 60;
    const TOOLTIP_WIDTH = 280;
    const GAP = 8;

    // Determine best placement: prefer `side`, flip if no room
    let placement = side;
    if (side === "top" && rect.top < TOOLTIP_HEIGHT + GAP) placement = "bottom";
    if (side === "bottom" && rect.bottom + TOOLTIP_HEIGHT + GAP > window.innerHeight) placement = "top";

    const top = placement === "top"
      ? rect.top + window.scrollY - TOOLTIP_HEIGHT - GAP
      : rect.bottom + window.scrollY + GAP;

    // Center horizontally, clamp to viewport
    let left = rect.left + window.scrollX + rect.width / 2 - TOOLTIP_WIDTH / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));

    setCoords({ top, left, placement });
  }

  function handleEnter() {
    computeCoords();
    setShow(true);
  }

  return (
    <>
      <span
        ref={triggerRef}
        className="relative inline-flex"
        onMouseEnter={handleEnter}
        onMouseLeave={() => setShow(false)}
        onFocus={handleEnter}
        onBlur={() => setShow(false)}
      >
        {children}
      </span>
      {mounted && createPortal(
        <AnimatePresence>
          {show && (
            <motion.div
              initial={{ opacity: 0, y: coords.placement === "top" ? 4 : -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              style={{ position: "absolute", top: coords.top, left: coords.left, zIndex: 9999 }}
              className="w-max max-w-[280px] bg-[#0F172A] text-white text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-xl pointer-events-none"
            >
              {content}
              {/* Arrow */}
              <span
                className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-[#0F172A] rotate-45 ${
                  coords.placement === "top" ? "-bottom-1" : "-top-1"
                }`}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
