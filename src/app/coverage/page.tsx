"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { stories } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { staggerContainer, fadeInUp, duration, easeOut } from "@/lib/motion";

const overallCoverage = Math.round(stories.reduce((s, x) => s + x.coverage, 0) / stories.length);
const totalTests = stories.reduce((s, x) => s + x.testCount, 0);
const totalGaps = 6 + 3 + 2; // seed gap counts across all stories

const byType = [
  { type: "Functional",    value: 88 },
  { type: "Negative",      value: 74 },
  { type: "Boundary",      value: 61 },
  { type: "Security",      value: 52 },
  { type: "Accessibility", value: 38 },
];

const typeColors: Record<string, string> = {
  Functional:    "#3B82F6",
  Negative:      "#EF4444",
  Boundary:      "#F59E0B",
  Security:      "#FF0A78",
  Accessibility: "#10B981",
};

const riskyStories = [...stories]
  .filter((s) => s.coverage < 80)
  .sort((a, b) => a.coverage - b.coverage)
  .slice(0, 5);

const worstCategories = [
  { label: "Missing Security Tests",      count: 12, icon: "🔒" },
  { label: "Missing Boundary Tests",      count: 9,  icon: "⚡" },
  { label: "Missing Accessibility Tests", count: 17, icon: "♿" },
];

export default function CoveragePage() {
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center px-8">
        <h1 className="text-2xl font-semibold text-navy">Coverage</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-content mx-auto space-y-8">

          {/* Summary metric cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-4 gap-4"
          >
            {/* Overall coverage donut */}
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5 flex flex-col items-center justify-center">
              <OverallDonut coverage={overallCoverage} />
              <p className="text-xs text-muted mt-2">Overall Coverage</p>
            </motion.div>
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
              <p className="text-3xl font-bold text-navy">{stories.length}</p>
              <p className="text-sm text-muted mt-1">Stories</p>
            </motion.div>
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
              <p className="text-3xl font-bold text-navy">{totalTests}</p>
              <p className="text-sm text-muted mt-1">Total Tests</p>
            </motion.div>
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
              <p className="text-3xl font-bold text-warning">{totalGaps}</p>
              <p className="text-sm text-muted mt-1">Coverage Gaps</p>
            </motion.div>
          </motion.div>

          <div className="grid grid-cols-2 gap-6">
            {/* Most risky stories */}
            <motion.div
              variants={fadeInUp}
              initial="initial"
              animate="animate"
              className="bg-white border border-border rounded-card p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-warning" />
                <h2 className="text-[15px] font-semibold text-navy">Most Risky Stories</h2>
              </div>
              <div className="space-y-3">
                {riskyStories.map((s, i) => (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: duration.base, delay: i * 0.06, ease: easeOut }}
                    className="flex items-center gap-3"
                  >
                    <CoverageRing coverage={s.coverage} size={36} strokeWidth={4} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-cyan">{s.id}</span>
                        <span className="text-sm font-medium text-navy truncate">{s.title}</span>
                      </div>
                      <p className="text-xs text-muted">{s.coverage}% coverage</p>
                    </div>
                    <Link
                      href={`/stories/${s.id}`}
                      className="text-xs text-cyan hover:underline flex-shrink-0"
                    >
                      View
                    </Link>
                  </motion.div>
                ))}
              </div>
              <Link href="/stories" className="mt-4 inline-flex items-center gap-1 text-xs text-cyan hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </motion.div>

            {/* Worst coverage by category */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-4"
            >
              {worstCategories.map((cat, i) => (
                <motion.div
                  key={cat.label}
                  variants={fadeInUp}
                  className="bg-white border border-border rounded-card p-4 flex items-center gap-4"
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-navy">{cat.label}</p>
                    <p className="text-xs text-muted mt-0.5">{cat.count} stories affected</p>
                  </div>
                  <Link href="/stories" className="text-xs text-cyan hover:underline flex-shrink-0">
                    View Stories
                  </Link>
                </motion.div>
              ))}
            </motion.div>
          </div>

          {/* Coverage by type bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.base, delay: 0.2 }}
            className="bg-white border border-border rounded-card p-5"
          >
            <h2 className="text-[15px] font-semibold text-navy mb-5">Coverage by Test Type</h2>
            <div className="space-y-4">
              {byType.map((row, i) => (
                <div key={row.type}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="font-medium text-navy">{row.type}</span>
                    <span className="font-semibold text-navy">{row.value}%</span>
                  </div>
                  <div className="h-3 bg-border rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: typeColors[row.type] }}
                      initial={{ width: 0 }}
                      animate={{ width: `${row.value}%` }}
                      transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: easeOut }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* All stories table */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.base, delay: 0.3 }}
            className="bg-white border border-border rounded-card overflow-hidden"
          >
            <div className="px-5 py-3.5 border-b border-border">
              <h2 className="text-[15px] font-semibold text-navy">All Stories</h2>
            </div>
            <div>
              {/* Header */}
              <div className="grid grid-cols-[1fr_120px_80px_100px_80px] px-5 py-2.5 bg-gray-50 border-b border-border">
                {["Story", "Coverage", "Tests", "Gaps", ""].map((col, i) => (
                  <span key={i} className={`text-[11px] font-semibold text-muted uppercase tracking-wide ${i > 0 ? "text-center" : ""} ${i === 4 ? "text-right" : ""}`}>
                    {col}
                  </span>
                ))}
              </div>
              {stories.map((s, idx) => (
                <div
                  key={s.id}
                  className={`grid grid-cols-[1fr_120px_80px_100px_80px] px-5 py-3 items-center hover:bg-gray-50 transition-colors ${idx < stories.length - 1 ? "border-b border-border" : ""}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] font-semibold text-cyan flex-shrink-0">{s.id}</span>
                    <span className="text-sm font-medium text-navy truncate">{s.title}</span>
                  </div>
                  <div className="flex items-center justify-center gap-1.5">
                    <CoverageRing coverage={s.coverage} size={28} strokeWidth={3} />
                    <span className={`text-xs font-semibold ${s.coverage < 60 ? "text-error" : s.coverage < 80 ? "text-warning" : "text-success"}`}>
                      {s.coverage}%
                    </span>
                  </div>
                  <span className="text-sm text-muted text-center">{s.testCount}</span>
                  <span className="text-sm text-muted text-center">
                    {s.id === "LOGIN-001" ? 6 : s.id === "AUTH-010" ? 3 : 0}
                  </span>
                  <div className="flex justify-end">
                    <Link href={`/stories/${s.id}/coverage`} className="text-xs text-cyan hover:underline">
                      Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
      </div>
    </div>
  );
}

function OverallDonut({ coverage }: { coverage: number }) {
  const size = 100;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - coverage / 100);
  const c = size / 2;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={c} cy={c} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
        <motion.circle
          cx={c} cy={c} r={r} fill="none" stroke="#06B6D4" strokeWidth={sw}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          style={{ strokeDasharray: circ }}
          transition={{ duration: 0.5, ease: easeOut }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-navy">{coverage}%</span>
      </div>
    </div>
  );
}
