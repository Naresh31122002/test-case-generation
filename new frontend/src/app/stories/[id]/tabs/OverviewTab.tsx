"use client";

import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Sparkles, Info } from "lucide-react";
import { type Story } from "@/lib/seed";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { fadeInUp, staggerContainer, duration, easeOut } from "@/lib/motion";
import { VersionTimeline } from "../VersionTimeline";

export function OverviewTab({ story }: { story: Story }) {
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

      {/* Story quality */}
      <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
        <h3 className="text-[15px] font-semibold text-navy mb-4 flex items-center gap-1.5">
          Story Quality Analysis
          <Tooltip content="Health Score combines Completeness, Clarity and Testability into an overall quality rating for this story.">
            <Info size={13} className="text-muted cursor-help" />
          </Tooltip>
        </h3>
        <div className="flex gap-6 items-start">
          <QualityDonut score={story.qualityScore} />
          <div className="flex-1 space-y-3">
            {[
              { label: "Completeness", value: story.qualityBreakdown.completeness },
              { label: "Clarity", value: story.qualityBreakdown.clarity },
              { label: "Testability", value: story.qualityBreakdown.testability },
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

        {story.qualityIssues.length > 0 && (
          <div className="mt-5 space-y-3">
            <h4 className="text-[13px] font-semibold text-muted uppercase tracking-wide">Issues Found</h4>
            {story.qualityIssues.map((issue, i) => (
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
      </motion.div>

      {/* Risk analysis */}
      {story.riskAreas.length > 0 && (
        <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5">
          <h3 className="text-[15px] font-semibold text-navy mb-4 flex items-center gap-1.5">
            Risk Analysis
            <Tooltip content="Risk Analysis flags areas where missing or weak requirements could lead to defects, ranked by severity.">
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
                {story.riskAreas.map((r, i) => (
                  <tr key={i} className={i < story.riskAreas.length - 1 ? "border-b border-border" : ""}>
                    <td className="px-4 py-3 font-medium text-navy">{r.area}</td>
                    <td className="px-4 py-3"><SeverityBadge severity={r.severity} /></td>
                    <td className="px-4 py-3 text-muted">{r.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* AI recommendations */}
      {story.aiRecommendations.length > 0 && (
        <motion.div variants={fadeInUp} className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={15} className="text-success" />
            <h3 className="text-[15px] font-semibold text-navy">AI Recommendations</h3>
          </div>
          <ol className="space-y-2">
            {story.aiRecommendations.map((r, i) => (
              <li key={i} className="flex gap-3 text-sm text-navy">
                <span className="font-bold text-success flex-shrink-0">{i + 1}.</span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      {/* AI assistant inline */}
      <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-4">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Ask about this story…"
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-pink focus:ring-1 focus:ring-pink/20 transition-colors"
          />
          <button className="h-9 w-9 flex items-center justify-center bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
            <Sparkles size={15} />
          </button>
        </div>
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
