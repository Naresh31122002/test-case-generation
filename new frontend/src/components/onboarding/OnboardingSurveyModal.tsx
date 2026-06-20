"use client";

import { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { completeOnboarding } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";

const JOB_TITLES = [
  "Developer",
  "Tester",
  "Product Owner",
  "Business Analyst",
  "Product Manager",
  "Others",
] as const;

const REFERRAL_SOURCES = [
  "Facebook",
  "Instagram",
  "News/Article/Blog",
  "LinkedIn",
  "Web Search",
  "YouTube",
  "Referral",
  "Others",
] as const;

const STEPS = 3;

/**
 * First-login-only survey modal (org name -> job title -> referral source).
 * Skippable at any point. Once submitted or skipped, /auth/onboarding marks
 * the user's onboarding_completed_at so this never renders again — the
 * gating check (AuthUser.onboardingCompleted) lives in the caller.
 */
export function OnboardingSurveyModal({ onDone }: { onDone: () => void }) {
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [jobTitle, setJobTitle] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    try {
      await completeOnboarding({
        orgName: orgName.trim() || undefined,
        jobTitle: jobTitle ?? undefined,
        referralSource: referralSource ?? undefined,
      });
    } catch {
      // Best-effort — never block the user from reaching the dashboard.
    } finally {
      await refresh();
      onDone();
    }
  }

  function next() {
    if (step < STEPS - 1) setStep(step + 1);
    else finish();
  }

  function back() {
    if (step > 0) setStep(step - 1);
  }

  /** Skip just this step and move on — only closes the modal on the last step. */
  function skip() {
    if (step < STEPS - 1) setStep(step + 1);
    else finish();
  }

  // Org name is free text (optional); job title / referral require a pick.
  const canProceed =
    step === 0 ? true : step === 1 ? jobTitle !== null : referralSource !== null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-navy/40 backdrop-blur-sm px-4"
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 px-8 pt-6">
            <p className="text-sm text-muted">
              Welcome aboard! Start your journey with TestSurge — just fill out the form and you&apos;re on your way!
            </p>
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                {Array.from({ length: STEPS }).map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      width: i === step ? 28 : 14,
                      background: i === step ? "var(--color-brand-primary)" : "#E2E8F0",
                    }}
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={finish}
                aria-label="Close"
                className="text-muted hover:text-navy transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Logo */}
          <div className="flex justify-center pt-8">
            <div className="flex items-center gap-1.5">
              <Image src="/icon.png" alt="TestSurge" width={36} height={36} className="rounded-lg" />
              <span className="text-2xl font-bold">
                <span className="text-navy">Test</span>
                <span style={{ color: "var(--color-brand-primary)" }}>Surge</span>
              </span>
            </div>
          </div>

          {/* Step content */}
          <div className="px-8 py-10 min-h-[260px] flex flex-col items-center justify-center">
            <AnimatePresence mode="wait">
              {step === 0 && (
                <motion.div
                  key="org"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="w-full max-w-md text-center"
                >
                  <h2 className="text-2xl font-semibold text-navy mb-6">What&apos;s your organization name?</h2>
                  <input
                    type="text"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="What's your organization name?"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 transition-colors"
                    autoFocus
                  />
                </motion.div>
              )}

              {step === 1 && (
                <motion.div
                  key="job"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="w-full text-center"
                >
                  <h2 className="text-2xl font-semibold text-navy mb-6">What&apos;s your job title?</h2>
                  <div className="grid grid-cols-3 gap-4 max-w-xl mx-auto">
                    {JOB_TITLES.map((title) => (
                      <button
                        key={title}
                        type="button"
                        onClick={() => setJobTitle(title)}
                        className={`px-4 py-3 rounded-card border text-sm font-medium transition-colors ${
                          jobTitle === title
                            ? "border-brand-primary bg-brand-primary-light text-brand-primary"
                            : "border-border hover:border-brand-primary hover:bg-gray-50 text-navy"
                        }`}
                      >
                        {title}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="referral"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="w-full text-center"
                >
                  <h2 className="text-2xl font-semibold text-navy mb-6">How did you hear about us?</h2>
                  <div className="grid grid-cols-4 gap-3 max-w-2xl mx-auto">
                    {REFERRAL_SOURCES.map((source) => (
                      <button
                        key={source}
                        type="button"
                        onClick={() => setReferralSource(source)}
                        className={`px-3 py-3 rounded-card border text-xs font-medium transition-colors ${
                          referralSource === source
                            ? "border-brand-primary bg-brand-primary-light text-brand-primary"
                            : "border-border hover:border-brand-primary hover:bg-gray-50 text-navy"
                        }`}
                      >
                        {source}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-5 px-8 pb-6">
            {step > 0 && (
              <button type="button" onClick={back} className="text-sm font-medium text-muted hover:text-navy">
                Back
              </button>
            )}
            <button type="button" onClick={skip} className="text-sm font-medium text-muted hover:text-navy">
              Skip
            </button>
            <button
              type="button"
              onClick={next}
              disabled={saving || !canProceed}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: "var(--color-brand-primary)" }}
            >
              {step === STEPS - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
