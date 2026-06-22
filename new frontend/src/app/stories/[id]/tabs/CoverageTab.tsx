"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, PieChart, Sparkles, Info, Loader2, XCircle, AlertTriangle, Send } from "lucide-react";
import { type Story, type CoverageGap, type TestType } from "@/lib/seed";
import type { TestCase as DomainTestCase } from "@/types/domain";
import { Tooltip } from "@/components/ui/Tooltip";
import { staggerContainer, fadeInUp, duration, easeOut } from "@/lib/motion";
import { useAIAction, AI_ACTION_COSTS } from "@/contexts/AIActionContext";
import { api } from "@/lib/api";

type CoverageTestType = "Functional" | "Negative" | "Boundary" | "Security" | "Performance";

const TYPE_COLORS: Record<CoverageTestType, string> = {
  Functional: "#3B82F6",
  Negative: "#EF4444",
  Boundary: "#F59E0B",
  Security: "#FF0A78",
  Performance: "#10B981",
};

const EXPECTED_PER_TYPE: Record<CoverageTestType, number> = {
  Functional: 20, Negative: 10, Boundary: 5, Security: 5, Performance: 4,
};

function inferCategory(title: string): CoverageTestType {
  const t = title.toLowerCase();
  if (/\b(security|auth|inject|xss|csrf|permission|token|bypass)\b/.test(t)) return "Security";
  if (/\b(boundary|limit|max|min|overflow|empty|null|zero|exceed)\b/.test(t)) return "Boundary";
  if (/\b(invalid|fail|error|reject|wrong|missing|incorrect|denied)\b/.test(t)) return "Negative";
  if (/\b(performance|load|throughput|timeout|latency)\b/.test(t)) return "Performance";
  return "Functional";
}

function heuristicCoverage(n: number) { return Math.min(100, Math.round((n / 40) * 100)); }

