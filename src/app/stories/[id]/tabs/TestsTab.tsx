"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, RefreshCw, Sparkles, TestTube2 } from "lucide-react";
import { type TestCase, type TestType } from "@/lib/seed";
import { fadeInUp, staggerContainer, duration, easeStandard } from "@/lib/motion";

const TYPE_FILTERS: (TestType | "All")[] = ["All", "Functional", "Negative", "Boundary", "Security", "Accessibility"];

const priorityColor: Record<string, string> = {
  P1: "bg-[#ECFEFF] text-cyan border-cyan/40",
  P2: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  P3: "bg-[#F8FAFC] text-muted border-border",
};

const typeColor: Record<TestType, string> = {
  Functional: "bg-[#EFF6FF] text-[#1E40AF]",
  Negative: "bg-[#FEF2F2] text-[#991B1B]",
  Boundary: "bg-[#FFFBEB] text-[#92400E]",
  Security: "bg-[#FFF0F7] text-pink",
  Accessibility: "bg-[#ECFDF5] text-[#065F46]",
};

export function TestsTab({ tests }: { tests: TestCase[] }) {
  const [filter, setFilter] = useState<TestType | "All">("All");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(tests[0]?.id ?? null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const filtered = tests.filter((t) => {
    if (filter !== "All" && t.type !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const selectedTest = tests.find((t) => t.id === selected);
  const toggleCheck = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChecked(next);
  };

  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <TestTube2 size={48} className="text-muted mb-4" />
        <h2 className="text-h2 text-navy mb-2">No tests generated yet</h2>
        <p className="text-sm text-muted">Click Generate Tests to create your first test suite.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full" style={{ minHeight: "calc(100vh - 220px)" }}>
      {/* Left panel */}
      <div className="w-[320px] flex-shrink-0 border-r border-border flex flex-col">
        {/* Filter chips */}
        <div className="px-3 pt-4 pb-2 flex flex-wrap gap-1.5">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                filter === f
                  ? "bg-pink text-white border-pink"
                  : "bg-white text-muted border-border hover:border-navy hover:text-navy"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <input
            type="text"
            placeholder="Search tests…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 px-3 text-xs border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
          />
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {checked.size > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: duration.fast }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 bg-surface-pink border-b border-border flex items-center gap-2">
                <span className="text-xs font-semibold text-navy">{checked.size} selected</span>
                <button className="text-xs text-success hover:underline">Approve</button>
                <button className="text-xs text-muted hover:underline">Regenerate</button>
                <button className="text-xs text-error hover:underline">Delete</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Test list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map((test) => (
            <button
              key={test.id}
              onClick={() => setSelected(test.id)}
              className={`w-full flex items-center gap-3 px-3 h-12 text-left border-b border-border transition-colors relative ${
                selected === test.id ? "bg-surface-pink" : "hover:bg-gray-50"
              }`}
            >
              {selected === test.id && (
                <motion.div
                  layoutId="test-active-row"
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-pink"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <input
                type="checkbox"
                checked={checked.has(test.id)}
                onChange={(e) => { e.stopPropagation(); toggleCheck(test.id); }}
                onClick={(e) => e.stopPropagation()}
                className="w-3.5 h-3.5 accent-pink flex-shrink-0"
              />
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[test.priority]}`}>
                {test.priority}
              </span>
              <span className="flex-1 text-[12px] font-semibold text-navy truncate">{test.title}</span>
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor[test.type]}`}>
                {test.type}
              </span>
              {test.status === "Approved" ? (
                <Check size={13} className="text-success flex-shrink-0" />
              ) : test.status === "Regenerating" ? (
                <RefreshCw size={13} className="text-warning flex-shrink-0 animate-spin" />
              ) : (
                <Clock size={13} className="text-muted flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedTest ? (
            <motion.div
              key={selectedTest.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast, ease: easeStandard }}
              className="p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold text-navy mb-2">{selectedTest.title}</h2>
                  <div className="flex items-center gap-2">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${priorityColor[selectedTest.priority]}`}>
                      {selectedTest.priority}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${typeColor[selectedTest.type]}`}>
                      {selectedTest.type}
                    </span>
                    {selectedTest.status === "Approved" ? (
                      <span className="text-[11px] font-semibold text-success flex items-center gap-1">
                        <Check size={12} /> Approved
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button className="h-8 px-3 text-xs font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors">
                    Approve
                  </button>
                  <button className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
                    Regenerate
                  </button>
                  <button className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
                    Edit
                  </button>
                  <button className="h-8 px-3 text-xs font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors">
                    Delete
                  </button>
                </div>
              </div>

              {/* Preconditions */}
              {selectedTest.preconditions && selectedTest.preconditions.length > 0 && (
                <div>
                  <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-2">Preconditions</p>
                  <ul className="space-y-1">
                    {selectedTest.preconditions.map((p, i) => (
                      <li key={i} className="text-sm text-navy flex items-start gap-2">
                        <span className="text-muted">•</span> {p}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Steps */}
              <div>
                <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-2">Steps</p>
                <ol className="space-y-1.5">
                  {selectedTest.steps.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-navy leading-relaxed">
                      <span className="font-bold text-muted flex-shrink-0 w-5 text-right">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Expected result */}
              <div>
                <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-2">Expected Result</p>
                <p className="text-sm text-navy leading-relaxed">{selectedTest.expectedResult}</p>
              </div>

              {/* AI review */}
              {selectedTest.aiReview && (
                <div className="bg-surface-cyan border border-cyan/30 rounded-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} className="text-cyan" />
                    <span className="text-[13px] font-semibold text-cyan">AI Review</span>
                  </div>
                  <p className="text-[13px] text-muted leading-relaxed">{selectedTest.aiReview}</p>
                  <button className="mt-3 text-[12px] font-medium text-cyan hover:underline">
                    Suggest Missing Cases
                  </button>
                </div>
              )}

              {/* AI assistant */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Ask about this test…"
                  className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-pink focus:ring-1 focus:ring-pink/20 transition-colors"
                />
                <button className="h-9 w-9 flex items-center justify-center bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
                  <Sparkles size={15} />
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              {...fadeInUp}
              className="flex items-center justify-center h-full py-24"
            >
              <p className="text-sm text-muted">Select a test to view details</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
