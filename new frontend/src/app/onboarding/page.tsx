"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { BookOpen, Sparkles, Zap, ArrowRight } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/motion";

const STEPS = [
  {
    icon: BookOpen,
    title: "Add a story",
    body: "Paste requirements, upload a doc, or import from Jira. TestSurge understands the intent.",
  },
  {
    icon: Sparkles,
    title: "Generate tests",
    body: "Get functional, negative, boundary, security and performance tests in one click.",
  },
  {
    icon: Zap,
    title: "Catch impact",
    body: "When a story changes, see exactly which tests break — before they reach production.",
  },
];

/** Onboarding intro — the final step before the dashboard. */
export default function OnboardingIntroPage() {
  const router = useRouter();

  function finish() {
    router.push("/stories");
    router.refresh();
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8"
      >
        <div className="text-center mb-6">
          <span className="text-2xl font-bold" style={{ color: "#FF0A78" }}>
            You&apos;re all set 🎉
          </span>
          <p className="text-sm text-gray-500 mt-2">Here&apos;s how teams get value from TestSurge.</p>
        </div>

        <motion.ul
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3 mb-7"
        >
          {STEPS.map((s) => {
            const Icon = s.icon;
            return (
              <motion.li
                key={s.title}
                variants={fadeInUp}
                className="flex items-start gap-3 p-3 rounded-card border border-border"
              >
                <span className="w-9 h-9 rounded-lg bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
                  <Icon size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-navy">{s.title}</p>
                  <p className="text-xs text-muted mt-0.5">{s.body}</p>
                </div>
              </motion.li>
            );
          })}
        </motion.ul>

        <button
          type="button"
          onClick={finish}
          className="w-full py-2.5 text-sm font-semibold text-white rounded-lg transition-colors inline-flex items-center justify-center gap-2"
          style={{ backgroundColor: "#FF0A78" }}
        >
          Go to dashboard <ArrowRight size={16} />
        </button>
      </motion.div>
    </div>
  );
}
