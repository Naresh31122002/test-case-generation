"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { AlertTriangle, ArrowRight, TrendingUp, TrendingDown, Sparkles, Loader2 } from "lucide-react";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { staggerContainer, fadeInUp, duration, easeOut } from "@/lib/motion";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";

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

const worstCategories = [
  { label: "Missing Security Tests",      count: 12, icon: "🔒" },
  { label: "Missing Boundary Tests",      count: 9,  icon: "⚡" },
  { label: "Missing Accessibility Tests", count: 17, icon: "♿" },
];

// Weekly coverage history (oldest → newest).
const coverageTrend = [58, 62, 61, 67, 71, 74, 78];
const trendLabels = ["W1", "W2", "W3", "W4", "W5", "W6", "W7"];

// Per-category coverage trend over the same weeks.
const categoryTrends = [
  { type: "Security",      points: [40, 42, 45, 44, 48, 50, 52] },
  { type: "Boundary",      points: [48, 50, 53, 55, 57, 59, 61] },
  { type: "Accessibility", points: [22, 24, 28, 30, 33, 36, 38] },
];

// AI-recommended next actions.
const recommendedActions = [
  {
    title: "Generate Security Tests for OAuth Story",
    detail: "AUTH-010 has only 52% security coverage — add token & redirect tests.",
    impact: "High",
    href: "/stories/AUTH-010/coverage",
  },
  {
    title: "Add Accessibility Tests for Login",
    detail: "LOGIN-001 is missing ARIA and keyboard-only flow coverage.",
    impact: "Medium",
    href: "/stories/LOGIN-001/coverage",
  },
  {
    title: "Cover Boundary Cases for Registration",
    detail: "AUTH-002 lacks max-length and edge-value tests.",
    impact: "Medium",
    href: "/stories/AUTH-002/coverage",
  },
];

const impactStyles: Record<string, string> = {
  High:   "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low:    "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
};

export default function CoveragePage() {
  const [stories, setStories] = useState<ReturnType<typeof domainStoryToSeed>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // No project filter — show all stories for this user
    api.getStories(1, 200)
      .then(res => setStories(res.data.map(domainStoryToSeed)))
      .catch(() => setStories([]))
      .finally(() => setLoading(false));
  }, []);

  const overallCoverage = stories.length
    ? Math.round(stories.reduce((s, x) => s + x.coverage, 0) / stories.length)
    : 0;
  const totalTests = stories.reduce((s, x) => s + x.testCount, 0);
  const totalGaps = stories.reduce((s, x) => s + x.impactCount, 0);
  const riskyStories = [...stories]
    .filter((s) => s.coverage < 80)
    .sort((a, b) => a.coverage - b.coverage)
    .slice(0, 5);

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

          {/* Trend charts: coverage over time + category trends */}
          <div className="grid grid-cols-2 gap-6">
            {/* Coverage over time */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, delay: 0.1 }}
              className="bg-white border border-border rounded-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[15px] font-semibold text-navy">Coverage Over Time</h2>
                <TrendDelta points={coverageTrend} />
              </div>
              <TrendChart points={coverageTrend} labels={trendLabels} color="#06B6D4" />
            </motion.div>

            {/* Category trends */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, delay: 0.15 }}
              className="bg-white border border-border rounded-card p-5"
            >
              <h2 className="text-[15px] font-semibold text-navy mb-4">Category Trends</h2>
              <div className="space-y-3.5">
                {categoryTrends.map((cat) => (
                  <div key={cat.type} className="flex items-center gap-3">
                    <span
                      className="text-xs font-medium text-navy w-[92px] flex-shrink-0"
                    >
                      {cat.type}
                    </span>
                    <div className="flex-1">
                      <Sparkline points={cat.points} color={typeColors[cat.type]} />
                    </div>
                    <span className="text-xs font-semibold text-navy w-10 text-right">
                      {cat.points[cat.points.length - 1]}%
                    </span>
                    <TrendDelta points={cat.points} compact />
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

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
              {worstCategories.map((cat) => (
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

          {/* Recommended actions */}
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
                  key={a.title}
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
                    Generate
                    <ArrowRight size={12} />
                  </Link>
                </motion.div>
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
        )}
      </PageBody>
    </PageLayout>
  );
}

/** Build an SVG polyline path scaled to the given box. */
function buildPath(points: number[], w: number, h: number, pad = 4) {
  const max = Math.max(...points, 100);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const stepX = (w - pad * 2) / (points.length - 1);
  return points
    .map((p, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (p - min) / range);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

/** Coverage-over-time line chart with gridlines + labels. */
function TrendChart({
  points,
  labels,
  color,
}: {
  points: number[];
  labels: string[];
  color: string;
}) {
  const w = 320;
  const h = 120;
  const poly = buildPath(points, w, h);
  const last = points[points.length - 1];
  const lastX = 4 + ((w - 8) / (points.length - 1)) * (points.length - 1);
  const lastY = 4 + (h - 8) * (1 - last / 100);

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }}>
        {/* gridlines */}
        {[0, 0.5, 1].map((g) => (
          <line
            key={g}
            x1={0}
            x2={w}
            y1={4 + (h - 8) * g}
            y2={4 + (h - 8) * g}
            stroke="#E2E8F0"
            strokeWidth={1}
          />
        ))}
        {/* area fill */}
        <motion.polyline
          points={`4,${h - 4} ${poly} ${w - 4},${h - 4}`}
          fill={color + "14"}
          stroke="none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: duration.slow }}
        />
        {/* line */}
        <motion.polyline
          points={poly}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: duration.slow, ease: easeOut }}
        />
        {/* last point */}
        <circle cx={lastX} cy={lastY} r={4} fill={color} />
      </svg>
      <div className="flex justify-between mt-1">
        {labels.map((l) => (
          <span key={l} className="text-[10px] text-muted">{l}</span>
        ))}
      </div>
    </div>
  );
}

/** Compact inline sparkline (no axes). */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const w = 120;
  const h = 28;
  const poly = buildPath(points, w, h, 2);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height: h }} preserveAspectRatio="none">
      <motion.polyline
        points={poly}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: duration.slow, ease: easeOut }}
      />
    </svg>
  );
}

/** Up/down delta badge comparing first vs last point. */
function TrendDelta({ points, compact }: { points: number[]; compact?: boolean }) {
  const delta = points[points.length - 1] - points[0];
  const up = delta >= 0;
  const color = up ? "text-success" : "text-error";
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${color} ${compact ? "w-12 justify-end" : ""}`}>
      <Icon size={13} />
      {up ? "+" : ""}{delta}%
    </span>
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