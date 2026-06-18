"use client";

import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import { Play, FileText, ScanSearch, ListChecks, GitCompareArrows, Download, ChevronRight, ChevronDown } from "lucide-react";
import DemoModal from "@/components/DemoModal";
import { SIGNUP_URL } from "@/lib/app";

const STATS = [
  "50 Free Generations",
  "7-Day Trial",
  "No Credit Card",
  "Cancel Anytime",
];

const WORKFLOW = [
  { icon: FileText, label: "Jira Story" },
  { icon: ScanSearch, label: "Story Critique" },
  { icon: ListChecks, label: "Generate 5 Test Types" },
  { icon: GitCompareArrows, label: "Change Impact Analysis" },
  { icon: Download, label: "Export" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

function WorkflowDiagram() {
  return (
    <div className="w-full max-w-full overflow-hidden rounded-3xl bg-white p-6 shadow-2xl md:p-8">
      <p className="mb-6 text-center text-xs font-semibold uppercase tracking-wider text-text-light">
        The TestSurge pipeline
      </p>
      <div className="flex w-full flex-col items-stretch md:flex-row md:flex-wrap md:items-center md:justify-center">
        {WORKFLOW.map((node, index) => {
          const Icon = node.icon;
          return (
            <Fragment key={node.label}>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, amount: 0.25 }}
                whileHover={{ y: -6, scale: 1.04 }}
                transition={{ duration: 0.4, delay: index * 0.18 }}
                className="flex min-w-0 flex-shrink cursor-default flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-muted px-3 py-4 text-center md:flex-1"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary/10">
                  <Icon className="text-secondary" size={22} />
                </span>
                <span className="text-xs font-semibold leading-tight text-text-primary">
                  {node.label}
                </span>
              </motion.div>

              {index < WORKFLOW.length - 1 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.6 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: false, amount: 0.25 }}
                  transition={{ duration: 0.3, delay: index * 0.18 + 0.12 }}
                  className="flex shrink-0 items-center justify-center text-accent"
                  aria-hidden
                >
                  {/* down arrow on mobile (vertical stack) */}
                  <span className="flex flex-col items-center py-1 md:hidden">
                    <span className="h-3 w-px bg-accent/40" />
                    <ChevronDown size={18} strokeWidth={2.5} />
                  </span>
                  {/* right arrow on desktop (horizontal row) */}
                  <span className="hidden items-center px-1 md:flex">
                    <span className="h-px w-4 bg-accent/40" />
                    <ChevronRight size={18} strokeWidth={2.5} />
                  </span>
                </motion.div>
              )}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

export default function Hero() {
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-[#FFF5F8] via-[#F2FAFB] to-background px-6 pt-28 pb-16">
      {/* Background blobs — gentle ambient float */}
      <motion.div
        aria-hidden
        animate={{ y: [0, -24, 0], x: [0, 16, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-secondary opacity-[0.05] blur-3xl"
      />
      <motion.div
        aria-hidden
        animate={{ y: [0, 24, 0], x: [0, -16, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-accent opacity-[0.06] blur-3xl"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: false, amount: 0.2 }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        {/* Headline */}
        <motion.h1
          variants={itemVariants}
          style={{ fontSize: "clamp(32px, 5vw, 64px)" }}
          className="mx-auto w-full max-w-[800px] text-balance break-words font-heading font-bold leading-tight text-text-primary"
        >
          AI Test Intelligence &amp;{" "}
          <span className="text-secondary">Impact</span> for Modern QA Teams
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          variants={itemVariants}
          style={{ fontSize: "clamp(16px, 2vw, 26px)" }}
          className="mx-auto mt-6 w-full max-w-[640px] font-heading font-semibold text-text-primary"
        >
          Generate tests. Predict impact. Prevent missed coverage.
        </motion.p>

        {/* Description */}
        <motion.p
          variants={itemVariants}
          style={{ fontSize: "clamp(14px, 1.5vw, 18px)" }}
          className="mx-auto mt-4 w-full max-w-[600px] text-text-secondary"
        >
          Generate all 5 test types from Jira stories, detect which tests break
          when requirements change, and critique bad stories before bugs happen.
        </motion.p>

        {/* Buttons */}
        <motion.div
          variants={itemVariants}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <motion.a
            href={SIGNUP_URL}
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 0 8px rgba(255, 59, 107, 0.15)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="rounded-full bg-secondary px-8 py-4 text-lg font-semibold text-white shadow-lg"
          >
            Start Free — No Card Needed
          </motion.a>
          <motion.button
            type="button"
            onClick={() => setDemoOpen(true)}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-full border border-text-primary bg-white px-8 py-4 text-lg font-semibold text-text-primary"
          >
            Watch Demo <Play size={18} fill="currentColor" />
          </motion.button>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-text-secondary"
        >
          {STATS.map((stat, i) => (
            <span key={stat} className="flex items-center gap-3">
              {i > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {stat}
            </span>
          ))}
        </motion.div>

        {/* Hero visual — animated workflow diagram */}
        <motion.div variants={itemVariants} className="mt-16 w-full max-w-3xl">
          <WorkflowDiagram />
        </motion.div>
      </motion.div>

      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </section>
  );
}
