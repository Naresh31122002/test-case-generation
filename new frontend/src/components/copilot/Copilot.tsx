"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  MessageSquare,
  Zap,
  TestTube2,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { SupportCenter } from "@/components/SupportCenter";

// The chat panel (AI client + streaming) is only needed once opened.
const CopilotPanel = dynamic(
  () => import("./CopilotPanel").then((m) => m.CopilotPanel),
  { ssr: false }
);
import type { CopilotIntent } from "@/lib/ai/types";

/* ---- Launcher menu options ---- */

type LauncherAction =
  | { kind: "panel"; intent: CopilotIntent; prompt: string }
  | { kind: "help" };

interface MenuOption {
  id: string;
  label: string;
  icon: LucideIcon;
  action: LauncherAction;
}

const MENU: MenuOption[] = [
  {
    id: "ask",
    label: "Ask AI",
    icon: MessageSquare,
    action: { kind: "panel", intent: "freeform", prompt: "" },
  },
  {
    id: "impact",
    label: "Explain Impact",
    icon: Zap,
    action: {
      kind: "panel",
      intent: "explain_impact",
      prompt: "Explain the impact analysis for the recent changes.",
    },
  },
  {
    id: "tests",
    label: "Generate Tests",
    icon: TestTube2,
    action: {
      kind: "panel",
      intent: "generate_tests",
      prompt: "Generate the missing tests for this story.",
    },
  },
  {
    id: "help",
    label: "Help",
    icon: HelpCircle,
    action: { kind: "help" },
  },
];

/**
 * Single global AI launcher — fixed bottom-right on every page.
 *
 * The primary button expands a vertical menu (Ask AI · Explain Impact ·
 * Generate Tests · Help). Selecting an option either opens the Copilot panel
 * (optionally pre-seeded with a quick action) or the Help modal. There is only
 * ever one floating control — no overlapping buttons.
 */
export function Copilot() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [panelAction, setPanelAction] = useState<
    { prompt: string; intent: CopilotIntent } | null
  >(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  function choose(option: MenuOption) {
    setMenuOpen(false);
    if (option.action.kind === "help") {
      setHelpOpen(true);
      return;
    }
    const { intent, prompt } = option.action;
    // Pre-seed only when there's a prompt to auto-send (Ask AI stays freeform).
    setPanelAction(prompt ? { prompt, intent } : null);
    setPanelOpen(true);
  }

  // The FAB acts as a toggle: open the menu, or close whatever is open.
  const anythingOpen = menuOpen || panelOpen;
  function onPrimaryClick() {
    if (panelOpen) {
      setPanelOpen(false);
      return;
    }
    setMenuOpen((v) => !v);
  }

  return (
    <>
      {/* Copilot conversation panel */}
      <AnimatePresence>
        {panelOpen && (
          <CopilotPanel
            initialAction={panelAction ?? undefined}
            onClose={() => setPanelOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Help modal (controlled by the launcher) */}
      <SupportCenter
        controlledOpen={helpOpen}
        onControlledClose={() => setHelpOpen(false)}
      />

      {/* Expandable menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Click-away scrim */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 z-[59]"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="fixed bottom-24 right-6 z-[60] w-56 bg-white border border-border rounded-card shadow-card overflow-hidden"
            >
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-surface-pink/40">
                <span className="w-6 h-6 rounded-full bg-pink text-white flex items-center justify-center flex-shrink-0">
                  <Sparkles size={13} />
                </span>
                <span className="text-sm font-semibold text-navy">TestSurge AI</span>
              </div>
              <div className="py-1">
                {MENU.map((option, i) => {
                  const Icon = option.icon;
                  return (
                    <motion.button
                      key={option.id}
                      type="button"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.03 * i, duration: 0.15 }}
                      onClick={() => choose(option)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm font-medium text-navy hover:bg-surface-pink/40 transition-colors"
                    >
                      <span className="w-7 h-7 rounded-full bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
                        <Icon size={15} />
                      </span>
                      {option.label}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Primary AI button — bottom-right, single launcher */}
      <motion.button
        type="button"
        onClick={onPrimaryClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-pink text-white shadow-card flex items-center justify-center"
        aria-label={anythingOpen ? "Close AI menu" : "Open AI menu"}
        aria-expanded={anythingOpen}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={anythingOpen ? "close" : "open"}
            initial={{ opacity: 0, rotate: -90 }}
            animate={{ opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, rotate: 90 }}
            transition={{ duration: 0.15 }}
          >
            {anythingOpen ? <X size={22} /> : <Sparkles size={22} />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
