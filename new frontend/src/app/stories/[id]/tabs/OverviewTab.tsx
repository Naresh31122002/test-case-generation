"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Sparkles, Info, Loader2, RefreshCw } from "lucide-react";
import { type Story } from "@/lib/seed";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { fadeInUp, staggerContainer, duration, easeOut } from "@/lib/motion";
import { VersionTimeline } from "../VersionTimeline";
import { api } from "@/lib/api";

interface QualityData {
  overall_score: number;
  completeness: number;
  clarity: number;
  testability: number;
  issues: Array<{ title: string; description: string; area: string }>;
  risk_areas: Array<{ area: string; severity: string; description: string }>;
  recommendations: string[];
}

export function OverviewTab({ story }: { story: Story }) {
  const [aiQuery, setAiQuery] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResults, setAiResults] = useState<string[]>([]);
  const [quality, setQuality] = useState<QualityData | null>(null);
  const [qualityLoading, setQualityLoading] = useState(false);
  const [qualityError, setQualityError] = useState(false);
  // Sprint 1 Phase 4: AI Insights are collapsed by default and only fetched when
  // the user explicitly asks for them, to reduce visual noise (and avoid an LLM
  // call on every Overview view).
  const [insightsRequested, setInsightsRequested] = useState(false);

  function generateInsights() {
    setInsightsRequested(true);
    setQualityLoading(true);
    setQualityError(false);
    api.getStoryQuality(story.id)
      .then((q) => setQuality(q))
      .catch(() => setQualityError(true))
      .finally(() => setQualityLoading(false));
  }

  // Reset insights when navigating between stories so they stay collapsed.
  useEffect(() => {
    setInsightsRequested(false);
    setQuality(null);
    setQualityError(false);
    setQualityLoading(false);
  }, [story.id]);

  async function handleAsk() {
    if (!aiQuery.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResults([]);
    try {
      const res = await api.ragChat("Ask about this story: " + aiQuery.trim());
      setAiResults(res.testCases.map((tc) => tc.title));
    } catch (err: any) {
      setAiResults([err?.message?.includes("relevant") ? "No similar test cases found yet. Generate test cases for some stories first." : "Could not reach AI assistant. Try again."]);
    } finally {
      setAiLoading(false);
    }
  }
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="px-8 py-8 max-w-content mx-auto space-y-6"
    >
      {/* Version timeline */}
      <VersionTimeline story={story} />

      {/* Story content */}
      <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
        <h3 className="text-[15px] font-semibold text-navy mb-3">Story</h3>
        <pre className="text-sm text-navy whitespace-pre-wrap leading-relaxed font-sans">{story.content}</pre>
      </motion.div>

      {/* Acceptance criteria */}
      <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
        <h3 className="text-[15px] font-semibold text-navy mb-3">Acceptance Criteria</h3>
        {story.acceptanceCriteria.length > 0 ? (
          <ul className="space-y-2">
            {story.acceptanceCriteria.map((c, i) => (
              <li key={i} className="flex items-start gap-3">
                <CheckCircle2 size={15} className="text-success flex-shrink-0 mt-0.5" />
                <span className="text-sm text-navy">{c}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 p-3 bg-[#FFFBEB] border border-[#FCD34D] rounded-lg">
            <AlertTriangle size={15} className="text-warning" />
            <p className="text-sm text-[#92400E]">No acceptance criteria found. AI may generate lower quality tests.</p>
          </div>
        )}
      </motion.div>

      {/* Story quality — real LLM analysis */}
      <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[15px] font-semibold text-navy flex items-center gap-1.5">
            Story Quality Analysis
            <Tooltip content="AI-powered analysis of Completeness, Clarity and Testability.">
              <Info size={13} className="text-muted cursor-help" />
            </Tooltip>
          </h3>
          {insightsRequested && !qualityLoading && (
            <button
              onClick={generateInsights}
              className="text-muted hover:text-navy transition-colors"
              title="Re-analyze"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>

        {!insightsRequested ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted max-w-sm">
              Run AI analysis to score Completeness, Clarity and Testability, and surface risks and recommendations for this story.
            </p>
            <button
              onClick={generateInsights}
              className="inline-flex items-center gap-2 text-sm font-medium text-white bg-cyan rounded-btn px-4 py-2 hover:bg-cyan/90 transition-colors"
            >
              <Sparkles size={15} /> Generate AI Insights
            </button>
          </div>
        ) : qualityLoading ? (
          <div className="flex items-center gap-3 py-6 justify-center text-muted">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Analyzing story quality with AI…</span>
          </div>
        ) : qualityError ? (
          <div className="py-4 text-center text-sm text-muted">
            Quality analysis unavailable. <button onClick={generateInsights} className="text-cyan hover:underline">Retry</button>
          </div>
        ) : quality ? (
          <>
            <div className="flex gap-6 items-start">
              <QualityDonut score={quality.overall_score} />
              <div className="flex-1 space-y-3">
                {[
                  { label: "Completeness", value: quality.completeness },
                  { label: "Clarity",       value: quality.clarity },
                  { label: "Testability",   value: quality.testability },
                ].map((bar, i) => (
                  <div key={bar.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted font-medium">{bar.label}</span>
                      <span className="font-semibold text-navy">{bar.value}%</span>
                    </div>
                    <div className="h-2 bg-border rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-cyan rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${bar.value}%` }}
                        transition={{ duration: duration.slow, delay: 0.1 + i * 0.08, ease: easeOut }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {quality.issues.length > 0 && (
              <div className="mt-5 space-y-3">
                <h4 className="text-[13px] font-semibold text-muted uppercase tracking-wide">Issues Found</h4>
                {quality.issues.map((issue, i) => (
                  <div key={i} className="flex gap-3">
                    <AlertTriangle size={15} className="text-warning flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-navy">{issue.title}</p>
                      <p className="text-xs text-muted mt-0.5">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : null}
      </motion.div>

      {/* Risk analysis — real LLM data */}
      {quality && quality.risk_areas.length > 0 && (
        <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
          <h3 className="text-[15px] font-semibold text-navy mb-4 flex items-center gap-1.5">
            Risk Analysis
            <Tooltip content="AI-identified risk areas where missing or weak requirements could lead to defects.">
              <Info size={13} className="text-muted cursor-help" />
            </Tooltip>
          </h3>
          <div className="overflow-hidden rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Risk Area</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Severity</th>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-muted uppercase tracking-wide">Description</th>
                </tr>
              </thead>
              <tbody>
                {quality.risk_areas.map((r, i) => (
                  <tr key={i} className={i < quality.risk_areas.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-4 py-3 font-medium text-navy">{r.area}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={r.severity as any} /></td>
                    <td className="px-4 py-3 text-muted">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* AI recommendations — real LLM data */}
      {quality && quality.recommendations.length > 0 && (
        <motion.div variants={fadeInUp} className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-success" />
            <h3 className="text-[15px] font-semibold text-navy">AI Recommendations</h3>
          </div>
          <ol className="space-y-2">
            {quality.recommendations.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-navy">
                <span className="font-bold text-success flex-shrink-0">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* Use the ✦ Copilot button (bottom-right) to ask questions about this story */}
      <motion.div variants={fadeInUp} className="flex items-center gap-2 p-3 bg-gray-50 border border-border rounded-card text-xs text-muted">
        <Sparkles size={13} className="text-pink flex-shrink-0" />
        Use the <span className="font-semibold text-pink mx-1">✦ Copilot</span> button at the bottom-right to ask anything about this story, its test cases, quality, or impacts.
      </motion.div>
    </motion.div>
  );
}

function QualityDonut({ score }: { score: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const center = size / 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
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
        <span className="text-[24px] font-bold text-navy">{score}</span>
        <span className="text-[11px] text-muted">Quality</span>
      </div>
    </div>
  );
}
