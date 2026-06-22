"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { staggerContainer, fadeInUp, duration, easeOut } from "@/lib/motion";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";

const TYPE_COLORS: Record<string, string> = {
  Functional: "#3B82F6",
  Negative:   "#EF4444",
  Boundary:   "#F59E0B",
  Security:   "#FF0A78",
  Performance:"#10B981",
};

// Keyword classifier — mirrors INTEGRATION_PLAN.md Gap 1 decision.
function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/\b(security|auth|inject|xss|csrf|permission|privilege|token|bypass)\b/.test(t)) return "Security";
  if (/\b(boundary|limit|max|min|overflow|empty|null|zero|exceed)\b/.test(t)) return "Boundary";
  if (/\b(invalid|fail|error|reject|wrong|missing|incorrect|denied|not found)\b/.test(t)) return "Negative";
  if (/\b(performance|load|response.?time|concurrent|throughput|timeout|latency)\b/.test(t)) return "Performance";
  return "Functional";
}

const impactStyles: Record<string, string> = {
  High:   "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low:    "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
};

export default function CoveragePage() {
  const [stories, setStories] = useState<ReturnType<typeof domainStoryToSeed>[]>([]);
  const [loading, setLoading] = useState(true);
  // Per-story test cases for type breakdown (loaded lazily for top stories only)
  const [typeBreakdown, setTypeBreakdown] = useState<Record<string, number>>({});
  const [typeLoading, setTypeLoading] = useState(true);

  useEffect(() => {
    api.getStories(1, 200)
      .then(res => setStories(res.data.map(domainStoryToSeed)))
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, []);

  // Compute per-type breakdown from real test cases (sample top 10 stories by test count)
  useEffect(() => {
    if (stories.length === 0) { setTypeLoading(false); return; }
    const topStories = [...stories].sort((a, b) => b.testCount - a.testCount).slice(0, 10);
    Promise.allSettled(topStories.map(s => api.getTestCases(s.id)))
      .then(results => {
        const counts: Record<string, number> = { Functional: 0, Negative: 0, Boundary: 0, Security: 0, Performance: 0 };
        for (const r of results) {
          if (r.status === 'fulfilled') {
            for (const tc of r.value.testCases) {
              const cat = inferCategory(tc.title);
              counts[cat] = (counts[cat] ?? 0) + 1;
            }
          }
        }
        const total = Object.values(counts).reduce((s, n) => s + n, 0) || 1;
        const pct: Record<string, number> = {};
        for (const [k, v] of Object.entries(counts)) pct[k] = Math.round((v / total) * 100);
        setTypeBreakdown(pct);
      })
      .catch(() => {})
      .finally(() => setTypeLoading(false));
  }, [stories]);

  const overallCoverage = stories.length
    ? Math.round(stories.reduce((s, x) => s + x.coverage, 0) / stories.length)
    : 0;
  const totalTests = stories.reduce((s, x) => s + x.testCount, 0);
  const riskyStories = [...stories]
    .filter((s) => s.coverage < 80)
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 5);

  // Worst category = one with fewest test cases
  const worstByType = Object.entries(typeBreakdown)
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([type, pct]) => ({
      label: `Low ${type} Coverage`,
      detail: `${pct}% of sampled tests are ${type} — below recommended 20%`,
      icon: type === "Security" ? "🔒" : type === "Boundary" ? "⚡" : type === "Performance" ? "🚀" : type === "Negative" ? "❌" : "✅",
    }));

  // Recommended actions from real risky stories
  const recommendedActions = riskyStories.slice(0, 3).map(s => ({
    title: `Improve coverage for ${s.id}`,
    detail: `${s.title.slice(0, 60)} — currently ${s.coverage}% coverage (estimated).`,
    impact: s.coverage < 40 ? "High" : s.coverage < 60 ? "Medium" : "Low",
    href: `/stories/${s.id}`,
  }));

  return (
    <PageLayout>
      <PageHeader title="Coverage" actions={<PageActions />} />

      <PageBody>
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={32} className="animate-spin text-cyan" />
          </div>
        ) : (
        <div className="space-y-8">

          {/* Summary metric cards */}
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-4 gap-4"
          >
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5 flex flex-col items-center justify-center">
              <OverallDonut coverage={overallCoverage} />
              <p className="text-xs text-muted mt-2">Overall Coverage <span className="text-[10px]">(est.)</span></p>
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
              <p className="text-3xl font-bold text-warning">{riskyStories.length}</p>
              <p className="text-sm text-muted mt-1">Stories Below 80%</p>
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
              {riskyStories.length === 0 ? (
                <p className="text-sm text-muted py-4 text-center">All stories are above 80% coverage.</p>
              ) : (
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
                        <p className="text-xs text-muted">{s.coverage}% coverage (est.)</p>
                      </div>
                      <Link href={`/stories/${s.id}`} className="text-xs text-cyan hover:underline flex-shrink-0">View</Link>
                    </motion.div>
                  ))}
                </div>
              )}
              <Link href="/stories" className="mt-4 inline-flex items-center gap-1 text-xs text-cyan hover:underline">
                View all <ArrowRight size={12} />
              </Link>
            </motion.div>

            {/* Worst coverage by category (computed from real test cases) */}
            <motion.div
              variants={staggerContainer}
              initial="initial"
              animate="animate"
              className="space-y-4"
            >
              {typeLoading ? (
                <div className="flex items-center justify-center h-32 text-muted gap-2">
                  <Loader2 size={16} className="animate-spin" /> Analysing test types…
                </div>
              ) : worstByType.length === 0 ? (
                <div className="bg-white border border-border rounded-card p-5 text-sm text-muted">
                  No test type data yet — generate tests for some stories first.
                </div>
              ) : (
                worstByType.map((cat) => (
                  <motion.div
                    key={cat.label}
                    variants={fadeInUp}
                    className="bg-white border border-border rounded-card p-4 flex items-center gap-4"
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-navy">{cat.label}</p>
                      <p className="text-xs text-muted mt-0.5">{cat.detail}</p>
                    </div>
                    <Link href="/stories" className="text-xs text-cyan hover:underline flex-shrink-0">View Stories</Link>
                  </motion.div>
                ))
              )}
            </motion.div>
          </div>

          {/* Coverage by type bar chart */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: duration.base, delay: 0.2 }}
            className="bg-white border border-border rounded-card p-5"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-[15px] font-semibold text-navy">Coverage by Test Type</h2>
              <span className="text-[11px] text-muted">(estimated from test titles)</span>
            </div>
            {typeLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted py-4">
                <Loader2 size={14} className="animate-spin" /> Loading…
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(typeBreakdown).length === 0 ? (
                  <p className="text-sm text-muted">Generate tests for at least one story to see the breakdown.</p>
                ) : (
                  Object.entries(typeBreakdown).map(([type, value], i) => (
                    <div key={type}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-navy">{type}</span>
                        <span className="font-semibold text-navy">{value}%</span>
                      </div>
                      <div className="h-3 bg-border rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{ backgroundColor: TYPE_COLORS[type] ?? "#94A3B8" }}
                          initial={{ width: 0 }}
                          animate={{ width: `${value}%` }}
                          transition={{ duration: 0.5, delay: 0.1 + i * 0.07, ease: easeOut }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </motion.div>

          {/* Recommended actions from real risky stories */}
          {recommendedActions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, delay: 0.25 }}
              className="bg-white border border-border rounded-card p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles size={16} className="text-pink" />
                <h2 className="text-[15px] font-semibold text-navy">Recommended Actions</h2>
              </div>
              <div className="space-y-3">
                {recommendedActions.map((a, i) => (
                  <motion.div
                    key={a.href}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: duration.base, delay: 0.3 + i * 0.06, ease: easeOut }}
                    className="flex items-center gap-4 p-3 border border-border rounded-card hover:bg-gray-50 transition-colors"
                  >
                    <span className="w-8 h-8 rounded-full bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
                      <Sparkles size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-navy">{a.title}</p>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${impactStyles[a.impact]}`}>
                          {a.impact}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-0.5">{a.detail}</p>
                    </div>
                    <Link
                      href={a.href}
                      className="flex-shrink-0 inline-flex items-center gap-1 h-8 px-3 rounded-btn bg-pink text-white text-xs font-medium hover:bg-[#e0005f] transition-colors"
                    >
                      Open <ArrowRight size={12} />
                    </Link>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

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
              <div className="grid grid-cols-[1fr_120px_80px_80px] px-5 py-2.5 bg-gray-50 border-b border-border">
                {["Story", "Coverage", "Tests", ""].map((col, i) => (
                  <span key={i} className={`text-[11px] font-semibold text-muted uppercase tracking-wide ${i > 0 ? "text-center" : ""} ${i === 3 ? "text-right" : ""}`}>
                    {col}
                  </span>
                ))}
              </div>
              {stories.map((s, idx) => (
                <div
                  key={s.id}
                  className={`grid grid-cols-[1fr_120px_80px_80px] px-5 py-3 items-center hover:bg-gray-50 transition-colors ${idx < stories.length - 1 ? "border-b border-border" : ""}`}
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
                  <div className="flex justify-end">
                    <Link href={`/stories/${s.id}`} className="text-xs text-cyan hover:underline">Details</Link>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

        </div>
        )}
      </PageBody>
    </PageLayout>
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