"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, ArrowRightLeft, Loader2, GitCompare } from "lucide-react";
import { FeatureIntroCard } from "@/components/ui/FeatureIntroCard";
import { fadeInUp, staggerContainer, duration, easeOut } from "@/lib/motion";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";
import { ErrorBanner } from "@/components/ui/ErrorBanner";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import type { Story } from "@/lib/seed";

const testTypes = ["Functional", "Negative", "Boundary", "Security", "Performance"] as const;

function inferCategory(title: string): string {
  const t = title.toLowerCase();
  if (/\b(security|auth|inject|xss|csrf|permission|token|bypass)\b/.test(t)) return "Security";
  if (/\b(boundary|limit|max|min|overflow|empty|null|zero|exceed)\b/.test(t)) return "Boundary";
  if (/\b(invalid|fail|error|reject|wrong|missing|incorrect|denied)\b/.test(t)) return "Negative";
  if (/\b(performance|load|throughput|timeout|latency)\b/.test(t)) return "Performance";
  return "Functional";
}

function wordOverlapSimilar(a: string, b: string): boolean {
  const wordsA = new Set(a.toLowerCase().split(" ").filter(Boolean));
  return b.toLowerCase().split(" ").filter(Boolean).filter((w) => wordsA.has(w)).length >= 2;
}

function heuristicCoverage(n: number) { return Math.min(100, Math.round((n / 40) * 100)); }

