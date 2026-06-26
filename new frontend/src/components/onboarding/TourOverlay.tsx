"use client";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { useTour } from "@/contexts/TourContext";

export function TourOverlay() {
  const { tourActive, currentStep, steps, nextStep, prevStep, skipTour, completeTour } = useTour();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const step = steps[currentStep];
  const isLast = currentStep === steps.length - 1;
  const isFirst = currentStep === 0;

  useEffect(() => {
    if (!tourActive || !step?.target) {
      setTargetRect(null);
      return;
    }
    function measure() {
      // Support comma-separated selectors — use first element found
      const selectors = step.target!.split(",").map(s => s.trim());
      let el: Element | null = null;
      for (const sel of selectors) {
        el = document.querySelector(sel);
        if (el) break;
      }
      if (el) setTargetRect(el.getBoundingClientRect());
      else setTargetRect(null);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [tourActive, currentStep, step?.target]);

  if (!tourActive) return null;

  const PAD = 8;
  const highlight = targetRect ? {
    top: targetRect.top - PAD,
    left: targetRect.left - PAD,
    width: targetRect.width + PAD * 2,
    height: targetRect.height + PAD * 2,
  } : null;

  // Position tooltip card
  let cardStyle: React.CSSProperties = { position: "fixed", zIndex: 10001 };
  if (highlight && step.placement) {
    const CARD_W = 320;
    const CARD_H = 180;
    const GAP = 16;
    if (step.placement === "right") {
      cardStyle = { ...cardStyle, top: highlight.top + highlight.height / 2 - CARD_H / 2, left: highlight.left + highlight.width + GAP };
    } else if (step.placement === "left") {
      cardStyle = { ...cardStyle, top: highlight.top + highlight.height / 2 - CARD_H / 2, left: highlight.left - CARD_W - GAP };
    } else if (step.placement === "bottom") {
      cardStyle = { ...cardStyle, top: highlight.top + highlight.height + GAP, left: Math.max(16, highlight.left + highlight.width / 2 - CARD_W / 2) };
    } else {
      cardStyle = { ...cardStyle, bottom: window.innerHeight - highlight.top + GAP, left: Math.max(16, highlight.left + highlight.width / 2 - CARD_W / 2) };
    }
    // Clamp to viewport
    if ((cardStyle.left as number) + CARD_W > window.innerWidth - 16) {
      cardStyle.left = window.innerWidth - CARD_W - 16;
    }
  } else {
    // Center of screen
    cardStyle = { ...cardStyle, top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <AnimatePresence>
      {tourActive && (
        <>
          {/* Dark overlay with cutout */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ position: "fixed", inset: 0, zIndex: 10000, pointerEvents: "none" }}
          >
            {/* Top */}
            {highlight && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: highlight.top, background: "rgba(15,23,42,0.6)" }} />}
            {/* Bottom */}
            {highlight && <div style={{ position: "absolute", top: highlight.top + highlight.height, left: 0, right: 0, bottom: 0, background: "rgba(15,23,42,0.6)" }} />}
            {/* Left */}
            {highlight && <div style={{ position: "absolute", top: highlight.top, left: 0, width: highlight.left, height: highlight.height, background: "rgba(15,23,42,0.6)" }} />}
            {/* Right */}
            {highlight && <div style={{ position: "absolute", top: highlight.top, left: highlight.left + highlight.width, right: 0, height: highlight.height, background: "rgba(15,23,42,0.6)" }} />}
            {/* Full overlay when no target */}
            {!highlight && <div style={{ position: "absolute", inset: 0, background: "rgba(15,23,42,0.7)" }} />}
            {/* Highlight ring */}
            {highlight && (
              <div style={{ position: "absolute", top: highlight.top, left: highlight.left, width: highlight.width, height: highlight.height, borderRadius: 10, boxShadow: "0 0 0 3px #FF0A78, 0 0 0 6px rgba(255,10,120,0.2)", pointerEvents: "none" }} />
            )}
          </motion.div>

          {/* Tour card */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.18 }}
            style={{ ...cardStyle, width: 320, pointerEvents: "auto", zIndex: 10001 }}
            className="bg-white rounded-2xl shadow-2xl border border-border overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-pink/10 flex items-center justify-center">
                  <Sparkles size={14} className="text-pink" />
                </span>
                <span className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                  Step {currentStep + 1} of {steps.length}
                </span>
              </div>
              <button onClick={skipTour} className="text-muted hover:text-navy transition-colors" aria-label="Skip tour">
                <X size={16} />
              </button>
            </div>

            {/* Progress bar */}
            <div className="mx-4 h-1 bg-border rounded-full overflow-hidden mb-3">
              <motion.div
                className="h-full bg-pink rounded-full"
                animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            {/* Content */}
            <div className="px-4 pb-4">
              <h3 className="text-sm font-bold text-navy mb-1.5">{step.title}</h3>
              <p className="text-xs text-muted leading-relaxed">{step.description}</p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-border">
              <button
                onClick={skipTour}
                className="text-xs text-muted hover:text-navy transition-colors"
              >
                Skip tour
              </button>
              <div className="flex items-center gap-2">
                {!isFirst && (
                  <button
                    onClick={prevStep}
                    className="flex items-center gap-1 h-8 px-3 rounded-btn border border-border text-xs text-navy hover:bg-gray-100 transition-colors"
                  >
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                <button
                  onClick={isLast ? completeTour : nextStep}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-btn bg-pink text-white text-xs font-semibold hover:bg-pink/90 transition-colors"
                >
                  {isLast ? "Let's go!" : "Next"}
                  {!isLast && <ChevronRight size={13} />}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
