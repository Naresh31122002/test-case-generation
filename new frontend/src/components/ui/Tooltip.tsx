"use client";

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * Lightweight hover tooltip matching the existing card/shadow theme.
 * Wraps any trigger element; shows `content` on hover.
 */
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

  const pos =
    side === "top"
      ? "bottom-full mb-2"
      : "top-full mt-2";

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      <AnimatePresence>
        {show && (
          <motion.span
            initial={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: side === "top" ? 4 : -4 }}
            transition={{ duration: 0.12 }}
            className={`absolute left-1/2 -translate-x-1/2 ${pos} z-50 w-max max-w-[240px] bg-navy text-white text-[11px] leading-snug rounded-lg px-2.5 py-1.5 shadow-card pointer-events-none`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
