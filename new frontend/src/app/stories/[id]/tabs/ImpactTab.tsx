"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, CheckCircle2, XCircle, Pencil, Sparkles, GitCompare, Loader2 } from "lucide-react";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { SeverityBadge } from "@/components/ui/SeverityBadge";
import { staggerContainer, fadeInUp, duration, easeStandard, spring } from "@/lib/motion";
import { api } from "@/lib/api";
import type { StoryTestCaseImpacts, ImpactEvent } from "@/types/domain";
import type { DiffLine } from "@/lib/seed";

function capitalize(s: string): "High" | "Medium" | "Low" {
  const l = s.toLowerCase();
  if (l === "high") return "High";
  if (l === "low") return "Low";
  return "Medium";
}

function buildDiffLines(originalSteps: string[], modifiedSteps: string[]): DiffLine[] {
  const lines: DiffLine[] = [];
  let lineNum = 1;
  for (const step of originalSteps) { lines.push({ type: "removed", lineNum, content: step }); lineNum++; }
  for (const step of modifiedSteps) { lines.push({ type: "added", lineNum, content: step }); lineNum++; }
  return lines;
}

function parseModifiedSteps(analysisJson: string): string[] {
  try {
    const obj = JSON.parse(analysisJson);
    const mt = obj?.modified_test_case ?? obj?.modifiedTestCase;
    if (!mt) return [];
    return Array.isArray(mt?.steps) ? mt.steps : [];
  } catch { return []; }
}

function parseModificationReason(analysisJson: string): string {
  try {
    const obj = JSON.parse(analysisJson);
    return obj?.modification_reason ?? obj?.modificationReason ?? "";
  } catch { return ""; }
}

