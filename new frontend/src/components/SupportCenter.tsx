"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HelpCircle,
  X,
  BookOpen,
  MessageCircle,
  Bug,
  Lightbulb,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";

interface HelpOption {
  icon: LucideIcon;
  title: string;
  detail: string;
}

const options: HelpOption[] = [
  {
    icon: BookOpen,
    title: "Documentation",
    detail: "Guides, API reference and how-tos.",
  },
  {
    icon: MessageCircle,
    title: "Contact Support",
    detail: "Reach our team for help with your account.",
  },
  {
    icon: Bug,
    title: "Report Bug",
    detail: "Something not working? Let us know.",
  },
  {
    icon: Lightbulb,
    title: "Feature Request",
    detail: "Suggest an improvement or new feature.",
  },
];

/**
 * "Need Help?" modal.
 *
 * Two modes:
 *  - Uncontrolled (default): renders its own trigger button for the sidebar footer.
 *  - Controlled: pass `controlledOpen` + `onControlledClose` to drive it from the
 *    global AI launcher (the "Help" menu option) with no extra trigger button.
 */
export function SupportCenter({
  expanded = true,
  controlledOpen,
  onControlledClose,
}: {
  expanded?: boolean;
  controlledOpen?: boolean;
  onControlledClose?: () => void;
}) {
  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (isControlled) {
      if (!v) onControlledClose?.();
    } else {
      setInternalOpen(v);
    }
  };

  return (
    <>
      {!isControlled && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Need Help?"
          className="text-muted hover:text-navy transition-colors flex-shrink-0"
          style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? "auto" : "none" }}
        >
          <HelpCircle size={16} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
            onMouseDown={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-md bg-white border border-border rounded-card shadow-card overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-surface-pink text-pink flex items-center justify-center">
                    <HelpCircle size={15} />
                  </span>
                  <h2 className="text-base font-semibold text-navy">Need Help?</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-muted hover:text-navy transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Options */}
              <div className="p-3 space-y-1.5">
                {options.map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.title}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-card border border-border text-left hover:bg-gray-50 hover:border-pink transition-colors group"
                    >
                      <span className="w-9 h-9 rounded-full bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
                        <Icon size={16} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy">{opt.title}</p>
                        <p className="text-xs text-muted">{opt.detail}</p>
                      </div>
                      <ArrowRight
                        size={15}
                        className="text-muted group-hover:text-pink transition-colors flex-shrink-0"
                      />
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
