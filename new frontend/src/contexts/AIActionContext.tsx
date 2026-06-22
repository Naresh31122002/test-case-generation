"use client";

/**
 * Global AI-action layer.
 *
 * Every AI-powered action in the app must run through `runAIAction`, which:
 *   1. Shows a confirmation modal (Action Name · Estimated Credits · Description
 *      · Cancel · Proceed) so the user always sees cost before execution.
 *   2. Runs the async work with loading/error handling.
 *   3. Deducts the consumed credits from the shared ledger.
 *   4. Fires a toast showing Credits Consumed + Remaining Credits.
 *
 * No AI action should bypass this — call `useAIAction().runAIAction(...)`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  X,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { get as apiGet } from "@/lib/apiClient";

/* ───────────────────────── Credit ledger ───────────────────────── */
//
// Real per-workspace usage, fetched from GET /api/workspaces/current/credits
// (backed by CreditsModel / workspace_credits table). Starts at a sane
// default and refreshes after every AI action so the indicator never shows
// another tenant's numbers or a stale hardcoded constant.

const FALLBACK_CREDITS_TOTAL = 200;

/** Canonical cost catalog — single source of truth for AI action pricing. */
export const AI_ACTION_COSTS = {
  generateTests: 1,
  impactAnalysis: 1,
  coverageAnalysis: 1,
  bulkProcessing: 5,
} as const;

/* ───────────────────────── Public API types ───────────────────────── */

export interface AIActionConfig {
  /** Display name, e.g. "Generate Tests". */
  name: string;
  /** Estimated credits this action will consume. */
  credits: number;
  /** One-line explanation shown in the modal. */
  description: string;
  /** The async work to perform once the user proceeds. */
  run: () => Promise<void>;
}

interface Toast {
  id: string;
  variant: "success" | "error";
  title: string;
  detail?: string;
}

interface AIActionContextValue {
  creditsUsed: number;
  creditsTotal: number;
  creditsRemaining: number;
  /** Confirm → run → consume credits → toast. Returns true if it completed. */
  runAIAction: (config: AIActionConfig) => void;
  /** Fire a standalone toast (used internally; exposed for convenience). */
  notify: (toast: Omit<Toast, "id">) => void;
}

const AIActionContext = createContext<AIActionContextValue | null>(null);

/* ───────────────────────── Provider ───────────────────────── */

type Phase = "idle" | "loading" | "error";

interface CreditUsageResponse {
  credits: { limit: number; used: number; remaining: number };
}

