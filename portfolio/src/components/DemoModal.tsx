"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, PlayCircle } from "lucide-react";

export default function DemoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <button
              aria-label="Close demo"
              onClick={onClose}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-text-primary shadow-sm transition-transform hover:scale-105"
            >
              <X size={20} />
            </button>

            <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 bg-text-primary text-white">
              <PlayCircle size={64} className="text-secondary" />
              <p className="font-heading text-xl font-bold">Product demo coming soon</p>
              <p className="max-w-sm text-center text-sm text-gray-300">
                We&apos;re putting the finishing touches on a full TestSurge
                walkthrough — Jira story to generated test cases in 30 seconds.
              </p>
            </div>

            <div className="flex flex-col items-center gap-3 p-6 text-center sm:flex-row sm:justify-between">
              <p className="text-sm text-text-secondary">
                Want to see it live instead?
              </p>
              <a
                href="/signup"
                className="rounded-full bg-secondary px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-transform hover:scale-105"
              >
                Start Free Trial
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
