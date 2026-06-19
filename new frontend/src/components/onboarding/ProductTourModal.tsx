"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Sparkles, BookOpen, GitPullRequest, PieChart, GitCompare,
  Download, Zap, Plus, CheckCircle2, FileCode2, PlayCircle, Bug,
  type LucideIcon,
} from "lucide-react";

/**
 * Guided product tour. Spotlights real sidebar/header elements for the
 * "where things live" steps, then switches to self-contained mock-data
 * slides for the deeper generate -> tests -> code -> run workflow (driving
 * the real multi-step wizards live is fragile to script reliably, so those
 * stages are shown as realistic static previews inside the same modal).
 *
 * Anchors are matched via [data-tour="..."] attributes on real elements
 * (Sidebar.tsx, HeaderActions.tsx). Steps without an anchor render centered.
 */

type Step = {
  anchor?: string; // data-tour value to spotlight; omitted = centered card
  title: string;
  body: string;
  icon: LucideIcon;
  placement?: "right" | "bottom" | "center";
  /** Renders a mock preview of a workflow stage instead of plain text. */
  preview?: "story" | "tests" | "code" | "run";
};

const STEPS: Step[] = [
  {
    title: "Welcome to TestSurge",
    body: "From a Jira story to executable test scripts — here's the full workflow in under two minutes.",
    icon: Sparkles,
    placement: "center",
  },
  {
    anchor: "nav-stories",
    title: "Stories",
    body: "Every requirement you import or paste lands here — with AI-detected risk and coverage at a glance.",
    icon: BookOpen,
    placement: "right",
  },
  {
    anchor: "nav-changes",
    title: "Change Impact",
    body: "When a story's acceptance criteria change mid-sprint, TestSurge flags exactly which existing tests are affected.",
    icon: GitPullRequest,
    placement: "right",
  },
  {
    anchor: "nav-coverage",
    title: "Coverage",
    body: "See functional, negative, boundary, security, and performance coverage broken down per story and project.",
    icon: PieChart,
    placement: "right",
  },
  {
    anchor: "nav-compare",
    title: "Compare",
    body: "Diff two versions of a story side-by-side to see what changed and why tests were flagged.",
    icon: GitCompare,
    placement: "right",
  },
  {
    anchor: "nav-exports",
    title: "Exports",
    body: "Push generated test cases to Excel, CSV, TestRail, or Jira (Zephyr/Xray) — no copy-pasting.",
    icon: Download,
    placement: "right",
  },
  {
    anchor: "header-new-story",
    title: "Start from a requirement",
    body: "Paste a story, upload a doc, or import from Jira. AI critiques it for ambiguity before generating anything.",
    icon: Plus,
    placement: "bottom",
  },
  {
    title: "AI generates the story",
    body: "TestSurge turns raw requirements into a structured user story with clear acceptance criteria.",
    icon: BookOpen,
    placement: "center",
    preview: "story",
  },
  {
    title: "5 test types, one click",
    body: "Functional, negative, boundary, security, and performance test cases — generated together, fully editable.",
    icon: CheckCircle2,
    placement: "center",
    preview: "tests",
  },
  {
    title: "Executable code, not just text",
    body: "Every test case can generate real Selenium/Playwright code with Page Object classes — ready to run in CI.",
    icon: FileCode2,
    placement: "center",
    preview: "code",
  },
  {
    title: "Run it and see results",
    body: "Execute generated scripts directly and get pass/fail status, logs, and a recording — no separate runner needed.",
    icon: PlayCircle,
    placement: "center",
    preview: "run",
  },
  {
    anchor: "header-credits",
    title: "Credits",
    body: "Every AI action — generation, impact analysis, story critique — draws from your monthly credit pool. Track usage here.",
    icon: Zap,
    placement: "bottom",
  },
  {
    anchor: "header-notifications",
    title: "Stay informed",
    body: "Get notified the moment a generation finishes or an impact is detected — no need to keep the tab open.",
    icon: Bug,
    placement: "bottom",
  },
  {
    title: "You're all set",
    body: "That's the full loop: requirement in, executable tests out. Create your first real project whenever you're ready.",
    icon: Sparkles,
    placement: "center",
  },
];

const STORAGE_KEY = "testsurge:tour-seen";

/** Has the user already seen (or explicitly skipped) the tour? */
export function hasSeenTour(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

function markTourSeen() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
}

