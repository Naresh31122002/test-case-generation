"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, ChevronDown, CheckCircle2, XCircle, Pencil, Sparkles } from "lucide-react";
import { changeRequests } from "@/lib/seed";
import { DiffViewer } from "@/components/ui/DiffViewer";
import { staggerContainer, fadeInUp, duration, easeStandard, spring } from "@/lib/motion";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";

const impactColors = {
  High:   "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low:    "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
};

export default function ChangeReviewPage({ params }: { params: { id: string } }) {
  const cr = changeRequests.find((c) => c.id === params.id) ?? changeRequests[0];
  const [expanded, setExpanded] = useState<string | null>(cr.affectedStories[0]?.storyId ?? null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());

  const acceptedCount = accepted.size;
  const rejectedCount = rejected.size;
  const total = cr.affectedStories.length;

  return (
    <PageLayout>
      <PageHeader
        title={`${cr.title} — Change Review`}
        leading={
          <Link href="/changes" className="text-muted hover:text-navy transition-colors flex-shrink-0">
            <ArrowLeft size={20} />
          </Link>
        }
        actions={
          <PageActions
            primary={
              <>
                <button
                  onClick={() => setAccepted(new Set(cr.affectedStories.map((s) => s.storyId)))}
                  className="flex-shrink-0 h-9 px-4 text-sm font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors whitespace-nowrap"
                >
                  Approve All
                </button>
                <button
                  onClick={() => setRejected(new Set(cr.affectedStories.map((s) => s.storyId)))}
                  className="flex-shrink-0 h-9 px-4 text-sm font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors whitespace-nowrap"
                >
                  Reject All
                </button>
              </>
            }
          />
        }
      />

      <PageBody className="space-y-6">
        {/* Summary metric cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white border border-border rounded-card p-4">
            <p className="text-2xl font-bold text-navy">{cr.storiesAffected}</p>
            <p className="text-sm text-muted mt-1">Stories Affected</p>
          </div>
          <div className="bg-white border border-border rounded-card p-4">
            <p className="text-2xl font-bold text-navy">{cr.testsAffected}</p>
            <p className="text-sm text-muted mt-1">Tests Modified</p>
          </div>
          <div className={`border rounded-card p-4 ${impactColors[cr.impactScore]}`}>
            <p className="text-2xl font-bold">{cr.impactScore}</p>
            <p className="text-sm font-medium mt-1">Impact Score</p>
          </div>
        </div>

        {/* Affected Stories accordion */}
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="space-y-3"
        >
          <h2 className="text-[15px] font-semibold text-navy">Affected Stories</h2>
          {cr.affectedStories.map((story) => {
            const isExpanded = expanded === story.storyId;
            const isAccepted = accepted.has(story.storyId);
            const isRejected = rejected.has(story.storyId);

            return (
              <motion.div
                key={story.storyId}
                variants={fadeInUp}
                layout
                className={`bg-white border rounded-card overflow-hidden ${
                  isAccepted ? "border-success/40" : isRejected ? "border-error/30 opacity-70" : "border-border"
                }`}
              >
                <button
                  onClick={() => setExpanded(isExpanded ? null : story.storyId)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-semibold text-cyan">{story.storyId}</span>
                    <span className="text-sm font-semibold text-navy">{story.storyTitle}</span>
                    <span className="text-xs text-muted">{story.modifications} modifications</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAccepted && <CheckCircle2 size={16} className="text-success" />}
                    {isRejected && <XCircle size={16} className="text-error" />}
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={spring.snappy}
                    >
                      <ChevronDown size={16} className="text-muted" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: duration.base, ease: easeStandard }}
                      className="overflow-hidden"
                    >
                      <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                        <DiffViewer lines={story.diffLines} />
                        {!isAccepted && !isRejected && (
                          <div className="flex gap-3">
                            <button
                              onClick={() => {
                                const next = new Set(accepted); next.add(story.storyId); setAccepted(next);
                                setExpanded(null);
                              }}
                              className="h-9 px-4 text-sm font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors flex items-center gap-2"
                            >
                              <CheckCircle2 size={14} /> Accept Change
                            </button>
                            <button
                              onClick={() => {
                                const next = new Set(rejected); next.add(story.storyId); setRejected(next);
                                setExpanded(null);
                              }}
                              className="h-9 px-4 text-sm font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors flex items-center gap-2"
                            >
                              <XCircle size={14} /> Reject Change
                            </button>
                            <button className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2">
                              <Pencil size={13} /> Edit Change
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
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Explain the impact of this change."
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-pink focus:ring-1 focus:ring-pink/20 transition-colors"
          />
          <button className="h-9 w-9 flex items-center justify-center bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
            <Sparkles size={15} />
          </button>
        </div>

        {/* Submit review bar */}
        <AnimatePresence>
          {(acceptedCount > 0 || rejectedCount > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: duration.base }}
              className="sticky bottom-6 bg-white border border-border rounded-card px-5 py-4 shadow-card flex items-center justify-between"
            >
              <div className="flex items-center gap-4 text-sm">
                {acceptedCount > 0 && (
                  <span className="text-success font-semibold">{acceptedCount} Accepted</span>
                )}
                {rejectedCount > 0 && (
                  <span className="text-error font-semibold">{rejectedCount} Rejected</span>
                )}
                {total - acceptedCount - rejectedCount > 0 && (
                  <span className="text-muted">{total - acceptedCount - rejectedCount} Pending</span>
                )}
              </div>
              <button className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
                Submit Review
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </PageBody>
    </PageLayout>
  );
}
