"use client";

import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Sparkles, ArrowRight, type LucideIcon } from "lucide-react";

/**
 * New Story entry modal — the fork between the two creation paths:
 *   A. Import Existing User Story  → /stories/new   (Jira / Paste / Upload)
 *   B. Generate From Requirements  → /stories/generate (AI: BRD/PRD/SRS → stories)
 */
export function NewStoryModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-lg bg-white border border-border rounded-card shadow-card overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-navy">Create a new story</h2>
              <button type="button" onClick={onClose} className="text-muted hover:text-navy transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 grid gap-3">
              <PathCard
                icon={Upload}
                title="Import Existing User Story"
                description="Paste a story, upload a story file, or import from Jira, then go straight to test generation."
                onClick={() => go("/stories/new")}
              />
              <PathCard
                icon={Sparkles}
                title="Generate User Stories From Requirements"
                description="Upload a BRD, PRD, SRS or requirement doc. AI extracts features, actors and rules, then drafts structured user stories for you to review."
                badge="AI"
                onClick={() => go("/stories/generate")}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function PathCard({
  icon: Icon,
  title,
  description,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-start gap-4 p-4 rounded-card border border-border text-left hover:border-pink hover:bg-surface-pink/30 transition-colors"
    >
      <span className="w-10 h-10 rounded-full bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
        <Icon size={20} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-navy">{title}</p>
          {badge && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink text-white">{badge}</span>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
      <ArrowRight size={16} className="text-muted group-hover:text-pink transition-colors flex-shrink-0 mt-0.5" />
    </button>
  );
}
