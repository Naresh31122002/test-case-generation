"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { GitPullRequest } from "lucide-react";
import { changeRequests, type ChangeStatus } from "@/lib/seed";
import { staggerContainer, fadeInUp } from "@/lib/motion";

const STATUS_TABS: (ChangeStatus | "All")[] = ["Pending", "Approved", "Rejected", "All"];

const impactColors = {
  High:   "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low:    "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
};

const statusColors: Record<ChangeStatus, string> = {
  Pending:  "bg-[#EFF6FF] text-[#1E40AF] border-[#93C5FD]",
  Approved: "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]",
  Rejected: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
};

export default function ChangesPage() {
  const [tab, setTab] = useState<ChangeStatus | "All">("Pending");

  const counts = {
    Pending:  changeRequests.filter((c) => c.status === "Pending").length,
    Approved: changeRequests.filter((c) => c.status === "Approved").length,
    Rejected: changeRequests.filter((c) => c.status === "Rejected").length,
    All:      changeRequests.length,
  };

  const filtered = tab === "All" ? changeRequests : changeRequests.filter((c) => c.status === tab);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center justify-between px-8">
        <h1 className="text-2xl font-semibold text-navy">Changes</h1>
      </div>

      {/* Filter tabs */}
      <div className="bg-white border-b border-border px-8 flex gap-1">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative px-4 py-3.5 text-sm font-medium transition-colors flex items-center gap-2 ${
              tab === t ? "text-navy" : "text-muted hover:text-navy"
            }`}
          >
            {t}
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${
              tab === t ? "bg-pink text-white" : "bg-gray-100 text-muted"
            }`}>
              {counts[t]}
            </span>
            {tab === t && (
              <motion.div
                layoutId="changes-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-8 max-w-content mx-auto w-full">
        {filtered.length === 0 ? (
          <EmptyChanges />
        ) : (
          <motion.div
            key={tab}
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-4"
          >
            {filtered.map((cr) => (
              <motion.div
                key={cr.id}
                variants={fadeInUp}
                className="bg-white border border-border rounded-card p-5 flex items-start justify-between gap-4 hover:shadow-card transition-shadow"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-[11px] font-semibold text-cyan">{cr.storyId}</span>
                    <span className="text-[15px] font-semibold text-navy">{cr.title}</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${statusColors[cr.status]}`}>
                      {cr.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-sm text-muted">{cr.storiesAffected} Stories Affected</span>
                    <span className="text-border">·</span>
                    <span className="text-sm text-muted">{cr.testsAffected} Tests Affected</span>
                    <span className="text-border">·</span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${impactColors[cr.impactScore]}`}>
                      Impact Score: {cr.impactScore}
                    </span>
                  </div>
                  <p className="text-xs text-muted">Created {cr.createdAt} by AI Analysis</p>
                </div>
                <Link
                  href={`/changes/${cr.id}`}
                  className="flex-shrink-0 h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors inline-flex items-center"
                >
                  Review Change
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

function EmptyChanges() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <GitPullRequest size={48} className="text-muted mb-4" />
      <h2 className="text-[18px] font-semibold text-navy mb-2">No pending changes.</h2>
      <p className="text-sm text-muted max-w-sm">
        Changes appear when a new story version affects existing stories and their tests.
      </p>
    </motion.div>
  );
}
