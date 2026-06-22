"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmState {
  title?: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
}

export function ConfirmModal({
  config,
  onClose,
}: {
  config: ConfirmState | null;
  onClose: () => void;
}) {
  if (!config) return null;

  const { title = "Are you sure?", message, confirmLabel = "Confirm", destructive = true, onConfirm } = config;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12 }}
        className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/20 px-4"
        onMouseDown={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="w-full max-w-sm bg-white border border-border rounded-card shadow-card overflow-hidden"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2">
              {destructive && (
                <span className="w-7 h-7 rounded-full bg-[#FEF2F2] text-error flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={14} />
                </span>
              )}
              <h2 className="text-sm font-semibold text-navy">{title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-navy transition-colors"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>
          <div className="px-5 py-4 space-y-4">
            <p className="text-sm text-muted">{message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onConfirm(); onClose(); }}
                className={`h-9 px-4 rounded-btn text-sm font-medium text-white transition-colors ${
                  destructive ? "bg-error hover:bg-[#dc2626]" : "bg-pink hover:bg-[#e0005f]"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export type { ConfirmState };
