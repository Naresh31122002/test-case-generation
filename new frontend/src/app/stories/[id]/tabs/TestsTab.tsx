"use client";

import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check, Clock, RefreshCw, Sparkles, TestTube2,
  Pencil, Trash2, X, Plus, Loader2, CheckCircle2,
  Paperclip, FileText, ChevronDown,
} from "lucide-react";
import { ConfirmModal, type ConfirmState } from "@/components/ui/ConfirmModal";
import { type TestCase, type TestType } from "@/lib/seed";
import { fadeInUp, duration, easeStandard } from "@/lib/motion";
import { AIConfidenceBadge, confidenceLevel } from "@/components/ui/AIConfidenceBadge";
import { api } from "@/lib/api";
import { invalidateStories } from "@/lib/storiesStore";

function testConfidence(test: TestCase): number {
  let score = 55;
  if (test.status === "Approved") score += 25;
  if (test.status === "Regenerating") score -= 20;
  if (test.priority === "P1") score += 12;
  if (test.aiReview) score += 8;
  return Math.max(10, Math.min(98, score));
}

const TYPE_FILTERS: (TestType | "All")[] = ["All", "Functional", "Negative", "Boundary", "Security", "Accessibility"];

const priorityColor: Record<string, string> = {
  P1: "bg-[#ECFEFF] text-cyan border-cyan/40",
  P2: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  P3: "bg-[#F8FAFC] text-muted border-border",
  High:   "bg-[#FEF2F2] text-red-700 border-red-200",
  Medium: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Low:    "bg-[#F8FAFC] text-muted border-border",
};

const typeColor: Record<string, string> = {
  Functional:    "bg-[#EFF6FF] text-[#1E40AF]",
  Negative:      "bg-[#FEF2F2] text-[#991B1B]",
  Boundary:      "bg-[#FFFBEB] text-[#92400E]",
  Security:      "bg-[#FFF0F7] text-pink",
  Accessibility: "bg-[#ECFDF5] text-[#065F46]",
  Performance:   "bg-[#EFF6FF] text-[#1E40AF]",
};

interface EditState {
  title: string;
  steps: string[];
  expectedResult: string;
  priority: string;
}

// ── Execution Panel (Pass/Fail/Skip) ─────────────────────────────────────────

const RUN_COLORS = {
  pass: 'bg-success/10 text-success border-success/30 hover:bg-success/20',
  fail: 'bg-error/10 text-error border-error/30 hover:bg-error/20',
  skip: 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
} as const;

const RUN_LABELS = { pass: '✓ Pass', fail: '✗ Fail', skip: '⟳ Skip' } as const;