export function CoverageTab({
  story, gaps, realTests,
}: {
  story: Story;
  gaps: CoverageGap[];
  realTests?: DomainTestCase[];
}) {
  const { runAIAction } = useAIAction();
  const [genResults, setGenResults] = useState<string[]>([]);
  const [genLoading, setGenLoading] = useState(false);
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<string[]>([]);

  const hasRealTests = realTests && realTests.length > 0;
  const overallCoverage = hasRealTests
    ? heuristicCoverage(realTests.length)
    : story.coverage;

  const breakdown: { type: CoverageTestType; value: number }[] = (
    ["Functional", "Negative", "Boundary", "Security", "Performance"] as CoverageTestType[]
  ).map((type) => {
    if (hasRealTests) {
      const count = realTests.filter((tc) => inferCategory(tc.title) === type).length;
      return { type, value: Math.min(100, Math.round((count / EXPECTED_PER_TYPE[type]) * 100)) };
    }
    // Fallback to seed coverage
    const base = story.coverage;
    const fallbacks: Record<CoverageTestType, number> = {
      Functional: Math.min(100, base + 9),
      Negative: Math.min(100, base - 6),
      Boundary: Math.min(100, base - 21),
      Security: Math.min(100, base - 31),
      Performance: Math.min(100, base - 40),
    };
    return { type, value: Math.max(0, fallbacks[type]) };
  });

  async function handleGenerateMissing() {
    setGenLoading(true);
    setGenResults([]);
    try {
      // Trigger real test generation — the LLM uses the story content + RAG context
      // to generate additional tests covering gaps. This runs in the background.
      await api.regenerateTests(story.id);
      setGenResults(["Test generation started. Switch to the Tests tab to see new tests as they arrive."]);
    } catch (err: any) {
      setGenResults(["Could not start generation. Please try again."]);
    } finally {
      setGenLoading(false);
    }
  }

  async function handleAiSend() {
    const q = aiQuery.trim();
    if (!q || aiLoading) return;
    setAiLoading(true);
    setAiResults([]);
    try {
      const res = await api.ragChat(q);
      setAiResults(res.testCases.map((tc) => tc.title));
    } catch (err: any) {
      setAiResults([err?.message?.includes("relevant") ? "No similar test cases found yet. Generate test cases for some stories first." : "Could not reach AI assistant. Try again."]);
    } finally {
      setAiLoading(false);
    }
  }

  if (story.testCount === 0 && !hasRealTests) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-5">
          <PieChart size={28} />
        </div>
        <h2 className="text-h2 text-navy mb-2">No coverage data</h2>
        <p className="text-sm text-muted max-w-sm mb-6">
          Coverage is calculated from your test suite. Generate tests to see
          coverage across functional, security and performance areas.
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-0" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Left: summary */}
      <div className="w-[400px] flex-shrink-0 border-r border-border p-6 space-y-6">
        {/* Donut */}
        <div className="flex flex-col items-center">
          <CoverageDonut coverage={overallCoverage} />
        </div>

        {/* Breakdown bars — from real test keyword classifier */}
        <div className="space-y-3">
          {breakdown.map((row, i) => (
            <div key={row.type}>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="font-medium text-navy">{row.type}</span>
                <span className="font-semibold text-navy">{row.value}%</span>
              </div>
              <div className="h-2.5 bg-border rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[row.type] }}
                  initial={{ width: 0 }}
                  animate={{ width: `${row.value}%` }}
                  transition={{ duration: duration.slow, delay: 0.05 + i * 0.08, ease: easeOut }}
                />
              </div>
            </div>
          ))}
          <p className="text-[10px] text-muted">Coverage is estimated from test count and type classification.</p>
        </div>

        {/* Use the ✦ Copilot (bottom-right) to ask about coverage */}
        <div className="flex items-center gap-2 pt-2 text-xs text-muted">
          <Sparkles size={12} className="text-pink flex-shrink-0" />
          Ask the <span className="font-semibold text-pink mx-1">✦ Copilot</span> what coverage is missing or which areas need more tests.
        </div>
      </div>

      {/* Right: gaps / generate missing */}
      <div className="flex-1 p-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-warning" />
            <h3 className="text-[15px] font-semibold text-navy">Coverage Gaps</h3>
            <Tooltip content="Coverage measures how much of this story's behavior is exercised by tests. Gaps highlight untested areas by test type.">
              <Info size={13} className="text-muted cursor-help" />
            </Tooltip>
          </div>

          {gaps.map((gap) => (
            <motion.div
              key={gap.id}
              variants={fadeInUp}
              className="flex items-start gap-3 p-4 bg-white border border-border rounded-card"
            >
              {gap.severity === "missing" ? (
                <XCircle size={15} className="text-error flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={15} className="text-warning flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-semibold text-navy">{gap.title}</p>
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: (TYPE_COLORS[gap.type as CoverageTestType] ?? "#64748B") + "20",
                      color: TYPE_COLORS[gap.type as CoverageTestType] ?? "#64748B",
                    }}
                  >
                    {gap.type}
                  </span>
                </div>
                <p className="text-[13px] text-muted">{gap.description}</p>
              </div>
            </motion.div>
          ))}

          {gaps.length === 0 ? (
            <div className="p-4 bg-[#ECFEFF] border border-cyan/30 rounded-card text-sm text-navy">
              Coverage gap analysis is not yet available. Ask the AI assistant: <em>&ldquo;What test scenarios are missing?&rdquo;</em>
            </div>
          ) : (
            gaps.map((gap) => (
              <motion.div key={gap.id} variants={fadeInUp} className="flex items-start gap-3 p-4 bg-white border border-border rounded-card">
                <AlertCircle size={15} className={gap.severity === "missing" ? "text-error flex-shrink-0 mt-0.5" : "text-warning flex-shrink-0 mt-0.5"} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-navy">{gap.title}</p>
                  <p className="text-[13px] text-muted">{gap.description}</p>
                </div>
              </motion.div>
            ))
          )}

          <button
            onClick={handleGenerateMissing}
            disabled={genLoading}
            className="w-full h-10 bg-pink text-white text-sm font-medium rounded-btn hover:bg-[#e0005f] transition-colors mt-2 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {genLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {genLoading ? "Starting…" : "Regenerate Tests"}
          </button>

          {genResults.length > 0 && (
            <div className="border border-border rounded-card bg-[#ECFEFF] border-cyan/30 p-4">
              {genResults.map((r, i) => (
                <p key={i} className="text-sm text-navy">{r}</p>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function CoverageDonut({ coverage }: { coverage: number }) {
  const size = 200;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - coverage / 100);
  const center = size / 2;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
        <motion.circle
          cx={center} cy={center} r={radius} fill="none" stroke="#06B6D4" strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          style={{ strokeDasharray: circumference }}
          transition={{ duration: duration.slow, ease: easeOut }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[40px] font-bold text-navy leading-none">{coverage}%</span>
        <span className="text-sm text-muted mt-1">Coverage</span>
      </div>
    </div>
  );
}
