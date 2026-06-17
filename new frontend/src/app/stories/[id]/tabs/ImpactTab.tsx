"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle2, XCircle, Pencil, Sparkles, GitCompare, Upload, Info } from "lucide-react";
import { type ImpactedTest } from "@/lib/seed";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { Tooltip } from "@/components/ui/Tooltip";
import { AIConfidenceBadge, confidenceLevel } from "@/components/ui/AIConfidenceBadge";
import { staggerContainer, fadeInUp, duration, easeStandard, spring } from "@/lib/motion";

const versionPairs = [
  { label: "v1 May 1", id: "v1" },
  { label: "v2 May 14 (current)", id: "v2" },
];

export function ImpactTab({ impacts }: { impacts: ImpactedTest[] }) {
  const [version, setVersion] = useState("v2");
  const [expanded, setExpanded] = useState<string | null>(impacts[0]?.id ?? null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  if (impacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-5">
          <GitCompare size={28} />
        </div>
        <h2 className="text-h2 text-navy mb-2">No impact detected</h2>
        <p className="text-sm text-muted max-w-sm mb-6">
          When you upload a new version of this story, AI compares it against
          existing tests and flags which ones need to change.
        </p>
        <button className="inline-flex items-center gap-2 h-10 px-5 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors">
          <Upload size={16} />
          Upload New Version
        </button>
      </div>
    );
  }

  const modified = impacts.filter((i) => i.impactType === "Modify Existing").length;
  const added = impacts.filter((i) => i.impactType === "Create New Test").length;
  const deprecated = impacts.filter((i) => i.impactType === "Deprecate").length;

  return (
    <div className="px-8 py-6 max-w-content mx-auto space-y-5">
      {/* Version selector */}
      <div className="flex items-center gap-3">
        {versionPairs.map((v) => (
          <button
            key={v.id}
            onClick={() => setVersion(v.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-btn border transition-colors ${
              version === v.id
                ? "bg-surface-pink border-pink text-pink"
                : "bg-white border-border text-muted hover:text-navy"
            }`}
          >
            {v.label}
          </button>
        ))}
        <span className="text-sm text-muted ml-2">Comparing v1 → v2</span>
      </div>

      {/* Metric cards */}
      <div className="flex items-center gap-1.5">
        <h3 className="text-[15px] font-semibold text-navy">Impact Summary</h3>
        <Tooltip content="Impact Analysis shows how this story's changes affect existing tests — which must be modified, added, or deprecated.">
          <Info size={13} className="text-muted cursor-help" />
        </Tooltip>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Modified" value={modified} color="warning" />
        <MetricCard label="Added" value={added} color="success" />
        <MetricCard label="Deprecated" value={deprecated} color="error" />
      </div>

      {/* Impact list */}
      <motion.div
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="space-y-3"
      >
        {impacts.map((impact) => {
          const isExpanded = expanded === impact.id;
          const isAccepted = accepted.has(impact.id);
          const isRejected = rejected.has(impact.id);

          return (
            <motion.div
              key={impact.id}
              variants={fadeInUp}
              layout
              className={`bg-white border rounded-card overflow-hidden ${
                isAccepted ? "border-success/40" : isRejected ? "border-error/30 opacity-60" : "border-border"
              }`}
            >
              {/* Row header */}
              <button
                onClick={() => setExpanded(isExpanded ? null : impact.id)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
              >
                <SeverityBadge severity={impact.severity} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{impact.title}</p>
                  <p className="text-[13px] text-muted mt-0.5">{impact.reason}</p>
                </div>
                <span className="text-[11px] font-semibold text-muted bg-gray-100 px-2 py-0.5 rounded">
                  {impact.impactType}
                </span>
                {isAccepted && <CheckCircle2 size={16} className="text-success flex-shrink-0" />}
                {isRejected && <XCircle size={16} className="text-error flex-shrink-0" />}
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={spring.snappy}
                >
                  <ChevronDown size={16} className="text-muted flex-shrink-0" />
                </motion.div>
              </button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: duration.base, ease: easeStandard }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                      {/* AI recommendation */}
                      <div className="bg-surface-cyan border border-cyan/30 rounded-lg p-3 flex items-start gap-2">
                        <Sparkles size={14} className="text-cyan flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-[13px] font-semibold text-cyan">
                              AI Recommendation: {impact.impactType}
                            </p>
                            <AIConfidenceBadge
                              level={confidenceLevel(impact.aiConfidence)}
                              score={impact.aiConfidence}
                            />
                          </div>
                          <p className="text-[13px] text-muted">{impact.aiReason}</p>
                        </div>
                      </div>

                      {/* Diff viewer */}
                      <DiffViewer lines={impact.diffLines} />

                      {/* Actions */}
                      {!isAccepted && !isRejected && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => {
                              const next = new Set(accepted);
                              next.add(impact.id);
                              setAccepted(next);
                              setExpanded(null);
                            }}
                            className="h-9 px-4 text-sm font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors flex items-center gap-2"
                          >
                            <CheckCircle2 size={14} />
                            Accept Change
                          </button>
                          <button
                            onClick={() => {
                              const next = new Set(rejected);
                              next.add(impact.id);
                              setRejected(next);
                              setExpanded(null);
                            }}
                            className="h-9 px-4 text-sm font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors flex items-center gap-2"
                          >
                            <XCircle size={14} />
                            Reject Change
                          </button>
                          <button className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2">
                            <Pencil size={13} />
                            Edit Change
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      {/* AI assistant */}
      <div className="flex gap-2 pt-2">
        <input
          type="text"
          placeholder="Why did this test change?"
          className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-pink focus:ring-1 focus:ring-pink/20 transition-colors"
        />
        <button className="h-9 w-9 flex items-center justify-center bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
          <Sparkles size={15} />
        </button>
      </div>
    </div>
  );
}

function MetricCard({
  label, value, color,
}: {
  label: string;
  value: number;
  color: "warning" | "success" | "error";
}) {
  const colorMap = {
    warning: "text-warning bg-[#FFFBEB] border-[#FCD34D]",
    success: "text-success bg-[#ECFDF5] border-[#6EE7B7]",
    error: "text-error bg-[#FEF2F2] border-[#FCA5A5]",
  };
  return (
    <div className={`border rounded-card p-4 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </div>
  );
}
