"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";

// The chat panel (AI client + streaming) is only needed once opened.
const CopilotPanel = dynamic(
  () => import("./CopilotPanel").then((m) => m.CopilotPanel),
  { ssr: false }
);

/**
 * Single global AI launcher — fixed bottom-right on every page.
 *
 * Clicking the button opens the Copilot panel directly. The panel already
 * surfaces quick actions (Ask about story/tests/coverage, Explain impact,
 * Generate tests) and a composer, so there is no separate launcher menu.
 */
export function Copilot() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Copilot conversation panel */}
      <AnimatePresence>
        {open && <CopilotPanel onClose={() => setOpen(false)} />}
      </AnimatePresence>

      {/* Primary AI button — bottom-right */}
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-pink text-white shadow-card flex items-center justify-center"
        aria-label={open ? "Close Copilot" : "Open Copilot"}
        aria-expanded={open}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "open"}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.15 }}
          >
            {open ? <X size={22} /> : <Sparkles size={22} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
