"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

export interface LoadingOverlayProps {
  show: boolean;
  label?: string;
  messages?: string[];
  animated?: boolean;
  fullScreen?: boolean;
  delayMs?: number;
}

const DEFAULT_DELAY_MS = 250;

function useDelayedFlag(on: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(on && delayMs <= 0);
  useEffect(() => {
    if (!on) { setVisible(false); return; }
    if (delayMs <= 0) { setVisible(true); return; }
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [on, delayMs]);
  return visible;
}

const ROTATE_SECONDS = 5;
const BREATHE_SECONDS = 4;
const ICON_SIZE = 26;
const TYPE_MS = 35;
const ERASE_MS = 18;
const HOLD_MS = 1100;

type TypePhase = "typing" | "erasing";

export default function LoadingOverlay({
  show, label, messages, animated = false, fullScreen = false, delayMs = DEFAULT_DELAY_MS,
}: LoadingOverlayProps) {
  const visible = useDelayedFlag(show, delayMs);
  const cycle = messages && messages.length > 0 ? messages : null;
  const sequence = cycle ?? (label ? [label] : []);
  const loop = cycle !== null && cycle.length > 0;
  const seqKey = sequence.join(" ");
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState<TypePhase>("typing");

  useEffect(() => { setIndex(0); setCount(0); setPhase("typing"); }, [visible, seqKey]);

  useEffect(() => {
    if (!animated || !visible || sequence.length === 0) return;
    const full = sequence[index] ?? "";
    const canAdvance = loop || index < sequence.length - 1;
    let t: ReturnType<typeof setTimeout>;
    if (phase === "typing") {
      if (count < full.length) { t = setTimeout(() => setCount((c) => c + 1), TYPE_MS); }
      else if (canAdvance) { t = setTimeout(() => setPhase("erasing"), HOLD_MS); }
      else return;
    } else {
      if (count > 0) { t = setTimeout(() => setCount((c) => c - 1), ERASE_MS); }
      else { setIndex((i) => (i + 1) % sequence.length); setPhase("typing"); return; }
    }
    return () => clearTimeout(t);
  }, [animated, visible, phase, count, index, sequence, loop]);

  const hasText = sequence.length > 0;
  const current = sequence[index] ?? "";
  const typed = animated ? current.slice(0, count) : current;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="loading-overlay"
          role="status" aria-live="polite" aria-busy="true"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={`${fullScreen ? "fixed" : "absolute"} inset-0 z-[100] flex flex-row items-center justify-center gap-2.5 bg-white/80 backdrop-blur-sm`}
        >
          <motion.div className="relative flex-shrink-0"
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: BREATHE_SECONDS, ease: "easeInOut", repeat: Infinity }}>
            <motion.img src="/icon.png" alt="" aria-hidden="true"
              width={ICON_SIZE} height={ICON_SIZE} draggable={false}
              animate={{ rotate: 360 }}
              transition={{ duration: ROTATE_SECONDS, ease: "linear", repeat: Infinity }}
              style={{ width: ICON_SIZE, height: ICON_SIZE,
                filter: "drop-shadow(0 0 5px rgba(255, 59, 107, 0.45)) drop-shadow(0 0 12px rgba(255, 240, 247, 0.9))" }} />
          </motion.div>
          {hasText && (
            <p className="text-sm font-medium text-navy/80 whitespace-nowrap">
              {typed}
              {animated && <span className="ml-0.5 inline-block w-px animate-pulse text-navy/50">▍</span>}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
