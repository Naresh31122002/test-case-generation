"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, ArrowRightLeft } from "lucide-react";
import { stories } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { fadeInUp, staggerContainer, duration, easeOut } from "@/lib/motion";

const testTypes = ["Functional", "Negative", "Boundary", "Security", "Accessibility"] as const;

const mockBreakdown: Record<string, Record<string, number>> = {
  "LOGIN-001": { Functional: 100, Negative: 85, Boundary: 70, Security: 60, Accessibility: 30 },
  "AUTH-010":  { Functional: 60,  Negative: 40, Boundary: 30, Security: 35, Accessibility: 10 },
  "AUTH-002":  { Functional: 90,  Negative: 70, Boundary: 55, Security: 45, Accessibility: 25 },
  "AUTH-003":  { Functional: 95,  Negative: 80, Boundary: 65, Security: 70, Accessibility: 40 },
  "PROFILE-003": { Functional: 70, Negative: 50, Boundary: 40, Security: 20, Accessibility: 15 },
  "PAYMENT-001": { Functional: 80, Negative: 65, Boundary: 50, Security: 55, Accessibility: 20 },
};

const mockTests: Record<string, string[]> = {
  "LOGIN-001": [
    "Successful login with valid credentials",
    "Login fails with wrong password",
    "Login fails with unregistered email",
    "Account locks after 3 failed attempts",
    "Password field is masked",
    "SQL injection protection",
  ],
  "AUTH-010": [
    "OAuth redirect to Google",
    "OAuth redirect to GitHub",
    "OAuth success creates session",
    "OAuth cancellation handled",
  ],
};

function getTests(id: string) {
  return mockTests[id] ?? ["Happy path scenario", "Error state handling", "Boundary value test"];
}

function getSimilar(a: string[], b: string[]) {
  return a.filter((t) => b.some((bt) => bt.split(" ").slice(0, 3).join(" ") === t.split(" ").slice(0, 3).join(" ")));
}

