"use client";

import { motion } from "framer-motion";
import { AlertCircle, XCircle, AlertTriangle, PieChart, Sparkles, Info } from "lucide-react";
import { type Story, type CoverageGap, type TestType } from "@/lib/seed";
import { Tooltip } from "@/components/ui/Tooltip";
import { staggerContainer, fadeInUp, duration, easeOut } from "@/lib/motion";
import { useAIAction, AI_ACTION_COSTS } from "@/contexts/AIActionContext";

/** Shared mock async op (~1.4s, ~10% failure) for AI actions in this tab. */
function mockRun(ms = 1400): Promise<void> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (Math.random() < 0.1 ? reject(new Error("Something went wrong. Please try again.")) : resolve()), ms)
  );
}

const TYPE_COLORS: Record<TestType, string> = {
  Functional: "#3B82F6",
  Negative: "#EF4444",
  Boundary: "#F59E0B",
  Security: "#FF0A78",
  Accessibility: "#10B981",
  Performance: "#3B82F6",
};

const COVERAGE_BREAKDOWN: { type: TestType; value: number }[] = [
  { type: "Functional", value: 100 },
  { type: "Negative", value: 85 },
  { type: "Boundary", value: 70 },
  { type: "Security", value: 60 },
  { type: "Accessibility", value: 30 },
];

export function CoverageTab({ story, gaps }: { story: Story; gaps: CoverageGap[] }) {
  const { runAIAction } = useAIAction();

  const generateTests = () =>
    runAIAction({
      name: "Generate Tests",
      credits: AI_ACTION_COSTS.generateTests,
      description: `Generate a full test suite for ${story.id} across functional, security and accessibility areas.`,
      run: () => mockRun(1800),
    });

  const generateMissing = () =>
    runAIAction({
      name: "Generate Coverage Analysis",
      credits: AI_ACTION_COSTS.coverageAnalysis,
      description: `Analyze coverage gaps for ${story.id} and generate the missing tests.`,
      run: () => mockRun(),
    });

  if (story.testCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-5">
          <PieChart size={28} />
        </div>
        <h2 className="text-h2 text-navy mb-2">No coverage data</h2>
        <p className="text-sm text-muted max-w-sm mb-6">
          Coverage is calculated from your test suite. Generate tests to see
          coverage across functional, security and accessibility areas.
        </p>
        <button
          onClick={generateTests}
          className="inline-flex items-center gap-2 h-10 px-5 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors"
        >
          <Sparkles size={16} />
          Generate Tests
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-0" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Left: summary */}
      <div className="w-[400px] flex-shrink-0 border-r border-border p-6 space-y-6">
        {/* Donut */}
        <div className="flex flex-col items-center">
          <CoverageDonut coverage={story.coverage} />
        </div>

        {/* Breakdown bars */}
        <div className="space-y-3">
          {COVERAGE_BREAKDOWN.map((row, i) => (
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
        </div>

        {/* AI assistant */}
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="What coverage is missing?"
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-pink focus:ring-1 focus:ring-pink/20 transition-colors"
          />
        </div>
      </div>

      {/* Right: gaps */}
      <div className="flex-1 p-6">
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle size={16} className="text-warning" />
            <h3 className="text-[15px] font-semibold text-navy">Coverage Gaps ({gaps.length})</h3>
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
                      backgroundColor: TYPE_COLORS[gap.type] + "20",
                      color: TYPE_COLORS[gap.type],
                    }}
                  >
                    {gap.type}
                  </span>
                </div>
                <p className="text-[13px] text-muted">{gap.description}</p>
              </div>
            </motion.div>
          ))}

          {gaps.length > 0 && (
            <button
              onClick={generateMissing}
              className="w-full h-10 bg-pink text-white text-sm font-medium rounded-btn hover:bg-[#e0005f] transition-colors mt-2"
            >
              Generate Missing Tests
            </button>
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