function ExecutionPanel({ storyId, testCaseId }: { storyId: string; testCaseId: string }) {
  const [runs, setRuns] = useState<any[]>([]);
  const [latest, setLatest] = useState<any>(null);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.getTestRuns(storyId, testCaseId)
      .then(d => { setRuns(d.runs ?? []); setLatest(d.latest ?? null); })
      .catch(() => {});
  }, [storyId, testCaseId]);

  async function record(status: 'pass' | 'fail' | 'skip') {
    setSubmitting(status);
    setRunError(null);
    try {
      const res = await api.recordTestRun(storyId, testCaseId, status, comment || undefined);
      setLatest(res.run);
      setRuns(prev => [res.run, ...prev].slice(0, 20));
      setComment('');
    } catch {
      setRunError('Failed to record run. Please try again.');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold text-navy">Execution</p>
        {latest && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${RUN_COLORS[latest.run_status as keyof typeof RUN_COLORS]}`}>
            Last: {latest.run_status.toUpperCase()} · {latest.run_by_name ?? latest.run_by_email ?? 'Unknown'}
          </span>
        )}
      </div>

      {/* Comment box */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Add a comment (optional)…"
        rows={2}
        className="w-full px-3 py-2 text-xs border border-border rounded-lg focus:outline-none focus:border-pink resize-none placeholder:text-muted/60"
      />

      {/* Pass / Fail / Skip buttons */}
      <div className="flex gap-2">
        {(['pass', 'fail', 'skip'] as const).map(s => (
          <button key={s} onClick={() => record(s)} disabled={!!submitting}
            className={`flex-1 h-8 text-xs font-semibold rounded-btn border transition-colors flex items-center justify-center gap-1.5 disabled:opacity-60 ${RUN_COLORS[s]}`}>
            {submitting === s ? <Loader2 size={11} className="animate-spin" /> : null}
            {RUN_LABELS[s]}
          </button>
        ))}
      </div>
      {runError && (
        <p className="text-[11px] text-error">{runError}</p>
      )}

      {/* Run history */}
      {runs.length > 0 && (
        <div>
          <button onClick={() => setExpanded(v => !v)} className="text-[11px] text-muted hover:text-navy flex items-center gap-1">
            <ChevronDown size={11} className={expanded ? '' : '-rotate-90'} />
            History ({runs.length})
          </button>
          {expanded && (
            <div className="mt-2 space-y-1.5 max-h-40 overflow-y-auto">
              {runs.map((r, i) => (
                <div key={r.id ?? i} className="text-[11px] flex items-start gap-2 py-1 border-b border-border/50 last:border-0">
                  <span className={`font-bold uppercase flex-shrink-0 ${r.run_status === 'pass' ? 'text-success' : r.run_status === 'fail' ? 'text-error' : 'text-yellow-600'}`}>
                    {r.run_status}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-navy font-medium">{r.run_by_name ?? r.run_by_email ?? 'Unknown'}</span>
                    {r.comment && <p className="text-muted truncate">{r.comment}</p>}
                  </div>
                  <span className="text-muted flex-shrink-0">{r.run_at ? new Date(r.run_at).toLocaleDateString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TestsTab({ tests: initialTests, storyId }: { tests: TestCase[]; storyId: string }) {
  const [tests, setTests] = useState<TestCase[]>(initialTests);
  const [filter, setFilter] = useState<TestType | "All">("All");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [versionFilter, setVersionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(initialTests[0]?.id ?? null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (g: string) => setCollapsedGroups(prev => {
    const n = new Set(prev); n.has(g) ? n.delete(g) : n.add(g); return n;
  });

  // Per-card loading states
  const [approvingIds, setApprovingIds] = useState<Set<string>>(new Set());
  const [regenIds, setRegenIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [regrouping, setRegrouping] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  // Re-fetch server-side when priority or status filter changes
  useEffect(() => {
    if (!priorityFilter && !statusFilter) {
      // No server filters -- use the prop data to avoid extra network round-trips
      setTests(initialTests);
      return;
    }
    let cancelled = false;
    setFilterLoading(true);
    api.getTestCases(storyId, {
      ...(priorityFilter ? { priority: [priorityFilter] } : {}),
      ...(statusFilter ? { status: [statusFilter] } : {}),
    }).then((res) => {
      if (!cancelled) setTests(res.testCases as any[]);
    }).catch(() => {}).finally(() => { if (!cancelled) setFilterLoading(false); });
    return () => { cancelled = true; };
  }, [storyId, priorityFilter, statusFilter, initialTests]);

  const handleRegroup = useCallback(async () => {
    setRegrouping(true);
    try {
      await api.regroupTestCases(storyId);
      // Re-fetch to get updated group fields -- preserve real status from server
      const tc = await api.getTestCases(storyId);
      setTests(tc.testCases.map((t) => ({
        id: t.id, storyId,
        title: t.title,
        type: (((t as any).type as string) ?? "Functional") as TestType,
        priority: t.priority === "High" ? "P1" : t.priority === "Low" ? "P3" : "P2",
        status: (t.status as any) ?? "Pending",
        steps: t.steps,
        expectedResult: t.expectedResult,
        group: t.group,
      })));
      showToast('Test cases regrouped with AI ✓');
    } catch {
      showToast('Regrouping failed', 'error');
    } finally {
      setRegrouping(false);
    }
  }, [storyId]);

  // Edit modal
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Regenerate modal (single + bulk share the same modal)
  const [regenModalId, setRegenModalId] = useState<string | null>(null);  // null = bulk mode when regenBulkMode=true
  const [regenBulkMode, setRegenBulkMode] = useState(false);
  const [regenSubmitting, setRegenSubmitting] = useState(false);
  const [regenInstructions, setRegenInstructions] = useState("");
  const [regenFile, setRegenFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 2: Review & Refine state
  type ReviewState = {
    testCaseId: string | null; // null = bulk
    original: TestCase | null;
    result: { title: string; steps: string[]; expectedResult: string; priority: string };
    isBulk: boolean;
    bulkResults: { id: string; title: string; steps: string[]; expectedResult: string; priority: string }[];
  };
  const [reviewState, setReviewState] = useState<ReviewState | null>(null);
  const [refineInstructions, setRefineInstructions] = useState("");
  const [refineFile, setRefineFile] = useState<File | null>(null);
  const [refineLoading, setRefineLoading] = useState(false);
  const refineFileRef = useRef<HTMLInputElement>(null);

  // Toast
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = tests.filter((t) => {
    if (filter !== "All" && t.type !== filter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (versionFilter && String(t.version ?? 1) !== versionFilter) return false;
    return true;
  });

  // Group by AI group name (falls back to type)
  const groupedTests = useMemo(() => {
    const grouped: Record<string, typeof tests[0][]> = {};
    filtered.forEach(t => {
      const g = t.group || t.type || 'General';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(t);
    });
    return grouped;
  }, [filtered]);

  const selectedTest = tests.find((t) => t.id === selected);

  const toggleCheck = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = useCallback(async (testId: string) => {
    setApprovingIds((p) => new Set(p).add(testId));
    try {
      await api.approveTestCase(storyId, testId, 'Approved');
      setTests((prev) => prev.map((t) => t.id === testId ? { ...t, status: 'Approved' as any } : t));
      showToast('Test case approved ✓');
      invalidateStories();
    } catch {
      showToast('Failed to update status', 'error');
    } finally {
      setApprovingIds((p) => { const n = new Set(p); n.delete(testId); return n; });
    }
  }, [storyId]);

  const handleReject = useCallback(async (testId: string) => {
    setApprovingIds((p) => new Set(p).add(testId));
    try {
      await api.approveTestCase(storyId, testId, 'Rejected');
      setTests((prev) => prev.map((t) => t.id === testId ? { ...t, status: 'Rejected' as any } : t));
      showToast('Test case rejected');
    } catch {
      showToast('Failed to update status', 'error');
    } finally {
      setApprovingIds((p) => { const n = new Set(p); n.delete(testId); return n; });
    }
  }, [storyId]);

  const handleBulkApprove = useCallback(async () => {
    setBulkLoading(true);
    const ids = Array.from(checked);
    try {
      const results = await Promise.allSettled(ids.map((id) => api.approveTestCase(storyId, id, 'Approved')));
      const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
      const failed = ids.filter((_, i) => results[i].status === 'rejected');
      setTests((prev) => prev.map((t) => succeeded.includes(t.id) ? { ...t, status: 'Approved' as any } : t));
      setChecked(new Set());
      invalidateStories();
      if (failed.length > 0) {
        showToast(`${succeeded.length} approved, ${failed.length} failed`, 'error');
      } else {
        showToast(`${succeeded.length} test cases approved ✓`);
      }
    } catch {
      showToast('Bulk approve failed', 'error');
    } finally {
      setBulkLoading(false);
    }
  }, [storyId, checked]);

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = useCallback((testId: string) => {
    setConfirmState({
      title: "Delete test case",
      message: "This test case will be permanently deleted. This cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: async () => {
        setDeletingIds((p) => new Set(p).add(testId));
        try {
          await api.deleteTestCase(storyId, testId);
          setTests((prev) => prev.filter((t) => t.id !== testId));
          if (selected === testId) setSelected(null);
          showToast('Test case deleted');
          invalidateStories();
        } catch {
          showToast('Failed to delete', 'error');
        } finally {
          setDeletingIds((p) => { const n = new Set(p); n.delete(testId); return n; });
        }
      },
    });
  }, [storyId, selected]);

  const handleBulkDelete = useCallback(() => {
    const count = checked.size;
    setConfirmState({
      title: `Delete ${count} test case${count === 1 ? '' : 's'}`,
      message: `${count} test case${count === 1 ? '' : 's'} will be permanently deleted. This cannot be undone.`,
      confirmLabel: "Delete all",
      onConfirm: async () => {
        setBulkLoading(true);
        const ids = Array.from(checked);
        try {
          const results = await Promise.allSettled(ids.map((id) => api.deleteTestCase(storyId, id)));
          const succeeded = ids.filter((_, i) => results[i].status === 'fulfilled');
          const failed = ids.filter((_, i) => results[i].status === 'rejected');
          setTests((prev) => prev.filter((t) => !succeeded.includes(t.id)));
          if (selected && succeeded.includes(selected)) setSelected(null);
          setChecked(new Set());
          invalidateStories();
          if (failed.length > 0) {
            showToast(`${succeeded.length} deleted, ${failed.length} failed`, 'error');
          } else {
            showToast(`${succeeded.length} test cases deleted`);
          }
        } catch {
          showToast('Some deletions failed', 'error');
        } finally {
          setBulkLoading(false);
        }
      },
    });
  }, [storyId, checked, selected]);

  // ── Regenerate single ─────────────────────────────────────────────────────
  const handleRegenerate = useCallback((testId: string) => {
    setRegenInstructions("");
    setRegenFile(null);
    setRegenBulkMode(false);
    setRegenModalId(testId);
  }, []);

  const handleRegenSubmit = useCallback(async () => {
    setRegenSubmitting(true);
    if (regenBulkMode) {
      const ids = Array.from(checked);
      setTests((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, status: 'Regenerating' as any } : t));
      try {
        const res = await api.bulkRegenerateTestCases(storyId, ids, regenInstructions || undefined, regenFile || undefined);
        const bulkResults = (res.test_cases || []).map((tc: any) => ({
          id: tc.id, title: tc.title, steps: tc.steps,
          expectedResult: tc.expected_result, priority: tc.priority,
        }));
        setRegenModalId(null); setRegenBulkMode(false);
        setReviewState({ testCaseId: null, original: null, result: bulkResults[0] ?? {} as any, isBulk: true, bulkResults });
        setRefineInstructions("");
      } catch {
        setTests((prev) => prev.map((t) => ids.includes(t.id) ? { ...t, status: 'Pending' as any } : t));
        showToast('Bulk regeneration failed', 'error');
        setRegenModalId(null); setRegenBulkMode(false);
      } finally {
        setRegenSubmitting(false); setBulkLoading(false);
        setRegenInstructions(""); setRegenFile(null);
      }
      return;
    }

    if (!regenModalId) { setRegenSubmitting(false); return; }
    const tcId = regenModalId;
    const original = tests.find((t) => t.id === tcId) ?? null;
    setTests((prev) => prev.map((t) => t.id === tcId ? { ...t, status: 'Regenerating' as any } : t));
    try {
      const res = await api.regenerateSingleTestCase(storyId, tcId, regenInstructions || undefined, regenFile || undefined);
      const updated = res.test_case;
      setRegenModalId(null);
      setReviewState({
        testCaseId: tcId, original,
        result: {
          title: updated.title ?? original?.title ?? '',
          steps: updated.steps ?? original?.steps ?? [],
          expectedResult: updated.expected_result ?? original?.expectedResult ?? '',
          priority: updated.priority ?? original?.priority ?? 'Medium',
        },
        isBulk: false, bulkResults: [],
      });
      setRefineInstructions("");
      setTests((prev) => prev.map((t) => t.id === tcId ? { ...t, status: 'Pending' as any } : t));
    } catch {
      setTests((prev) => prev.map((t) => t.id === tcId ? { ...t, status: 'Pending' as any } : t));
      showToast('Regeneration failed', 'error');
      setRegenModalId(null);
    } finally {
      setRegenSubmitting(false);
      setRegenIds((p) => { const n = new Set(p); n.delete(tcId); return n; });
      setRegenInstructions(""); setRegenFile(null);
    }
  }, [storyId, regenModalId, regenBulkMode, regenInstructions, regenFile, tests, checked]);

  // ── Refine (Phase 2 iterative improvement) ────────────────────────────────
  const handleRefine = useCallback(async () => {
    if (!reviewState || !refineInstructions.trim()) return;
    setRefineLoading(true);
    try {
      if (reviewState.isBulk) {
        // Refine each bulk result
        const refined = await Promise.all(
          reviewState.bulkResults.map((r) =>
            api.refineTestCase(storyId, r.id, {
              instructions: refineInstructions,
              current_title: r.title,
              current_steps: r.steps,
              current_expected: r.expectedResult,
              current_priority: r.priority,
              file: refineFile || undefined,
            }).then((res) => ({
              id: r.id,
              title: res.test_case.title ?? r.title,
              steps: res.test_case.steps ?? r.steps,
              expectedResult: res.test_case.expected_result ?? r.expectedResult,
              priority: res.test_case.priority ?? r.priority,
            })).catch(() => r)
          )
        );
        setReviewState((prev) => prev ? { ...prev, bulkResults: refined, result: refined[0] ?? prev.result } : null);
      } else if (reviewState.testCaseId) {
        const res = await api.refineTestCase(storyId, reviewState.testCaseId, {
          instructions: refineInstructions,
          current_title: reviewState.result.title,
          current_steps: reviewState.result.steps,
          current_expected: reviewState.result.expectedResult,
          current_priority: reviewState.result.priority,
          file: refineFile || undefined,
        });
        const tc = res.test_case;
        setReviewState((prev) => prev ? {
          ...prev,
          result: {
            title: tc.title ?? prev.result.title,
            steps: tc.steps ?? prev.result.steps,
            expectedResult: tc.expected_result ?? prev.result.expectedResult,
            priority: tc.priority ?? prev.result.priority,
          }
        } : null);
      }
      setRefineInstructions("");
      setRefineFile(null);
    } catch {
      showToast('Refinement failed', 'error');
    } finally {
      setRefineLoading(false);
    }
  }, [storyId, reviewState, refineInstructions, refineFile]);

  // ── Accept Phase 2 result ─────────────────────────────────────────────────
  const handleAcceptReview = useCallback(async () => {
    if (!reviewState) return;
    try {
      if (reviewState.isBulk) {
        await Promise.all(
          reviewState.bulkResults.map((r) =>
            api.updateTestCase(storyId, r.id, {
              title: r.title, steps: r.steps,
              expected_result: r.expectedResult, priority: r.priority,
            })
          )
        );
        setTests((prev) => prev.map((t) => {
          const r = reviewState.bulkResults.find((x) => x.id === t.id);
          return r ? { ...t, title: r.title, steps: r.steps, expectedResult: r.expectedResult, priority: r.priority as any, status: 'Pending' as any } : t;
        }));
        setChecked(new Set());
        showToast(`${reviewState.bulkResults.length} test cases updated ✓`);
        invalidateStories();
      } else if (reviewState.testCaseId) {
        await api.updateTestCase(storyId, reviewState.testCaseId, {
          title: reviewState.result.title,
          steps: reviewState.result.steps,
          expected_result: reviewState.result.expectedResult,
          priority: reviewState.result.priority,
        });
        setTests((prev) => prev.map((t) => t.id === reviewState.testCaseId ? {
          ...t,
          title: reviewState.result.title,
          steps: reviewState.result.steps,
          expectedResult: reviewState.result.expectedResult,
          priority: reviewState.result.priority as any,
          status: 'Pending' as any,
        } : t));
        showToast('Test case updated ✓');
        invalidateStories();
      }
      setReviewState(null); // only close on success
    } catch {
      showToast('Failed to save', 'error');
      // Keep modal open so user can retry -- do NOT call setReviewState(null)
    }
  }, [storyId, reviewState]);

  // ── Edit ──────────────────────────────────────────────────────────────────
  const openEdit = (tc: TestCase) => {
    setEditingId(tc.id);
    setEditState({
      title: tc.title,
      steps: [...tc.steps],
      expectedResult: tc.expectedResult,
      priority: tc.priority,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editState) return;
    setEditSaving(true);
    try {
      await api.updateTestCase(storyId, editingId, {
        title: editState.title,
        steps: editState.steps.filter((s) => s.trim()),
        expected_result: editState.expectedResult,
        priority: editState.priority,
      });
      setTests((prev) => prev.map((t) => t.id === editingId ? {
        ...t,
        title: editState.title,
        steps: editState.steps.filter((s) => s.trim()),
        expectedResult: editState.expectedResult,
        priority: editState.priority as any,
      } : t));
      setEditingId(null);
      showToast('Test case updated ✓');
    } catch {
      showToast('Failed to save changes', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  if (tests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-5">
          <TestTube2 size={28} />
        </div>
        <h2 className="text-h2 text-navy mb-2">No tests yet</h2>
        <p className="text-sm text-muted max-w-sm">Test cases will appear here once generated.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full relative" style={{ minHeight: "calc(100vh - 220px)" }}>

      {/* Hidden file input for refine */}
      <input ref={refineFileRef} type="file" accept=".pdf,.docx,.txt,.md" className="hidden"
        onChange={(e) => setRefineFile(e.target.files?.[0] ?? null)} />

      {/* Phase 2 -- Review & Refine Modal */}
      <AnimatePresence>
        {reviewState && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-white z-10">
                <div>
                  <h2 className="text-base font-semibold text-navy">
                    {reviewState.isBulk ? `Review ${reviewState.bulkResults.length} Regenerated Test Cases` : 'Review Regenerated Test Case'}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">Accept to save, or ask for more improvements below</p>
                </div>
                <button onClick={() => setReviewState(null)} className="text-muted hover:text-navy"><X size={18} /></button>
              </div>

              <div className="px-6 py-5 space-y-5">
                {/* Results */}
                {reviewState.isBulk ? (
                  <div className="space-y-3">
                    {reviewState.bulkResults.map((r, i) => (
                      <div key={r.id} className="border border-border rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-muted">#{i + 1}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[r.priority] ?? priorityColor.P2}`}>{r.priority}</span>
                          <p className="text-sm font-semibold text-navy">{r.title}</p>
                        </div>
                        <ol className="space-y-1">
                          {r.steps.map((s, j) => (
                            <li key={j} className="flex gap-2 text-xs text-navy">
                              <span className="text-muted w-4 flex-shrink-0">{j + 1}.</span>{s}
                            </li>
                          ))}
                        </ol>
                        <p className="text-xs text-muted mt-2"><span className="font-semibold">Expected:</span> {r.expectedResult}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[reviewState.result.priority] ?? priorityColor.P2}`}>
                        {reviewState.result.priority}
                      </span>
                      <p className="text-sm font-semibold text-navy">{reviewState.result.title}</p>
                    </div>
                    <ol className="space-y-1">
                      {reviewState.result.steps.map((s, i) => (
                        <li key={i} className="flex gap-2 text-xs text-navy">
                          <span className="text-muted w-4 flex-shrink-0">{i + 1}.</span>{s}
                        </li>
                      ))}
                    </ol>
                    <p className="text-xs text-muted mt-2"><span className="font-semibold">Expected:</span> {reviewState.result.expectedResult}</p>
                    {reviewState.original && (
                      <details className="mt-3">
                        <summary className="text-xs text-muted cursor-pointer hover:text-navy">Show original</summary>
                        <div className="mt-2 pl-3 border-l-2 border-border">
                          <p className="text-xs text-muted line-through">{reviewState.original.title}</p>
                          <p className="text-xs text-muted mt-1">Steps: {reviewState.original.steps.join(' → ')}</p>
                        </div>
                      </details>
                    )}
                  </div>
                )}

                {/* Refine prompt */}
                <div className="border-t border-border pt-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Want to improve further?</p>
                  <div className="flex gap-2">
                    <textarea
                      value={refineInstructions}
                      onChange={(e) => setRefineInstructions(e.target.value)}
                      placeholder="e.g. Add more boundary cases, make step 3 more specific…"
                      rows={2}
                      className="flex-1 px-3 py-2 text-sm border border-border rounded-xl focus:outline-none focus:border-pink resize-none placeholder:text-muted/60"
                    />
                    <div className="flex flex-col gap-1.5">
                      <button onClick={() => refineFileRef.current?.click()}
                        title="Attach document"
                        className={`h-9 w-9 flex items-center justify-center rounded-xl border transition-colors ${refineFile ? 'border-pink text-pink bg-surface-pink' : 'border-border text-muted hover:border-pink hover:text-pink'}`}>
                        <Paperclip size={14} />
                      </button>
                      <button onClick={handleRefine} disabled={!refineInstructions.trim() || refineLoading}
                        className="h-9 w-9 flex items-center justify-center bg-pink text-white rounded-xl hover:bg-[#e0005f] disabled:opacity-40">
                        {refineLoading ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                      </button>
                    </div>
                  </div>
                  {refineFile && (
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-pink">
                      <FileText size={12} />{refineFile.name}
                      <button onClick={() => setRefineFile(null)}><X size={11} /></button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-border sticky bottom-0 bg-white">
                <button onClick={() => setReviewState(null)} className="h-9 px-4 text-sm border border-border rounded-btn text-navy hover:bg-gray-50">
                  Discard
                </button>
                <button onClick={handleAcceptReview} className="h-9 px-5 text-sm bg-success text-white rounded-btn hover:bg-success/90 flex items-center gap-2">
                  <Check size={14} /> Accept & Save
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg ${
              toast.type === 'success' ? 'bg-success text-white' : 'bg-error text-white'
            }`}
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Regenerate Modal */}
      <AnimatePresence>
        {(regenModalId || regenBulkMode) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) { setRegenModalId(null); setRegenBulkMode(false); } }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div>
                  <h2 className="text-base font-semibold text-navy">
                    {regenBulkMode ? `Regenerate ${checked.size} Test Cases` : 'Regenerate Test Case'}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">Tell the AI how to improve {regenBulkMode ? 'these test cases' : 'this test case'}</p>
                </div>
                <button onClick={() => { setRegenModalId(null); setRegenBulkMode(false); }} className="text-muted hover:text-navy">
                  <X size={18} />
                </button>
              </div>

              {/* Current test case preview */}
              {(() => {
                const tc = tests.find((t) => t.id === regenModalId);
                return tc ? (
                  <div className="px-6 pt-4 pb-2">
                    <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">Current test case</p>
                    <div className="bg-gray-50 rounded-xl px-4 py-3 border border-border">
                      <p className="text-sm font-semibold text-navy">{tc.title}</p>
                      <p className="text-xs text-muted mt-1">{tc.steps.length} steps · Expected: {tc.expectedResult.slice(0, 60)}{tc.expectedResult.length > 60 ? '…' : ''}</p>
                    </div>
                  </div>
                ) : null;
              })()}

              <div className="px-6 py-4 space-y-4">
                {/* Instructions */}
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">
                    What should we improve? <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={regenInstructions}
                    onChange={(e) => setRegenInstructions(e.target.value)}
                    placeholder="e.g. Make steps more detailed, add edge cases for empty input, include error message validation…"
                    rows={3}
                    className="w-full px-3 py-2.5 text-sm border border-border rounded-xl focus:outline-none focus:border-pink resize-none placeholder:text-muted/60"
                  />
                </div>

                {/* File attachment */}
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1.5">
                    Attach document for extra context <span className="font-normal normal-case">(optional)</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    className="hidden"
                    onChange={(e) => setRegenFile(e.target.files?.[0] ?? null)}
                  />
                  {regenFile ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-surface-pink border border-pink/30 rounded-xl">
                      <FileText size={15} className="text-pink flex-shrink-0" />
                      <span className="text-sm text-navy flex-1 truncate">{regenFile.name}</span>
                      <button onClick={() => { setRegenFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="text-muted hover:text-error">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-xl text-sm text-muted hover:border-pink hover:text-pink transition-colors w-full"
                    >
                      <Paperclip size={14} />
                      Attach PDF, DOCX, or TXT
                    </button>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
                <button onClick={() => { if (!regenSubmitting) { setRegenModalId(null); setRegenBulkMode(false); } }} disabled={regenSubmitting} className="h-9 px-4 text-sm border border-border rounded-btn text-navy hover:bg-gray-50 disabled:opacity-40">
                  Cancel
                </button>
                <button
                  onClick={handleRegenSubmit}
                  disabled={regenSubmitting}
                  className="h-9 px-4 text-sm bg-pink text-white rounded-btn hover:bg-[#e0005f] flex items-center gap-2 disabled:opacity-80"
                >
                  {regenSubmitting
                    ? <><Loader2 size={13} className="animate-spin" /> Regenerating…</>
                    : <><RefreshCw size={13} /> Regenerate</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {editingId && editState && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingId(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <h2 className="text-base font-semibold text-navy">Edit Test Case</h2>
                <button onClick={() => setEditingId(null)} className="text-muted hover:text-navy">
                  <X size={18} />
                </button>
              </div>
              <div className="px-6 py-5 space-y-4">
                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1">Title</label>
                  <input
                    value={editState.title}
                    onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                    className="w-full h-9 px-3 text-sm border border-border rounded-btn focus:outline-none focus:border-pink"
                  />
                </div>
                {/* Priority */}
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1">Priority</label>
                  <select
                    value={editState.priority}
                    onChange={(e) => setEditState({ ...editState, priority: e.target.value })}
                    className="h-9 px-3 text-sm border border-border rounded-btn focus:outline-none focus:border-pink bg-white"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                    <option value="P1">P1</option>
                    <option value="P2">P2</option>
                    <option value="P3">P3</option>
                  </select>
                </div>
                {/* Steps */}
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-2">Steps</label>
                  <div className="space-y-2">
                    {editState.steps.map((step, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs text-muted w-5 text-right flex-shrink-0">{i + 1}.</span>
                        <input
                          value={step}
                          onChange={(e) => {
                            const s = [...editState.steps];
                            s[i] = e.target.value;
                            setEditState({ ...editState, steps: s });
                          }}
                          className="flex-1 h-8 px-3 text-sm border border-border rounded-btn focus:outline-none focus:border-pink"
                        />
                        <button
                          onClick={() => setEditState({ ...editState, steps: editState.steps.filter((_, j) => j !== i) })}
                          className="text-muted hover:text-error flex-shrink-0"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => setEditState({ ...editState, steps: [...editState.steps, ''] })}
                      className="flex items-center gap-1.5 text-xs text-pink font-medium hover:underline mt-1"
                    >
                      <Plus size={13} /> Add step
                    </button>
                  </div>
                </div>
                {/* Expected Result */}
                <div>
                  <label className="text-xs font-semibold text-muted uppercase tracking-wide block mb-1">Expected Result</label>
                  <textarea
                    value={editState.expectedResult}
                    onChange={(e) => setEditState({ ...editState, expectedResult: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 text-sm border border-border rounded-btn focus:outline-none focus:border-pink resize-none"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 px-6 py-4 border-t border-border">
                <button onClick={() => setEditingId(null)} className="h-9 px-4 text-sm border border-border rounded-btn text-navy hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={editSaving}
                  className="h-9 px-4 text-sm bg-pink text-white rounded-btn hover:bg-[#e0005f] disabled:opacity-60 flex items-center gap-2"
                >
                  {editSaving && <Loader2 size={13} className="animate-spin" />}
                  Save changes
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Left panel */}
      <div className="w-[320px] flex-shrink-0 border-r border-border flex flex-col">
        {/* Toolbar */}
        <div className="px-3 pt-3 pb-2 space-y-2">
          {/* Row 1: Filter dropdown + AI Group button */}
          <div className="flex items-center gap-2">
            {/* Filter dropdown */}
            <div className="relative flex-1">
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as typeof filter)}
                className="w-full h-8 pl-3 pr-8 text-xs font-medium border border-border rounded-btn bg-white text-navy appearance-none cursor-pointer focus:outline-none focus:border-pink transition-colors"
              >
                <option value="All">All Types</option>
                <option value="Functional">Functional</option>
                <option value="Negative">Negative</option>
                <option value="Boundary">Boundary</option>
                <option value="Security">Security</option>
                <option value="Accessibility">Accessibility</option>
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                <ChevronDown size={12} className="text-muted" />
              </div>
            </div>
            {/* Priority filter */}
            <div className="relative">
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-medium border border-border rounded-btn bg-white text-navy appearance-none cursor-pointer focus:outline-none focus:border-pink transition-colors"
              >
                <option value="">All Priority</option>
                <option value="P1">P1</option>
                <option value="P2">P2</option>
                <option value="P3">P3</option>
              </select>
              <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
                <ChevronDown size={12} className="text-muted" />
              </div>
            </div>
            {/* Status filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-8 pl-3 pr-7 text-xs font-medium border border-border rounded-btn bg-white text-navy appearance-none cursor-pointer focus:outline-none focus:border-pink transition-colors"
              >
                <option value="">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Approved">Approved</option>
              </select>
              <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
                <ChevronDown size={12} className="text-muted" />
              </div>
            </div>
            {/* Version filter -- only shown if any test case has version > 1 */}
            {tests.some(t => t.version && t.version > 1) && (
              <div className="relative">
                <select
                  value={versionFilter}
                  onChange={(e) => setVersionFilter(e.target.value)}
                  className="h-8 pl-3 pr-7 text-xs font-medium border border-pink/40 rounded-btn bg-pink/5 text-pink appearance-none cursor-pointer focus:outline-none focus:border-pink transition-colors"
                >
                  <option value="">All Versions</option>
                  {Array.from(new Set(tests.map(t => t.version).filter(Boolean))).sort().map(v => (
                    <option key={v} value={String(v)}>v{v} only</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
                  <ChevronDown size={12} className="text-pink" />
                </div>
              </div>
            )}
          </div>
          {/* Row 2: Search + AI Group button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text" placeholder="Search tests…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-8 pl-3 pr-8 text-xs border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-navy">
                  <X size={12} />
                </button>
              )}
            </div>
            {/* AI Group button */}
            <button
              onClick={handleRegroup}
              disabled={regrouping}
              title="Let AI group test cases by theme"
              className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-surface-pink hover:border-pink hover:text-pink transition-colors flex items-center gap-1.5 disabled:opacity-60 flex-shrink-0"
            >
              {regrouping
                ? <><Loader2 size={11} className="animate-spin" /> Grouping…</>
                : <><Sparkles size={11} /> AI Group</>
              }
            </button>
          </div>
          {/* Active filter indicator */}
          {(filter !== 'All' || priorityFilter || statusFilter || versionFilter) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {filter !== 'All' && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink/10 text-pink border border-pink/20">
                  {filter} <button onClick={() => setFilter('All')}><X size={9} /></button>
                </span>
              )}
              {priorityFilter && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-pink text-pink border border-pink/20">
                  {priorityFilter} <button onClick={() => setPriorityFilter('')}><X size={9} /></button>
                </span>
              )}
              {statusFilter && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-pink text-pink border border-pink/20">
                  {statusFilter} <button onClick={() => setStatusFilter('')}><X size={9} /></button>
                </span>
              )}
              {versionFilter && (
                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-pink/10 text-pink border border-pink/20">
                  v{versionFilter} only <button onClick={() => setVersionFilter('')}><X size={9} /></button>
                </span>
              )}
              <button onClick={() => { setFilter('All'); setPriorityFilter(''); setStatusFilter(''); setVersionFilter(''); }} className="text-[10px] text-muted hover:text-error ml-auto">
                Clear all
              </button>
            </div>
          )}
        </div>
        {/* Bulk action bar */}
        <AnimatePresence>
          {checked.size > 0 && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: duration.fast }} className="overflow-hidden"
            >
              <div className="px-3 py-2 bg-surface-pink border-b border-border flex items-center gap-2">
                <span className="text-xs font-semibold text-navy">{checked.size} selected</span>
                {bulkLoading ? <Loader2 size={12} className="animate-spin text-muted" /> : (
                  <>
                    <button onClick={handleBulkApprove} className="text-xs text-success hover:underline font-medium">Approve all</button>
                    <button
                      onClick={() => { setRegenBulkMode(true); setRegenInstructions(""); setRegenFile(null); setRegenModalId("bulk"); }}
                      className="text-xs text-pink hover:underline font-medium"
                    >Regenerate all</button>
                    <button onClick={handleBulkDelete} className="text-xs text-error hover:underline font-medium">Delete all</button>
                  </>
                )}
                <button onClick={() => setChecked(new Set())} className="ml-auto text-muted hover:text-navy"><X size={13} /></button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Test list -- grouped by AI feature group */}
        <div className="flex-1 overflow-y-auto">
          {Object.entries(groupedTests).map(([groupName, groupTests]) => {
            const isCollapsed = collapsedGroups.has(groupName);
            return (
              <div key={groupName}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(groupName)}
                  className="w-full flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-border hover:bg-gray-100 transition-colors sticky top-0 z-10"
                >
                  <span className="text-[11px] font-bold text-navy uppercase tracking-wide truncate">{groupName}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[10px] text-muted font-medium">{groupTests.length}</span>
                    <ChevronDown size={13} className={`text-muted transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </div>
                </button>
                {/* Group items */}
                {!isCollapsed && groupTests.map((test) => (
                  <button key={test.id} onClick={() => setSelected(test.id)}
                    className={`w-full flex items-center gap-3 px-3 h-11 text-left border-b border-border transition-colors relative ${
                      selected === test.id ? "bg-surface-pink" : "hover:bg-gray-50"
                    }`}
                  >
                    {selected === test.id && (
                      <motion.div layoutId="test-active-row"
                        className="absolute left-0 top-0 bottom-0 w-0.5 bg-pink"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    <input type="checkbox" checked={checked.has(test.id)}
                      onChange={(e) => { e.stopPropagation(); toggleCheck(test.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-3.5 h-3.5 accent-pink flex-shrink-0"
                    />
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[test.priority] ?? priorityColor.P2}`}>
                      {test.priority}
                    </span>
                    <span className="flex-1 text-[12px] font-semibold text-navy truncate">{test.title}</span>
                    {test.version && test.version > 1 && (
                      <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-pink/10 text-pink border border-pink/20 flex-shrink-0">
                        v{test.version}
                      </span>
                    )}
                    {regenIds.has(test.id) ? (
                      <Loader2 size={13} className="text-pink animate-spin flex-shrink-0" />
                    ) : test.status === "Approved" ? (
                      <CheckCircle2 size={13} className="text-success flex-shrink-0" />
                    ) : test.status === "Rejected" ? (
                      <X size={13} className="text-error flex-shrink-0" />
                    ) : (
                      <Clock size={13} className="text-muted flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedTest ? (
            <motion.div key={selectedTest.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: duration.fast, ease: easeStandard }}
              className="p-6 space-y-5"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-semibold text-navy mb-2">{selectedTest.title}</h2>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${priorityColor[selectedTest.priority] ?? priorityColor.P2}`}>
                      {selectedTest.priority}
                    </span>
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${typeColor[selectedTest.type] ?? typeColor.Functional}`}>
                      {selectedTest.type}
                    </span>
                    {selectedTest.version && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        selectedTest.version > 1
                          ? 'bg-pink/10 text-pink border-pink/20'
                          : 'bg-gray-50 text-muted border-border'
                      }`}>
                        v{selectedTest.version}
                      </span>
                    )}
                    <AIConfidenceBadge level={confidenceLevel(testConfidence(selectedTest))} score={testConfidence(selectedTest)} />
                    {selectedTest.status === "Approved" ? (
                      <span className="text-[11px] font-semibold text-success flex items-center gap-1">
                        <Check size={12} /> Approved
                      </span>
                    ) : selectedTest.status === 'Rejected' ? (
                      <span className="text-[11px] font-semibold text-error flex items-center gap-1">
                        <X size={12} /> Rejected
                      </span>
                    ) : regenIds.has(selectedTest.id) ? (
                      <span className="text-[11px] font-semibold text-pink flex items-center gap-1">
                        <Loader2 size={12} className="animate-spin" /> Regenerating…
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                        <Clock size={12} /> Pending
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                  {/* Approve / Reject -- only show if not already in that state */}
                  {selectedTest.status !== 'Approved' && (
                    <button
                      onClick={() => handleApprove(selectedTest.id)}
                      disabled={approvingIds.has(selectedTest.id)}
                      className="h-8 px-3 text-xs font-medium rounded-btn border bg-success/10 text-success border-success/30 hover:bg-success/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {approvingIds.has(selectedTest.id) ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                      Approve
                    </button>
                  )}
                  {selectedTest.status !== 'Rejected' && (
                    <button
                      onClick={() => handleReject(selectedTest.id)}
                      disabled={approvingIds.has(selectedTest.id)}
                      className="h-8 px-3 text-xs font-medium rounded-btn border bg-error/10 text-error border-error/30 hover:bg-error/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                    >
                      {approvingIds.has(selectedTest.id) ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                      Reject
                    </button>
                  )}
                  {/* Regenerate */}
                  <button
                    onClick={() => handleRegenerate(selectedTest.id)}
                    disabled={regenIds.has(selectedTest.id)}
                    className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {regenIds.has(selectedTest.id) ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                    Regenerate
                  </button>
                  {/* Edit */}
                  <button
                    onClick={() => openEdit(selectedTest)}
                    className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-1.5"
                  >
                    <Pencil size={12} /> Edit
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(selectedTest.id)}
                    disabled={deletingIds.has(selectedTest.id)}
                    className="h-8 px-3 text-xs font-medium bg-error/10 text-error border border-error/30 rounded-btn hover:bg-error/20 transition-colors flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {deletingIds.has(selectedTest.id) ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                    Delete
                  </button>
                </div>
              </div>

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
                </div>
              )}

              {/* ── Execution: Pass / Fail / Skip ── */}
              <ExecutionPanel storyId={storyId} testCaseId={selectedTest.id} />
            </motion.div>
          ) : (
            <motion.div key="empty" {...fadeInUp} className="flex items-center justify-center h-full py-24">
              <p className="text-sm text-muted">Select a test to view details</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    <>
    
    </>
  );
}