export default function ComparePage() {
  const [storyA, setStoryA] = useState<string>("LOGIN-001");
  const [storyB, setStoryB] = useState<string>("AUTH-010");

  const bothSelected = storyA && storyB && storyA !== storyB;
  const sa = stories.find((s) => s.id === storyA);
  const sb = stories.find((s) => s.id === storyB);

  const testsA = getTests(storyA);
  const testsB = getTests(storyB);
  const onlyA = testsA.filter((t) => !testsB.includes(t));
  const onlyB = testsB.filter((t) => !testsA.includes(t));
  const similar = getSimilar(testsA, testsB);

  const coverageDelta = sa && sb ? sb.coverage - sa.coverage : 0;

  const swap = () => { setStoryA(storyB); setStoryB(storyA); };

  return (
    <div className="flex flex-col h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center px-8">
        <h1 className="text-2xl font-semibold text-navy">Compare</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="max-w-content mx-auto space-y-8">

          {/* Story selectors */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Story A</label>
              <select
                value={storyA}
                onChange={(e) => setStoryA(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="">Select a story…</option>
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
                ))}
              </select>
            </div>
            <button
              onClick={swap}
              className="mt-5 w-10 h-10 flex items-center justify-center border border-border rounded-btn text-muted hover:text-navy hover:bg-gray-50 transition-colors flex-shrink-0"
              title="Swap stories"
            >
              <ArrowRightLeft size={16} />
            </button>
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5 block">Story B</label>
              <select
                value={storyB}
                onChange={(e) => setStoryB(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan transition-colors"
              >
                <option value="">Select a story…</option>
                {stories.map((s) => (
                  <option key={s.id} value={s.id}>{s.id} — {s.title}</option>
                ))}
              </select>
            </div>
          </div>

          {!bothSelected ? (
            <motion.div
              {...fadeInUp}
              className="flex flex-col items-center justify-center py-24 text-center"
            >
              <ArrowLeftRight size={48} className="text-muted mb-4" />
              <h2 className="text-[18px] font-semibold text-navy mb-2">Select two stories above to begin comparison.</h2>
              <p className="text-sm text-muted">Side-by-side coverage, tests, and diff analysis.</p>
            </motion.div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${storyA}-${storyB}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.base }}
                className="space-y-6"
              >
                {/* Delta summary cards */}
                <motion.div
                  variants={staggerContainer}
                  initial="initial"
                  animate="animate"
                  className="grid grid-cols-4 gap-4"
                >
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
                    <p className="text-2xl font-bold text-warning">+3</p>
                    <p className="text-sm text-[#92400E] font-medium mt-1">Risk Delta</p>
                  </motion.div>
                </motion.div>

                {/* Coverage comparison */}
                <div className="bg-white border border-border rounded-card p-5">
                  <h2 className="text-[15px] font-semibold text-navy mb-5">Coverage Comparison</h2>
                  <div className="flex gap-8 items-start">
                    {/* Donut A */}
                    <div className="flex flex-col items-center gap-2">
                      <CompareDonut coverage={sa!.coverage} label={sa!.id} />
                    </div>
                    {/* Bars */}
                    <div className="flex-1 space-y-3">
                      {testTypes.map((type, i) => {
                        const valA = mockBreakdown[storyA]?.[type] ?? 0;
                        const valB = mockBreakdown[storyB]?.[type] ?? 0;
                        return (
                          <div key={type}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="font-medium text-navy">{type}</span>
                              <span className="text-muted">
                                <span className="font-semibold text-cyan">{valA}%</span>
                                {" vs "}
                                <span className="font-semibold text-pink">{valB}%</span>
                              </span>
                            </div>
                            <div className="relative h-2.5 bg-border rounded-full overflow-hidden">
                              <motion.div
                                className="absolute top-0 left-0 h-full bg-cyan/60 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${valA}%` }}
                                transition={{ duration: 0.5, delay: i * 0.05, ease: easeOut }}
                              />
                              <motion.div
                                className="absolute top-0 left-0 h-full border-r-2 border-pink"
                                initial={{ width: 0 }}
                                animate={{ width: `${valB}%` }}
                                transition={{ duration: 0.5, delay: i * 0.05 + 0.1, ease: easeOut }}
                                style={{ background: "transparent" }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex items-center gap-4 pt-1">
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <span className="w-3 h-1.5 rounded bg-cyan/60 inline-block" />{sa!.id}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-muted">
                          <span className="w-3 h-1.5 rounded bg-pink inline-block" />{sb!.id}
                        </span>
                      </div>
                    </div>
                    {/* Donut B */}
                    <div className="flex flex-col items-center gap-2">
                      <CompareDonut coverage={sb!.coverage} label={sb!.id} color="#FF0A78" />
                    </div>
                  </div>
                </div>

                {/* Test comparison */}
                <div className="grid grid-cols-3 gap-4">
                  <TestColumn title={`Only in ${storyA}`} tests={onlyA} color="cyan" />
                  <TestColumn title="Similar in Both" tests={similar} color="success" similarity={92} />
                  <TestColumn title={`Only in ${storyB}`} tests={onlyB} color="pink" />
                </div>

              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function TestColumn({
  title, tests, color, similarity,
}: {
  title: string;
  tests: string[];
  color: "cyan" | "pink" | "success";
  similarity?: number;
}) {
  const borderColor = color === "cyan" ? "border-cyan/30" : color === "pink" ? "border-pink/30" : "border-success/30";
  const bgColor = color === "cyan" ? "bg-[#ECFEFF]" : color === "pink" ? "bg-[#FFF0F7]" : "bg-[#ECFDF5]";
  const textColor = color === "cyan" ? "text-cyan" : color === "pink" ? "text-pink" : "text-success";

  return (
    <div className={`border rounded-card overflow-hidden ${borderColor}`}>
      <div className={`px-4 py-3 border-b ${borderColor} ${bgColor} flex items-center justify-between`}>
        <h3 className={`text-[13px] font-semibold ${textColor}`}>{title}</h3>
        {similarity !== undefined && (
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${bgColor} ${textColor} border ${borderColor}`}>
            {similarity}% similar
          </span>
        )}
        <span className={`text-[11px] font-semibold ${textColor}`}>{tests.length}</span>
      </div>
      <div className="divide-y divide-border bg-white">
        {tests.length === 0 ? (
          <p className="px-4 py-3 text-xs text-muted">None</p>
        ) : (
          tests.map((t, i) => (
            <p key={i} className="px-4 py-2.5 text-sm text-navy">{t}</p>
          ))
        )}
      </div>
    </div>
  );
}

function CompareDonut({ coverage, label, color = "#06B6D4" }: { coverage: number; label: string; color?: string }) {
  const size = 100;
  const sw = 10;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - coverage / 100);
  const c = size / 2;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="rotate-[-90deg]">
          <circle cx={c} cy={c} r={r} fill="none" stroke="#E2E8F0" strokeWidth={sw} />
          <motion.circle
            cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={sw}
            strokeLinecap="round"
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            style={{ strokeDasharray: circ }}
            transition={{ duration: 0.5, ease: easeOut }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-bold text-navy">{coverage}%</span>
        </div>
      </div>
      <span className="text-[11px] font-semibold text-muted">{label}</span>
    </div>
  );
}
