"use client";
import { useState } from "react";
import { X, ChevronRight, type LucideIcon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface FeatureIntroCardProps {
  storageKey: string;  // unique key to remember if user dismissed
  icon: LucideIcon;
  title: string;
  description: string;
  learnMoreItems?: { icon: LucideIcon; label: string; desc: string }[];
}

export function FeatureIntroCard({ storageKey, icon: Icon, title, description, learnMoreItems }: FeatureIntroCardProps) {
  const [dismissed, setDismissed] = useState(() => {
    try {
      // Always dismissed if tour was completed (returning user)
      const tourDone = localStorage.getItem('testsurge_tour_completed') === '1';
      if (tourDone) return true;
      return localStorage.getItem(`intro_dismissed_${storageKey}`) === '1';
    } catch { return false; }
  });
  const [expanded, setExpanded] = useState(false);

  function dismiss() {
    try { localStorage.setItem(`intro_dismissed_${storageKey}`, '1'); } catch {}
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8, height: 0 }}
        transition={{ duration: 0.25 }}
        className="relative bg-gradient-to-r from-cyan/5 to-pink/5 border border-cyan/20 rounded-xl p-4 mb-5"
      >
        <button onClick={dismiss} className="absolute top-3 right-3 text-muted hover:text-navy transition-colors" aria-label="Dismiss">
          <X size={14} />
        </button>
        <div className="flex items-start gap-3 pr-6">
          <div className="w-9 h-9 rounded-lg bg-white border border-border flex items-center justify-center flex-shrink-0">
            <Icon size={18} className="text-cyan" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-navy mb-0.5">{title}</p>
            <p className="text-xs text-muted leading-relaxed">{description}</p>
            {learnMoreItems && (
              <button onClick={() => setExpanded(v => !v)} className="mt-2 text-[11px] text-cyan hover:underline flex items-center gap-1">
                {expanded ? 'Show less' : 'How does this work?'}
                <ChevronRight size={10} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
              </button>
            )}
          </div>
        </div>
        <AnimatePresence>
          {expanded && learnMoreItems && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {learnMoreItems.map((item, i) => {
                  const ItemIcon = item.icon;
                  return (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-white/60">
                      <ItemIcon size={14} className="text-cyan flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-semibold text-navy">{item.label}</p>
                        <p className="text-[10px] text-muted leading-snug">{item.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}
