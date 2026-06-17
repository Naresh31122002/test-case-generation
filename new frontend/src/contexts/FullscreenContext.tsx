"use client";

/**
 * Full Screen Reading Mode (Notion/Jira-style).
 *
 * When active, the app hides chrome — main sidebar, any secondary sidebar, and
 * page header — and lets the content take the full viewport width. The state
 * lives at the root so it persists across in-app navigation until the user
 * exits (toggle button or ESC). A floating exit control is always rendered
 * while active.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Minimize2 } from "lucide-react";

interface FullscreenContextValue {
  fullscreen: boolean;
  enter: () => void;
  exit: () => void;
  toggle: () => void;
}

const FullscreenContext = createContext<FullscreenContextValue | null>(null);

export function FullscreenProvider({ children }: { children: ReactNode }) {
  const [fullscreen, setFullscreen] = useState(false);

  const enter = useCallback(() => setFullscreen(true), []);
  const exit = useCallback(() => setFullscreen(false), []);
  const toggle = useCallback(() => setFullscreen((v) => !v), []);

  // ESC exits fullscreen (Notion/Jira behavior).
  useEffect(() => {
    if (!fullscreen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setFullscreen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <FullscreenContext.Provider value={{ fullscreen, enter, exit, toggle }}>
      {children}

      {/* Floating restore control — always available while in fullscreen. */}
      <AnimatePresence>
        {fullscreen && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            onClick={exit}
            title="Exit full screen (Esc)"
            className="fixed top-4 right-4 z-[85] inline-flex items-center gap-2 h-9 px-3 rounded-btn border border-border bg-white text-sm font-medium text-navy shadow-card hover:bg-gray-50 transition-colors"
          >
            <Minimize2 size={15} />
            Exit Full Screen
            <kbd className="text-[10px] font-semibold text-muted border border-border rounded px-1 py-0.5 ml-0.5">
              ESC
            </kbd>
          </motion.button>
        )}
      </AnimatePresence>
    </FullscreenContext.Provider>
  );
}

export function useFullscreen(): FullscreenContextValue {
  const ctx = useContext(FullscreenContext);
  if (!ctx) throw new Error("useFullscreen must be used within FullscreenProvider");
  return ctx;
}