export function ImpactTab({ storyId, projectId }: { storyId: string; projectId: string }) {
  const [data, setData] = useState<StoryTestCaseImpacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [aiQuery, setAiQuery] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (!projectId) { setLoading(false); setError("no-project"); return; }
    let cancelled = false;
    setLoading(true);
    api.getStoryTestCaseImpacts(storyId, projectId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          const first = result.testCases.find((tc) => tc.impacts.length > 0);
          if (first) setExpanded(first.testCaseId);
        }
      })
      .catch(() => { if (!cancelled) setError("fetch-error"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storyId, projectId]);

  async function handleAiQuery() {
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiResponse(null);
    try {
      const result = await api.ragChat("Why did this test change? " + aiQuery.trim());
      setAiResponse(result.testCases.length > 0
        ? result.testCases.map((tc) => `• ${tc.title}`).join("\n")
        : "No related test cases found for that query.");
    } catch (err: any) { setAiResponse(err?.message?.includes("relevant") ? "No similar test cases found yet. Generate test cases for some stories first." : "Could not reach the AI assistant. Please try again."); }
    finally { setAiLoading(false); }
  }

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted">
      <Loader2 size={32} className="animate-spin" />
      <p className="text-sm">Loading impact analysis…</p>
    </div>
  );

  if (error === "no-project" || !projectId) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <GitCompare size={48} className="text-muted mb-4" />
      <h2 className="text-h2 text-navy mb-2">No project ID available</h2>
      <p className="text-sm text-muted">Open this story from the Stories list to load impact analysis.</p>
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <GitCompare size={48} className="text-muted mb-4" />
      <h2 className="text-h2 text-navy mb-2">Could not load impact data</h2>
      <p className="text-sm text-muted">Please try again later.</p>
    </div>
  );

  const impactedTestCases = data.testCases.filter((tc) => tc.impacts.length > 0);

  if (impactedTestCases.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <GitCompare size={48} className="text-muted mb-4" />
      <h2 className="text-h2 text-navy mb-2">No impact detected</h2>
      <p className="text-sm text-muted">Upload a new version of this story to see impact analysis.</p>
    </div>
  );

  return (
    <div className="px-8 py-6 max-w-content mx-auto space-y-5">
      {/* Metric cards — no version chips (Gap 3) */}
      <h2 className="text-h2 text-navy font-semibold">Impact Analysis</h2>
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Modified" value={data.impactedTestCasesCount} color="warning" />
        <MetricCard label="High Severity" value={data.severitySummary.high} color="error" />
        <MetricCard label="Low Severity" value={data.severitySummary.low} color="success" />
      </div>

      {/* Impact list */}
      <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
        {impactedTestCases.map((tc) => {
          const isExpanded = expanded === tc.testCaseId;
          const isAccepted = accepted.has(tc.testCaseId);
          const isRejected = rejected.has(tc.testCaseId);
          const firstImpact: ImpactEvent = tc.impacts[0];
          const severityLabel = capitalize(firstImpact.severity);
          const modifiedSteps = parseModifiedSteps(firstImpact.analysisJson);
          const diffLines = buildDiffLines(tc.originalSteps, modifiedSteps);
          const modificationReason = parseModificationReason(firstImpact.analysisJson);
          const detailsPreview = firstImpact.details.length > 120 ? firstImpact.details.slice(0, 120) + "…" : firstImpact.details;

          return (
            <motion.div key={tc.testCaseId} variants={fadeInUp} layout
              className={`bg-white border rounded-card overflow-hidden ${isAccepted ? "border-success/40" : isRejected ? "border-error/30 opacity-60" : "border-border"}`}>
              <button onClick={() => setExpanded(isExpanded ? null : tc.testCaseId)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                <SeverityBadge severity={severityLabel} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy truncate">{tc.originalTitle}</p>
                  <p className="text-[13px] text-muted mt-0.5">{detailsPreview}</p>
                </div>
                {isAccepted && <CheckCircle2 size={16} className="text-success flex-shrink-0" />}
                {isRejected && <XCircle size={16} className="text-error flex-shrink-0" />}
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={spring.snappy}>
                  <ChevronDown size={16} className="text-muted flex-shrink-0" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: easeStandard }}
                    className="overflow-hidden">
                    <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
                      <div className="bg-surface-cyan border border-cyan/30 rounded-lg p-3 flex items-start gap-2">
                        <Sparkles size={14} className="text-cyan flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[13px] font-semibold text-cyan mb-1">
                            Impacting story: {firstImpact.impactingStoryDescription || firstImpact.impactingStoryId}
                          </p>
                          {modificationReason && <p className="text-[13px] text-muted">{modificationReason}</p>}
                        </div>
                      </div>
                      {diffLines.length > 0 ? <DiffViewer lines={diffLines} /> :
                        <p className="text-[13px] text-muted italic">No step-level diff available for this impact.</p>}
                      {isAccepted && (
                        <p className="text-sm text-success font-medium flex items-center gap-1.5">
                          <CheckCircle2 size={14} /> Test case updated in story — change applied.
                        </p>
                      )}
                      {isRejected && (
                        <p className="text-sm text-error font-medium flex items-center gap-1.5">
                          <XCircle size={14} /> Rejected — original test case kept unchanged.
                        </p>
                      )}
                      {!isAccepted && !isRejected && (
                        <div className="flex items-center gap-3">
                          <button onClick={async () => {
                            try { await api.reviewImpact(firstImpact.impactId, 'accept'); } catch {}
                            setAccepted((p) => new Set(Array.from(p).concat(tc.testCaseId)));
                            setExpanded(null);
                          }} className="h-9 px-4 text-sm font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors flex items-center gap-2">
                            <CheckCircle2 size={14} /> Accept Change
                          </button>
                          <button onClick={async () => {
                            try { await api.reviewImpact(firstImpact.impactId, 'reject'); } catch {}
                            setRejected((p) => new Set(Array.from(p).concat(tc.testCaseId)));
                            setExpanded(null);
                          }} className="h-9 px-4 text-sm font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors flex items-center gap-2">
                            <XCircle size={14} /> Reject Change
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

      {/* Use Copilot to ask about impacts */}
      <div className="flex items-center gap-2 pt-2 text-xs text-muted">
        <Sparkles size={12} className="text-pink flex-shrink-0" />
        Ask the <span className="font-semibold text-pink mx-1">✦ Copilot</span> why tests were impacted or what changed.
      </div>
    </div>
  );
}

function MetricCard({ label, value, color }: { label: string; value: number; color: "warning" | "success" | "error" }) {
  const colorMap = { warning: "text-warning bg-[#FFFBEB] border-[#FCD34D]", success: "text-success bg-[#ECFDF5] border-[#6EE7B7]", error: "text-error bg-[#FEF2F2] border-[#FCA5A5]" };
  return (
    <div className={`border rounded-card p-4 ${colorMap[color]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm font-medium mt-1">{label}</p>
    </div>
  );
}