function useAnchorRect(anchorKey: string | undefined, step: number) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!anchorKey) {
      setRect(null);
      return;
    }
    function measure() {
      const el = document.querySelector(`[data-tour="${anchorKey}"]`);
      setRect(el ? el.getBoundingClientRect() : null);
    }
    measure();
    // Sidebar width animates (hover-expand) and layout can shift — remeasure
    // for a short window after the step changes, then settle.
    const id = window.setInterval(measure, 80);
    const stop = window.setTimeout(() => window.clearInterval(id), 600);
    window.addEventListener("resize", measure);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
      window.removeEventListener("resize", measure);
    };
  }, [anchorKey, step]);

  return rect;
}

/** Card dimensions used for viewport-clamped positioning (keeps in sync with
 *  the actual rendered max-width classes below). */
const CARD_WIDTH = 384; // max-w-sm
const PREVIEW_CARD_WIDTH = 672; // max-w-2xl
const VIEWPORT_MARGIN = 16;

export function ProductTourModal({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const rect = useAnchorRect(current.anchor, step);
  const cardRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ w: 0, h: 0 });

  useEffect(() => {
    function measure() {
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  function finish() {
    markTourSeen();
    onDone();
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  // Card position: anchored near the spotlighted element, clamped so it
  // never renders past the viewport edge (right, bottom, or top).
  const cardWidth = current.preview ? PREVIEW_CARD_WIDTH : CARD_WIDTH;
  let cardStyle: React.CSSProperties = {};
  if (rect && viewport.w > 0 && current.placement === "right") {
    const fitsRight = rect.right + VIEWPORT_MARGIN + cardWidth <= viewport.w;
    const left = fitsRight
      ? rect.right + 16
      : Math.max(VIEWPORT_MARGIN, rect.left - cardWidth - 16); // fall back to the left side
    const top = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.top),
      viewport.h - VIEWPORT_MARGIN - 220 // leave room for card height
    );
    cardStyle = { position: "fixed", top, left };
  } else if (rect && viewport.w > 0 && current.placement === "bottom") {
    const left = Math.min(
      Math.max(VIEWPORT_MARGIN, rect.right - cardWidth),
      viewport.w - cardWidth - VIEWPORT_MARGIN
    );
    cardStyle = { position: "fixed", top: rect.bottom + 12, left };
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100]"
      >
        {/* Dim overlay. When an element is spotlighted, its box-shadow IS the
            dim layer with a true cut-out (so the highlighted element renders
            at full brightness, not tinted) — no separate flat overlay div,
            which would otherwise paint over and wash out the spotlighted area. */}
        {rect ? (
          <motion.div
            key={`spot-${step}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed rounded-xl ring-4"
            style={{
              top: rect.top - 6,
              left: rect.left - 6,
              width: rect.width + 12,
              height: rect.height + 12,
              boxShadow: "0 0 0 4000px rgba(15,23,42,0.55)",
              borderColor: "var(--color-brand-primary)",
              pointerEvents: "none",
            }}
          />
        ) : (
          <div className="fixed inset-0 bg-navy/50" style={{ pointerEvents: "none" }} />
        )}

        {/* Click-catcher behind the card so the rest of the app stays inert */}
        <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

        <motion.div
          key={`card-${step}`}
          ref={cardRef}
          initial={{ opacity: 0, y: 12, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.98 }}
          transition={{ duration: 0.2 }}
          className={
            current.placement === "center" || !rect
              ? "fixed inset-0 flex items-center justify-center px-4"
              : ""
          }
          style={current.placement === "center" || !rect ? undefined : cardStyle}
        >
          <div
            className={`bg-white rounded-2xl shadow-2xl border border-border overflow-hidden ${
              current.preview ? "w-full max-w-2xl" : "w-full max-w-sm"
            }`}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              <span className="w-9 h-9 rounded-lg bg-brand-primary-light text-brand-primary flex items-center justify-center flex-shrink-0">
                <current.icon size={18} />
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] font-semibold text-muted tabular-nums">
                  {step + 1} / {STEPS.length}
                </span>
                <button
                  type="button"
                  onClick={finish}
                  aria-label="Close tour"
                  className="text-muted hover:text-navy transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="px-5 pt-3">
              <h3 className="text-base font-semibold text-navy">{current.title}</h3>
              <p className="text-sm text-muted mt-1 leading-relaxed">{current.body}</p>
            </div>

            {current.preview && (
              <div className="px-5 mt-4">
                <TourPreview kind={current.preview} />
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 mt-2">
              <div className="flex items-center gap-1.5">
                {STEPS.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? 18 : 6,
                      background: i === step ? "var(--color-brand-primary)" : "#E2E8F0",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <button type="button" onClick={finish} className="text-sm font-medium text-muted hover:text-navy">
                  Skip tour
                </button>
                {step > 0 && (
                  <button
                    type="button"
                    onClick={back}
                    className="h-9 px-4 rounded-lg border border-border text-sm font-medium text-navy hover:bg-gray-50 transition-colors"
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  onClick={next}
                  className="h-9 px-4 rounded-lg text-sm font-semibold text-white transition-colors"
                  style={{ backgroundColor: "var(--color-brand-primary)" }}
                >
                  {step === STEPS.length - 1 ? "Finish tour" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

/* ---------------- Mock workflow previews (static, no live data) ---------------- */

function TourPreview({ kind }: { kind: "story" | "tests" | "code" | "run" }) {
  if (kind === "story") {
    return (
      <div className="rounded-card border border-border bg-gray-50/60 p-4">
        <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">US-014 · Checkout</p>
        <p className="text-sm font-semibold text-navy">Apply discount code at checkout</p>
        <p className="text-xs text-muted mt-1.5 leading-relaxed">
          As a shopper, I want to apply a discount code during checkout, so that I pay the
          correct discounted price before confirming my order.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {["Acceptance criteria: 4", "Risk: Medium", "Source: Jira"].map((t) => (
            <span key={t} className="text-[11px] font-medium bg-white border border-border rounded-full px-2 py-0.5 text-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (kind === "tests") {
    const rows = [
      { id: "TC-041", title: "Apply valid discount code reduces total", type: "Functional" },
      { id: "TC-042", title: "Expired discount code is rejected", type: "Negative" },
      { id: "TC-043", title: "Discount code at exactly 0% off", type: "Boundary" },
      { id: "TC-044", title: "Code field rejects script injection", type: "Security" },
    ];
    return (
      <div className="rounded-card border border-border overflow-hidden">
        {rows.map((r, i) => (
          <div
            key={r.id}
            className={`flex items-center gap-3 px-3 py-2 text-xs ${i > 0 ? "border-t border-border" : ""}`}
          >
            <span className="font-mono text-muted flex-shrink-0">{r.id}</span>
            <span className="flex-1 text-navy truncate">{r.title}</span>
            <span className="text-[10px] font-semibold bg-brand-primary-light text-brand-primary rounded-full px-2 py-0.5 flex-shrink-0">
              {r.type}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (kind === "code") {
    return (
      <div className="rounded-card border border-border bg-[#0F172A] p-3 font-mono text-[11px] text-gray-300 overflow-hidden">
        <p><span className="text-[#C792EA]">public class</span> <span className="text-[#82AAFF]">CheckoutDiscountTest</span> {"{"}</p>
        <p className="pl-4"><span className="text-[#C792EA]">@Test</span></p>
        <p className="pl-4"><span className="text-[#C792EA]">public void</span> <span className="text-[#82AAFF]">applyValidCode_reducesTotal</span>() {"{"}</p>
        <p className="pl-8 text-gray-500">// Page Object Model · Selenium · TestNG</p>
        <p className="pl-8">checkoutPage.<span className="text-[#82AAFF]">enterDiscountCode</span>(<span className="text-[#C3E88D]">&quot;SAVE10&quot;</span>);</p>
        <p className="pl-8">assertEquals(checkoutPage.getTotal(), expectedTotal);</p>
        <p className="pl-4">{"}"}</p>
        <p>{"}"}</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-border p-4 flex items-center gap-4">
      <span className="w-10 h-10 rounded-full bg-success/10 text-success flex items-center justify-center flex-shrink-0">
        <CheckCircle2 size={20} />
      </span>
      <div className="flex-1">
        <p className="text-sm font-semibold text-navy">4 / 4 test cases passed</p>
        <p className="text-xs text-muted mt-0.5">Ran in 8.2s · Chrome 124 · Recording available</p>
      </div>
    </div>
  );
}