export function AIActionProvider({ children }: { children: ReactNode }) {
  const [creditsUsed, setCreditsUsed] = useState(0);
  const [creditsTotal, setCreditsTotal] = useState(FALLBACK_CREDITS_TOTAL);
  const [pending, setPending] = useState<AIActionConfig | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const refreshCredits = useCallback(async () => {
    try {
      const data = await apiGet<CreditUsageResponse>("/api/workspaces/current/credits");
      setCreditsUsed(data.credits.used);
      setCreditsTotal(data.credits.limit);
    } catch {
      // Best-effort — keep last known values (or the fallback) on failure.
    }
  }, []);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const creditsRemaining = creditsTotal - creditsUsed;

  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = `t-${idRef.current++}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const runAIAction = useCallback((config: AIActionConfig) => {
    setPending(config);
    setPhase("idle");
    setError("");
  }, []);

  const close = useCallback(() => {
    if (phase === "loading") return; // don't close mid-flight
    setPending(null);
    setPhase("idle");
    setError("");
  }, [phase]);

  const proceed = useCallback(async () => {
    if (!pending) return;
    setPhase("loading");
    setError("");
    try {
      await pending.run();
      // The backend already deducted real credits during pending.run() (via
      // CreditsModel.check_and_deduct_credit) — refetch rather than guess
      // locally, so the indicator always reflects the true workspace balance.
      await refreshCredits();
      const completedName = pending.name;
      const consumed = pending.credits;
      setPending(null);
      setPhase("idle");
      notify({
        variant: "success",
        title: `${completedName} complete`,
        detail: `~${consumed} credits consumed`,
      });
    } catch (err) {
      setError((err as Error)?.message || "Something went wrong. Please try again.");
      setPhase("error");
    }
  }, [pending, refreshCredits, notify]);

  return (
    <AIActionContext.Provider
      value={{
        creditsUsed,
        creditsTotal,
        creditsRemaining,
        runAIAction,
        notify,
      }}
    >
      {children}

      {/* Confirmation modal */}
      <AnimatePresence>
        {pending && (
          <ConfirmModal
            config={pending}
            phase={phase}
            error={error}
            remaining={creditsRemaining}
            onCancel={close}
            onProceed={proceed}
          />
        )}
      </AnimatePresence>

      {/* Toaster */}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </AIActionContext.Provider>
  );
}

export function useAIAction(): AIActionContextValue {
  const ctx = useContext(AIActionContext);
  if (!ctx) throw new Error("useAIAction must be used within AIActionProvider");
  return ctx;
}

/* ───────────────────────── Confirmation modal ───────────────────────── */

function ConfirmModal({
  config,
  phase,
  error,
  remaining,
  onCancel,
  onProceed,
}: {
  config: AIActionConfig;
  phase: Phase;
  error: string;
  remaining: number;
  onCancel: () => void;
  onProceed: () => void;
}) {
  const insufficient = config.credits > remaining;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-navy/20 px-4"
      onMouseDown={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md bg-white border border-border rounded-card shadow-card overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-surface-pink text-pink flex items-center justify-center">
              <Sparkles size={15} />
            </span>
            <h2 className="text-base font-semibold text-navy">{config.name}</h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={phase === "loading"}
            className="text-muted hover:text-navy transition-colors disabled:opacity-40"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">{config.description}</p>

          {/* Estimated credits */}
          <div className="flex items-center justify-between p-3 rounded-card bg-brand-primary-light/40 border border-brand-primary">
            <div className="flex items-center gap-2 text-sm font-medium text-navy">
              <Zap size={15} className="text-pink" />
              Estimated cost
            </div>
            <span className="text-sm font-bold text-pink tabular-nums">
              ~{config.credits} Credits
            </span>
          </div>

          <p className="text-[11px] text-muted text-right -mt-1">
            {remaining} credits remaining
          </p>

          {insufficient && (
            <p className="text-xs text-error flex items-center gap-1.5">
              <AlertTriangle size={13} />
              Not enough credits for this action.
            </p>
          )}

          {phase === "error" && (
            <p className="text-xs text-error flex items-center gap-1.5">
              <AlertTriangle size={13} />
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={phase === "loading"}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onProceed}
              disabled={phase === "loading" || insufficient}
              className="h-9 px-5 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
            >
              {phase === "loading" && <Loader2 size={15} className="animate-spin" />}
              {phase === "loading" ? "Processing…" : phase === "error" ? "Retry" : "Proceed"}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ───────────────────────── Toaster ───────────────────────── */

const TOAST_ICON: Record<Toast["variant"], LucideIcon> = {
  success: CheckCircle2,
  error: AlertTriangle,
};

function Toaster({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const Icon = TOAST_ICON[t.variant];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
              className="pointer-events-auto w-[340px] max-w-[calc(100vw-2rem)] bg-white border border-border rounded-card shadow-card flex items-start gap-3 px-4 py-3"
            >
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                  t.variant === "success"
                    ? "bg-[#ECFDF5] text-success"
                    : "bg-[#FEF2F2] text-error"
                }`}
              >
                <Icon size={15} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy">{t.title}</p>
                {t.detail && <p className="text-xs text-muted mt-0.5">{t.detail}</p>}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="text-muted hover:text-navy transition-colors flex-shrink-0"
                aria-label="Dismiss"
              >
                <X size={15} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
