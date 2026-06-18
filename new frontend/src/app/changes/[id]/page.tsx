"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ChevronDown, CheckCircle2, XCircle, Pencil, Sparkles, Loader2 } from "lucide-react";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { staggerContainer, fadeInUp, duration, easeStandard, spring } from "@/lib/motion";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";
import { api } from "@/lib/api";
import type { StoryImpactSummary, Impact } from "@/lib/api";
import type { DiffLine } from "@/lib/seed";

const impactColors = {
  high:   "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  low:    "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
};

function buildDiff(impact: Impact): DiffLine[] {
  const lines: DiffLine[] = [];
  let n = 1;
  const changes = impact.impactDetails?.changes ?? {};
  if (Array.isArray(changes.steps) && changes.steps.length > 0) {
    lines.push({ type: "unchanged", lineNum: n++, content: `Test: ${impact.originalTestCaseId}` });
    for (const s of changes.steps) { lines.push({ type: "added", lineNum: n++, content: s }); }
  } else {
    const reason = impact.impactDetails?.modificationReason ?? "No diff available.";
    lines.push({ type: "added", lineNum: n++, content: reason });
  }
  return lines;
}

export default function ChangeReviewPage({ params }: { params: { id: string } }) {
  const storyId = params.id;
  const [summary, setSummary] = useState<StoryImpactSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [storyDesc, setStoryDesc] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api.getStoryImpacts(storyId),
      api.getStories(1, 200),
    ]).then(([s, storiesRes]) => {
      if (cancelled) return;
      setSummary(s);
      const found = storiesRes.data.find((x) => x.id === storyId);
      if (found) setStoryDesc(found.description);
      if (s.receivedImpacts.length > 0) setExpanded(s.receivedImpacts[0].impactId);
    }).catch(() => {
      if (!cancelled) setSummary({ storyId, totalImpacts: 0, causedImpacts: [], receivedImpacts: [] });
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storyId]);

  const impacts = summary?.receivedImpacts ?? [];

  async function handleAcceptAll() {
    const ids = impacts.map((i) => i.impactId);
    try {
      await api.batchReviewImpacts('', storyId, ids.map((id) => ({ impact_id: id, action: 'accept' as const })));
    } catch {}
    setAccepted(new Set(ids));
    setRejected(new Set());
  }

  async function handleRejectAll() {
    const ids = impacts.map((i) => i.impactId);
    try {
      await api.batchReviewImpacts('', storyId, ids.map((id) => ({ impact_id: id, action: 'reject' as const })));
    } catch {}
    setRejected(new Set(ids));
    setAccepted(new Set());
  }

  async function handleReview(impactId: string, action: 'accept' | 'reject') {
    try { await api.reviewImpact(impactId, action); } catch {}
    if (action === 'accept') {
      setAccepted((p) => new Set(Array.from(p).concat(impactId)));
      setRejected((p) => { const n = new Set(Array.from(p)); n.delete(impactId); return n; });
    } else {
      setRejected((p) => new Set(Array.from(p).concat(impactId)));
      setAccepted((p) => { const n = new Set(Array.from(p)); n.delete(impactId); return n; });
    }
    setExpanded(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    const reviews = impacts.map((i) => ({
      impact_id: i.impactId,
      action: accepted.has(i.impactId) ? 'accept' as const : rejected.has(i.impactId) ? 'reject' as const : 'accept' as const,
    }));
    try {
      await api.batchReviewImpacts('', storyId, reviews);
      setSubmitted(true);
    } catch (e: any) {
      alert(`Submit failed: ${e?.message ?? 'Unknown error'}`);
    } finally {
      setSubmitting(false);
    }
  }

  const pageTitle = storyDesc.length > 60 ? storyDesc.slice(0, 60) + "…" : storyDesc || storyId;
  const acceptedCount = accepted.size;
  const rejectedCount = rejected.size;

  if (loading) return (
    <PageLayout>
      <PageHeader title="Change Review" leading={<Link href="/changes" className="text-muted hover:text-navy"><ArrowLeft size={20} /></Link>} actions={<PageActions />} />
      <PageBody><div className="flex justify-center py-24"><Loader2 size={32} className="animate-spin text-muted" /></div></PageBody>
    </PageLayout>
  );

  return (
    <PageLayout>
      <PageHeader
        title={`${pageTitle} — Change Review`}
        leading={<Link href="/changes" className="text-muted hover:text-navy transition-colors flex-shrink-0"><ArrowLeft size={20} /></Link>}
        actions={
          <PageActions primary={
            <>
              <button onClick={handleAcceptAll} className="flex-shrink-0 h-9 px-4 text-sm font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors whitespace-nowrap">
                Approve All
              </button>
              <button onClick={handleRejectAll} className="flex-shrink-0 h-9 px-4 text-sm font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors whitespace-nowrap">
                Reject All
              </button>
            </>
          } />
        }
      />

      <PageBody className="space-y-6">
        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-card p-4">
            <p className="text-2xl font-bold text-navy">{impacts.length}</p>
            <p className="text-sm text-muted mt-1">Impacts Received</p>
          </div>
          <div className="bg-white border border-border rounded-card p-4">
            <p className="text-2xl font-bold text-success">{acceptedCount}</p>
            <p className="text-sm text-muted mt-1">Accepted</p>
          </div>
          <div className="bg-white border border-border rounded-card p-4">
            <p className="text-2xl font-bold text-error">{rejectedCount}</p>
            <p className="text-sm text-muted mt-1">Rejected</p>
          </div>
        </div>

        {impacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted">No received impacts for this story.</p>
          </div>
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
            <h2 className="text-[15px] font-semibold text-navy">Affected Test Cases</h2>
            {impacts.map((impact) => {
              const isExpanded = expanded === impact.impactId;
              const isAccepted = accepted.has(impact.impactId);
              const isRejected = rejected.has(impact.impactId);
              const diff = buildDiff(impact);
              const severity = impact.severity as keyof typeof impactColors;

              return (
                <motion.div key={impact.impactId} variants={fadeInUp} layout
                  className={`bg-white border rounded-card overflow-hidden ${isAccepted ? "border-success/40" : isRejected ? "border-error/30 opacity-70" : "border-border"}`}>
                  <button onClick={() => setExpanded(isExpanded ? null : impact.impactId)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4 min-w-0">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border flex-shrink-0 ${impactColors[severity] ?? impactColors.low}`}>
                        {impact.severity}
                      </span>
                      <span className="text-sm font-semibold text-navy truncate">{impact.originalTestCaseId}</span>
                      <span className="text-xs text-muted truncate max-w-xs">{impact.impactDetails?.modificationReason?.slice(0, 80)}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {isAccepted && <CheckCircle2 size={16} className="text-success" />}
                      {isRejected && <XCircle size={16} className="text-error" />}
                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={spring.snappy}>
                        <ChevronDown size={16} className="text-muted" />
                      </motion.div>
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.base, ease: easeStandard }}
                        className="overflow-hidden">
                        <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                          <div className="text-sm text-muted">
                            <span className="font-medium text-navy">Impacting story: </span>
                            {impact.newStoryId}
                          </div>
                          <DiffViewer lines={diff} />
                          {!isAccepted && !isRejected && (
                            <div className="flex gap-3">
                              <button onClick={() => handleReview(impact.impactId, 'accept')}
                                className="h-9 px-4 text-sm font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors flex items-center gap-2">
                                <CheckCircle2 size={14} /> Accept Change
                              </button>
                              <button onClick={() => handleReview(impact.impactId, 'reject')}
                                className="h-9 px-4 text-sm font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors flex items-center gap-2">
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
        )}

        {/* Submit review bar */}
        <AnimatePresence>
          {(acceptedCount > 0 || rejectedCount > 0) && !submitted && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }} transition={{ duration: duration.base }}
              className="sticky bottom-6 bg-white border border-border rounded-card px-5 py-4 shadow-card flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm">
                {acceptedCount > 0 && <span className="text-success font-semibold">{acceptedCount} Accepted</span>}
                {rejectedCount > 0 && <span className="text-error font-semibold">{rejectedCount} Rejected</span>}
                {impacts.length - acceptedCount - rejectedCount > 0 && (
                  <span className="text-muted">{impacts.length - acceptedCount - rejectedCount} Pending</span>
                )}
              </div>
              <button onClick={handleSubmit} disabled={submitting}
                className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2 disabled:opacity-60">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {submitting ? "Submitting…" : "Submit Review"}
              </button>
            </motion.div>
          )}
          {submitted && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-success/10 border border-success/30 rounded-card px-5 py-4 text-success text-sm font-medium">
              ✓ Review submitted — changes applied to test suite.
            </motion.div>
          )}
        </AnimatePresence>
      </PageBody>
    </PageLayout>
  );
}