export default function ComparePage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [testLoadError, setTestLoadError] = useState(false);
  const [storyA, setStoryA] = useState<string>("");
  const [storyB, setStoryB] = useState<string>("");
  const [testsA, setTestsA] = useState<string[]>([]);
  const [testsB, setTestsB] = useState<string[]>([]);
  const [loadingTests, setLoadingTests] = useState(false);

  const loadStories = () => {
    setFetchError(false);
    setLoading(true);
    api.getStories(1, 200)
      .then((res) => {
        const mapped = res.data.map(domainStoryToSeed);
        setStories(mapped);
        if (mapped.length >= 2) { setStoryA(mapped[0].id); setStoryB(mapped[1].id); }
        else if (mapped.length === 1) { setStoryA(mapped[0].id); }
      })
      .catch(() => setFetchError(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStories(); }, []);

  useEffect(() => {
    if (!storyA || !storyB || storyA === storyB) { setTestsA([]); setTestsB([]); return; }
    setLoadingTests(true);
    setTestLoadError(false);
    Promise.allSettled([api.getTestCases(storyA), api.getTestCases(storyB)])
      .then(([a, b]) => {
        setTestsA(a.status === 'fulfilled' ? a.value.testCases.map((tc) => tc.title) : []);
        setTestsB(b.status === 'fulfilled' ? b.value.testCases.map((tc) => tc.title) : []);
        if (a.status === 'rejected' || b.status === 'rejected') setTestLoadError(true);
      })
      .finally(() => setLoadingTests(false));
  }, [storyA, storyB]);

  const bothSelected = storyA && storyB && storyA !== storyB;
  const sa = stories.find((s) => s.id === storyA);
  const sb = stories.find((s) => s.id === storyB);
  const onlyA = testsA.filter((t) => !testsB.some((bt) => wordOverlapSimilar(t, bt)));
  const onlyB = testsB.filter((t) => !testsA.some((at) => wordOverlapSimilar(t, at)));
  const similar = testsA.filter((t) => testsB.some((bt) => wordOverlapSimilar(t, bt)));
  const coverageDelta = sa && sb ? sb.coverage - sa.coverage : 0;

  // Per-type breakdown from classified test titles
  function getBreakdown(titles: string[]): Record<string, number> {
    const counts: Record<string, number> = { Functional: 0, Negative: 0, Boundary: 0, Security: 0, Performance: 0 };
    for (const t of titles) { const cat = inferCategory(t); if (cat in counts) counts[cat]++; }
    const total = titles.length || 1;
    return Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, Math.round((v / total) * 100)]));
  }
  const breakdownA = getBreakdown(testsA);
  const breakdownB = getBreakdown(testsB);

  const swap = () => { setStoryA(storyB); setStoryB(storyA); };

  if (loading) return (
    <PageLayout>
      <PageHeader title="Compare" actions={<PageActions fullscreen />} />
      <PageBody><div className="flex items-center justify-center py-24"><Loader2 size={32} className="animate-spin text-muted" /></div></PageBody>
    </PageLayout>
  );

  if (fetchError) return (
    <PageLayout>
      <PageHeader title="Compare" actions={<PageActions fullscreen />} />
      <PageBody><ErrorBanner message="Could not load stories." detail="Check your connection and try again." onRetry={loadStories} /></PageBody>
    </PageLayout>
  );

  return (
    <PageLayout>
      <PageHeader title="Compare" actions={<PageActions fullscreen />} />
      <PageBody>
        <div className="space-y-8">
          <FeatureIntroCard
            storageKey="compare"
            icon={GitCompare}
            title="Story Comparison"
            description="Compare two versions of a story side-by-side to see exactly what changed. Understand which requirement changes require test updates before you regenerate."
          />
          {/* Story selectors */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Story A</label>
              <select value={storyA} onChange={(e) => setStoryA(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan transition-colors">
                <option value="">Select a story…</option>
                {stories.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}
              </select>
            </div>
            <button onClick={swap} className="mt-5 w-10 h-10 flex items-center justify-center border border-border rounded-btn text-muted hover:text-navy hover:bg-gray-50 transition-colors flex-shrink-0" title="Swap">
              <ArrowRightLeft size={16} />
            </button>
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Story B</label>
              <select value={storyB} onChange={(e) => setStoryB(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan transition-colors">
                <option value="">Select a story…</option>
                {stories.map((s) => <option key={s.id} value={s.id}>{s.id} — {s.title}</option>)}
              </select>
            </div>
          </div>

          {!bothSelected ? (
            <motion.div {...fadeInUp} className="flex flex-col items-center justify-center py-24 text-center">
              <ArrowLeftRight size={48} className="text-muted mb-4" />
              <h2 className="text-[18px] font-semibold text-navy mb-2">Select two stories above to begin comparison.</h2>
              <p className="text-sm text-muted">Side-by-side test and coverage analysis.</p>
            </motion.div>
          ) : loadingTests ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={28} className="animate-spin text-muted" /></div>
          ) : testLoadError ? (
            <ErrorBanner message="Could not load test cases for one or both stories." compact onRetry={() => { setStoryA(sa => sa); }} />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div key={`${storyA}-${storyB}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: duration.base }} className="space-y-6">

                {/* Delta summary cards */}
                <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-4 gap-4">
                  <motion.div variants={fadeInUp} className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-card p-4">
                    <p className="text-2xl font-bold text-success">+{onlyB.length}</p>
                    <p className="text-sm text-[#065F46] font-medium mt-1">Added Tests</p>
                  </motion.div>
                  <motion.div variants={fadeInUp} className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-card p-4">
                    <p className="text-2xl font-bold text-error">−{onlyA.length}</p>
                    <p className="text-sm text-[#991B1B] font-medium mt-1">Removed Tests</p>
                  </motion.div>
                  <motion.div variants={fadeInUp} className={`border rounded-card p-4 ${coverageDelta >= 0 ? "bg-[#ECFEFF] border-cyan/40" : "bg-[#FEF2F2] border-[#FCA5A5]"}`}>
                    <p className={`text-2xl font-bold ${coverageDelta >= 0 ? "text-cyan" : "text-error"}`}>
                      {coverageDelta >= 0 ? "+" : ""}{coverageDelta}%
                    </p>
                    <p className="text-sm text-muted font-medium mt-1">Coverage Delta</p>
                  </motion.div>
                  <motion.div variants={fadeInUp} className="bg-[#FFFBEB] border border-[#FCD34D] rounded-card p-4">
                    <p className="text-2xl font-bold text-warning">{similar.length}</p>
                    <p className="text-sm text-[#92400E] font-medium mt-1">Similar Tests</p>
                  </motion.div>
                </motion.div>

                {/* Coverage comparison */}
                <div className="bg-white border border-border rounded-card p-5">
                  <h2 className="text-[15px] font-semibold text-navy mb-5">Coverage by Type</h2>
                  <div className="flex gap-8 items-start">
                    <div className="flex flex-col items-center gap-2">
                      <CompareDonut coverage={sa!.coverage} label={sa!.id} />
                    </div>
                    <div className="flex-1 space-y-3">
                      {testTypes.map((type, i) => {
                        const valA = breakdownA[type] ?? 0;
                        const valB = breakdownB[type] ?? 0;
                        return (
                          <div key={type}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-navy">{type}</span>
                              <span className="text-muted">
                                <span className="font-semibold text-cyan">{valA}%</span>{" vs "}
                                <span className="font-semibold text-pink">{valB}%</span>
                              </span>
                            </div>
                            <div className="relative h-2.5 bg-border rounded-full overflow-hidden">
                              <motion.div className="absolute top-0 left-0 h-full bg-cyan/60 rounded-full"
                                initial={{ width: 0 }} animate={{ width: `${valA}%` }}
                                transition={{ duration: 0.5, delay: i * 0.05, ease: easeOut }} />
                              <motion.div className="absolute top-0 left-0 h-full border-r-2 border-pink"
                                initial={{ width: 0 }} animate={{ width: `${valB}%` }}
                                transition={{ duration: 0.5, delay: i * 0.05 + 0.1, ease: easeOut }}
                                style={{ background: "transparent" }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-4 pt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted"><span className="w-3 h-1.5 rounded bg-cyan/60 inline-block" />{sa!.id}</span>
                        <span className="flex items-center gap-1.5 text-xs text-muted"><span className="w-3 h-1.5 rounded bg-pink inline-block" />{sb!.id}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <CompareDonut coverage={sb!.coverage} label={sb!.id} color="var(--color-brand-primary)" />
                    </div>
                  </div>
                </div>

                {/* Test comparison */}
                <div className="grid grid-cols-3 gap-4">
                  <TestColumn title={`Only in ${storyA}`} tests={onlyA} color="cyan" />
                  <TestColumn title={`Similar in Both`} tests={similar} color="success" similarity={similar.length > 0 ? Math.round((similar.length / Math.max(testsA.length, testsB.length)) * 100) : 0} />
                  <TestColumn title={`Only in ${storyB}`} tests={onlyB} color="pink" />
                </div>

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </PageBody>
    </PageLayout>
  );
}

function TestColumn({ title, tests, color, similarity }: { title: string; tests: string[]; color: "cyan" | "pink" | "success"; similarity?: number }) {
  const borderColor = color === "cyan" ? "border-cyan/30" : color === "pink" ? "border-pink/30" : "border-success/30";
  const bgColor = color === "cyan" ? "bg-[#ECFEFF]" : color === "pink" ? "bg-[#FFF0F7]" : "bg-[#ECFDF5]";
  const textColor = color === "cyan" ? "text-cyan" : color === "pink" ? "text-pink" : "text-success";
  return (
    <div className={`border rounded-card overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 border-b ${borderColor} ${bgColor} flex items-center justify-between`}>
        <h3 className={`text-[13px] font-semibold ${textColor}`}>{title}</h3>
        <div className="flex items-center gap-2">
          {similarity !== undefined && <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${bgColor} ${textColor} border ${borderColor}`}>{similarity}% similar</span>}
          <span className={`text-[11px] font-semibold ${textColor}`}>{tests.length}</span>
        </div>
      </div>
      <div className="divide-y divide-border bg-white">
        {tests.length === 0 ? <p className="px-4 py-3 text-xs text-muted">None</p> :
          tests.map((t, i) => <p key={i} className="px-4 py-2.5 text-sm text-navy">{t}</p>)}
      </div>
    </div>
  );
}

function CompareDonut({ coverage, label, color = "#06B6D4" }: { coverage: number; label: string; color?: string }) {
  const size = 100; const sw = 10; const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r; const offset = circ * (1 - coverage / 100); const c = size / 2;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={c} cy={c} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
          <motion.circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
            initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
            style={{ strokeDasharray: circ }} transition={{ duration: 0.5, ease: easeOut }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-navy">{coverage}%</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold text-muted">{label}</span>
    </div>
  );
}
