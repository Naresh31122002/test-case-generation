"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Upload,
  FileText,
  X,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  Pencil,
  Trash2,
  RefreshCw,
  Check,
  Loader2,
  Zap,
} from "lucide-react";
import {
  readSourceText,
  validateSources,
  analyzeRequirements,
  generateStories,
  regenerateStory,
  REQUIREMENT_CREDIT_RATES,
  type RequirementSource,
  type ExtractedAnalysis,
  type GeneratedStory,
} from "@/lib/ai/requirements";
import { AI_ACTION_COSTS, useAIAction } from "@/contexts/AIActionContext";
import { spring } from "@/lib/motion";
import { makeStoryId } from "@/lib/storyId";

type Phase = "input" | "analyzing" | "review" | "test-types";

const ACCEPTED = [".txt", ".docx", ".pdf", ".md"];
const acceptedFile = (f: File) => ACCEPTED.some((e) => f.name.toLowerCase().endsWith(e));
const fmtSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(1)} MB`);

const STEPS = [
  { id: 1, label: "Requirements" },
  { id: 2, label: "Review Stories" },
  { id: 3, label: "Test Types" },
  { id: 4, label: "Generate Tests" },
];

export default function GenerateStoriesPage() {
  const router = useRouter();
  const { creditsRemaining, runAIAction } = useAIAction();

  const [phase, setPhase] = useState<Phase>("input");
  const [files, setFiles] = useState<File[]>([]);
  const [pasted, setPasted] = useState("");
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<ExtractedAnalysis | null>(null);
  const [stories, setStories] = useState<GeneratedStory[]>([]);
  const [regenId, setRegenId] = useState<string | null>(null);

  /** Build the requirement sources from files + pasted text. */
  async function collectSources(): Promise<RequirementSource[]> {
    const fileSources = await Promise.all(files.map(readSourceText));
    const sources = [...fileSources];
    if (pasted.trim()) sources.push({ name: "Pasted requirements", text: pasted });
    return sources;
  }

  const docCount = files.length + (pasted.trim() ? 1 : 0);
  const analysisCredits = docCount * REQUIREMENT_CREDIT_RATES.analysisPerDoc;

  /* ── Analyze (validation gate + credit confirmation) ── */
  async function onAnalyze() {
    setErrors([]);
    const sources = await collectSources();
    const v = validateSources(sources);
    if (!v.valid) {
      setErrors(v.messages.length ? v.messages : ["The provided content is not valid requirements."]);
      return;
    }
    // Surface non-fatal warnings (e.g. one bad file among good ones) but proceed.
    const warnOnly = v.messages;

    runAIAction({
      name: "Requirement Analysis",
      credits: analysisCredits,
      description: `Analyze ${docCount} requirement ${docCount === 1 ? "document" : "documents"} to extract features, actors, business rules and acceptance criteria.`,
      run: async () => {
        setPhase("analyzing");
        const result = await analyzeRequirements(sources);
        // Guard: if extraction yields nothing meaningful, do NOT fabricate stories.
        const empty =
          result.features.length === 0 &&
          result.actors.length === 0 &&
          result.businessRules.length === 0 &&
          result.acceptanceCriteria.length === 0;
        if (empty) {
          setPhase("input");
          setErrors([
            "No requirements could be extracted from the provided content. Please upload a real BRD / PRD / SRS document.",
            ...warnOnly,
          ]);
          throw new Error("No extractable requirements found.");
        }
        setAnalysis(result);
        setErrors(warnOnly);
        setPhase("input"); // go back to input phase so AnalysisPanel renders
      },
    });
  }

  /* ── Generate stories from the analysis ── */
  async function onGenerateStories() {
    if (!analysis) return;
    const basis = analysis.features.length || analysis.actors.length || 1;
    const credits = basis * REQUIREMENT_CREDIT_RATES.storyGeneration;
    runAIAction({
      name: "User Story Generation",
      credits,
      description: `Generate ${basis} structured user ${basis === 1 ? "story" : "stories"} from the extracted requirements.`,
      run: async () => {
        const generated = await generateStories(analysis);
        setStories(generated);
        setPhase("review");
      },
    });
  }

  /* ── Per-story actions ── */
  const approve = (id: string) => setStories((p) => p.map((s) => (s.id === id ? { ...s, status: "approved" } : s)));
  const remove = (id: string) => setStories((p) => p.filter((s) => s.id !== id));
  const edit = (id: string, patch: Partial<GeneratedStory>) =>
    setStories((p) => p.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  async function regenerate(id: string) {
    if (!analysis) return;
    const story = stories.find((s) => s.id === id);
    if (!story) return;
    setRegenId(id);
    const fresh = await regenerateStory(story, analysis);
    setStories((p) => p.map((s) => (s.id === id ? { ...fresh, id: s.id } : s)));
    setRegenId(null);
  }

  const approvedCount = stories.filter((s) => s.status === "approved").length;
  const currentStep = phase === "review" ? 2 : phase === "test-types" ? 3 : phase === "analyzing" ? 1 : 1;
  const projectId = typeof window !== "undefined" ? localStorage.getItem("activeProject") ?? "default" : "default";

  // Test types selection
  type TestType = "Functional" | "Negative" | "Boundary" | "Security" | "Accessibility";
  const ALL_TEST_TYPES: { id: TestType; label: string; description: string; estimate: string }[] = [
    { id: "Functional",    label: "Functional",    description: "Core happy-path scenarios",    estimate: "~8 tests" },
    { id: "Negative",      label: "Negative",      description: "Invalid inputs, wrong states", estimate: "~4 tests" },
    { id: "Boundary",      label: "Boundary",      description: "Edge values, limits",          estimate: "~3 tests" },
    { id: "Security",      label: "Security",      description: "Auth, injection, permissions", estimate: "~3 tests" },
    { id: "Accessibility", label: "Accessibility", description: "ARIA, keyboard, contrast",     estimate: "~2 tests" },
  ];
  const [selectedTestTypes, setSelectedTestTypes] = useState<Set<TestType>>(
    new Set<TestType>(["Functional", "Negative", "Boundary", "Security", "Accessibility"])
  );
  const toggleTestType = (t: TestType) => {
    setSelectedTestTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) { if (next.size > 1) next.delete(t); } // keep at least 1
      else next.add(t);
      return next;
    });
  };

  // Upload state for progress tracking
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);

  async function uploadApprovedStories() {
    const { api } = await import("@/lib/api");
    const approved = stories.filter((s) => s.status === "approved");
    const total = approved.length;
    const uploadedIds: string[] = [];

    setUploadProgress({ done: 0, total });

    for (let i = 0; i < approved.length; i++) {
      const s = approved[i];
      const storyId = makeStoryId();
      const content = `${s.narrative}\n\nAcceptance Criteria:\n${s.acceptanceCriteria.map((c) => `- ${c}`).join("\n")}`;
      const formData = new FormData();
      formData.append("story_id", storyId);
      formData.append("project_id", projectId);
      formData.append("content", content);
      formData.append("source", "requirements");
      try {
        const result = await api.uploadStory(formData);
        uploadedIds.push(result.storyId || storyId);
      } catch {
        // continue uploading remaining stories even if one fails
        uploadedIds.push(storyId);
      }
      setUploadProgress({ done: i + 1, total });
    }

    setUploadProgress(null);
    return uploadedIds;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center px-8 gap-4">
        <Link href="/stories" className="text-muted hover:text-navy transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-navy">Generate Stories from Requirements</h1>
      </div>

      <div className="flex-1 overflow-y-auto py-10">
        <div className="max-w-[760px] mx-auto px-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-10">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <motion.div className="flex items-center gap-2" animate={{ scale: currentStep === s.id ? 1.05 : 1 }} transition={spring.snappy}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                    currentStep >= s.id ? "bg-pink border-pink text-white" : "bg-white border-border text-muted"
                  }`}>
                    {currentStep > s.id ? <CheckCircle2 size={14} /> : s.id}
                  </div>
                  <span className={`text-sm font-medium transition-colors ${currentStep === s.id ? "text-pink" : currentStep > s.id ? "text-navy" : "text-muted"}`}>
                    {s.label}
                  </span>
                </motion.div>
                {i < STEPS.length - 1 && <div className="w-12 h-px bg-border mx-3" />}
              </div>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ───────── Requirements input ───────── */}
            {(phase === "input" || phase === "analyzing") && (
              <motion.div key="input" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-[22px] font-bold text-navy mb-1">Upload your requirements</h2>
                <p className="text-sm text-muted mb-6">Accepts BRD, PRD, SRS and requirement docs — PDF, DOCX, TXT, MD. We extract features, actors, business rules and acceptance criteria.</p>

                {/* Dropzone */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); const d = Array.from(e.dataTransfer.files).filter(acceptedFile); if (d.length) setFiles([...files, ...d]); }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.multiple = true; input.accept = ACCEPTED.join(",");
                    input.onchange = (e) => { const picked = Array.from((e.target as HTMLInputElement).files ?? []).filter(acceptedFile); if (picked.length) setFiles([...files, ...picked]); };
                    input.click();
                  }}
                  className={`h-[160px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-colors ${
                    dragging ? "border-pink bg-surface-pink/40" : "border-border hover:border-pink hover:bg-gray-50"
                  }`}
                >
                  <Upload size={28} className="text-muted" />
                  <p className="text-sm font-medium text-navy">Drop requirement docs here or click to browse</p>
                  <p className="text-xs text-muted">PDF, DOCX, TXT, MD — multiple files allowed</p>
                </div>

                {/* File list */}
                {files.length > 0 && (
                  <div className="mt-4 border border-border rounded-card overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-border bg-gray-50">
                      <p className="text-[13px] font-semibold text-navy">Documents ({files.length})</p>
                    </div>
                    <div className="divide-y divide-border max-h-44 overflow-y-auto">
                      {files.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                          <span className="w-8 h-8 rounded-lg bg-surface-pink text-pink flex items-center justify-center flex-shrink-0"><FileText size={15} /></span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy truncate">{f.name}</p>
                            <p className="text-xs text-muted">{fmtSize(f.size)}</p>
                          </div>
                          <button type="button" onClick={() => setFiles(files.filter((_, idx) => idx !== i))} className="text-muted hover:text-error transition-colors flex-shrink-0" title="Remove">
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Paste */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-navy mb-1.5">Or paste requirements</label>
                  <textarea
                    value={pasted}
                    onChange={(e) => setPasted(e.target.value)}
                    rows={5}
                    placeholder="Paste a BRD / PRD / SRS excerpt or a set of requirements…"
                    className="w-full p-3 text-sm border border-border rounded-btn resize-y text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors"
                  />
                </div>

                {/* Validation errors */}
                {errors.length > 0 && (
                  <div className="mt-4 p-3 rounded-card bg-[#FEF2F2] border border-[#FCA5A5]">
                    <p className="text-sm font-semibold text-[#991B1B] flex items-center gap-1.5 mb-1"><AlertTriangle size={14} /> Cannot use this content</p>
                    <ul className="list-disc list-inside space-y-0.5">
                      {errors.map((e, i) => <li key={i} className="text-xs text-[#991B1B]/90">{e}</li>)}
                    </ul>
                  </div>
                )}

                {/* Credit estimate */}
                <CreditEstimate
                  rows={[{ label: "Requirement Analysis", value: analysisCredits }]}
                  remaining={creditsRemaining}
                />

                {/* Footer */}
                <div className="flex items-center justify-between mt-6">
                  <Link href="/stories" className="text-sm font-medium text-muted hover:text-navy transition-colors">Cancel</Link>
                  <button
                    type="button"
                    onClick={onAnalyze}
                    disabled={docCount === 0 || phase === "analyzing"}
                    className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40 inline-flex items-center gap-2"
                  >
                    {phase === "analyzing" && <Loader2 size={15} className="animate-spin" />}
                    {phase === "analyzing" ? "Analyzing…" : "Analyze Requirements"}
                  </button>
                </div>

                {/* Extracted analysis → generate stories */}
                {analysis && phase !== "analyzing" && (
                  <AnalysisPanel analysis={analysis} onGenerate={onGenerateStories} remaining={creditsRemaining} />
                )}
              </motion.div>
            )}

            {/* ───────── Review stories ───────── */}
            {phase === "review" && (
              <motion.div key="review" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <h2 className="text-[22px] font-bold text-navy mb-1">Review generated stories</h2>
                <p className="text-sm text-muted mb-6">Edit, approve, delete or regenerate before generating tests. {approvedCount} of {stories.length} approved.</p>

                {stories.length === 0 ? (
                  <div className="py-16 text-center border border-dashed border-border rounded-card">
                    <p className="text-sm text-navy font-medium mb-1">All stories removed.</p>
                    <button onClick={() => setPhase("input")} className="text-sm text-pink hover:underline">Back to requirements</button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stories.map((s) => (
                      <StoryReviewCard
                        key={s.id}
                        story={s}
                        regenerating={regenId === s.id}
                        onApprove={() => approve(s.id)}
                        onDelete={() => remove(s.id)}
                        onRegenerate={() => regenerate(s.id)}
                        onEdit={(patch) => edit(s.id, patch)}
                      />
                    ))}
                  </div>
                )}

                <CreditEstimate
                  rows={[
                    { label: "Test Generation", value: approvedCount * REQUIREMENT_CREDIT_RATES.testGeneration, hint: `${approvedCount} approved × ${AI_ACTION_COSTS.generateTests}` },
                  ]}
                  remaining={creditsRemaining}
                />

                <div className="flex items-center justify-between mt-6">
                  <button onClick={() => setPhase("input")} className="text-sm font-medium text-muted hover:text-navy transition-colors">Back</button>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={approvedCount === 0}
                      onClick={() => setPhase("test-types")}
                      className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40 inline-flex items-center gap-2"
                    >
                      <Sparkles size={15} /> Next: Choose Test Types ({approvedCount})
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Test Types phase ── */}
            {phase === "test-types" && (
              <motion.div
                key="test-types"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-xl font-semibold text-navy mb-1">What should we test?</h2>
                  <p className="text-sm text-muted">Select the test types to generate. You can add more later.</p>
                </div>

                <div className="space-y-3">
                  {ALL_TEST_TYPES.map((t) => {
                    const selected = selectedTestTypes.has(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTestType(t.id)}
                        className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-left transition-all ${
                          selected
                            ? "border-pink bg-white"
                            : "border-border bg-white hover:border-gray-300"
                        }`}
                      >
                        <div className={`w-6 h-6 rounded flex items-center justify-center flex-shrink-0 transition-colors ${
                          selected ? "bg-pink" : "bg-gray-100"
                        }`}>
                          {selected && <svg width="12" height="10" viewBox="0 0 12 10" fill="none"><path d="M1 5L4.5 8.5L11 1.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy">{t.label}</p>
                          <p className="text-xs text-muted">{t.description}</p>
                        </div>
                        <span className="text-xs font-semibold text-cyan flex-shrink-0">{t.estimate}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button onClick={() => setPhase("review")} className="text-sm font-medium text-muted hover:text-navy transition-colors">Back</button>
                  <div className="flex items-center gap-3">
                    {uploadProgress && (
                      <span className="text-sm text-muted">Uploading {uploadProgress.done}/{uploadProgress.total}…</span>
                    )}
                    <button
                      type="button"
                      disabled={selectedTestTypes.size === 0 || !!uploadProgress}
                      onClick={() =>
                        runAIAction({
                          name: "Test Generation",
                          credits: approvedCount * REQUIREMENT_CREDIT_RATES.testGeneration,
                          description: `Upload ${approvedCount} approved ${approvedCount === 1 ? "story" : "stories"} and generate ${Array.from(selectedTestTypes).join(", ")} tests for each.`,
                          run: async () => {
                            const ids = await uploadApprovedStories();
                            if (ids.length === 1) {
                              router.push(`/stories/${ids[0]}?analyzing=true`);
                            } else {
                              const qs = projectId && projectId !== "default" ? `?project_id=${encodeURIComponent(projectId)}` : "";
                              window.location.href = `/stories${qs}`;
                            }
                          },
                        })
                      }
                      className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40 inline-flex items-center gap-2"
                    >
                      <Sparkles size={15} /> Generate Tests ({approvedCount})
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Credit estimate panel ─── */
function CreditEstimate({
  rows, remaining,
}: {
  rows: { label: string; value: number; hint?: string }[];
  remaining: number;
}) {
  const total = rows.reduce((s, r) => s + r.value, 0);
  const after = remaining - total;
  return (
    <div className="mt-5 p-4 rounded-card bg-brand-primary-light/40 border border-brand-primary">
      <div className="flex items-center gap-2 mb-2.5">
        <Zap size={15} className="text-pink" />
        <p className="text-sm font-semibold text-navy">Estimated credits</p>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between text-sm">
            <span className="text-muted">{r.label}{r.hint ? <span className="text-[11px] ml-1">({r.hint})</span> : null}</span>
            <span className="font-medium text-navy tabular-nums">~{r.value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm border-t border-brand-primary/30 pt-1.5 mt-1.5">
          <span className="font-semibold text-navy">Total</span>
          <span className="font-bold text-pink tabular-nums">~{total} Credits</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">Remaining after execution</span>
          <span className={`font-semibold tabular-nums ${after < 0 ? "text-error" : "text-success"}`}>{after}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Extracted analysis panel ─── */
function AnalysisPanel({
  analysis, onGenerate, remaining,
}: {
  analysis: ExtractedAnalysis;
  onGenerate: () => void;
  remaining: number;
}) {
  const groups = [
    { label: "Features", items: analysis.features },
    { label: "Actors", items: analysis.actors },
    { label: "Business Rules", items: analysis.businessRules },
    { label: "Acceptance Criteria", items: analysis.acceptanceCriteria },
  ];
  const basis = analysis.features.length || analysis.actors.length || 1;
  return (
    <div className="mt-8 pt-6 border-t border-border">
      <h3 className="text-base font-semibold text-navy mb-3 flex items-center gap-2"><CheckCircle2 size={16} className="text-success" /> Extracted from your requirements</h3>
      <div className="grid sm:grid-cols-2 gap-3">
        {groups.map((g) => (
          <div key={g.label} className="border border-border rounded-card p-3">
            <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">{g.label} ({g.items.length})</p>
            {g.items.length === 0 ? (
              <p className="text-xs text-muted">None detected.</p>
            ) : (
              <ul className="space-y-1">
                {g.items.slice(0, 5).map((it, i) => <li key={i} className="text-xs text-navy leading-snug">• {it}</li>)}
                {g.items.length > 5 && <li className="text-[11px] text-muted">+{g.items.length - 5} more</li>}
              </ul>
            )}
          </div>
        ))}
      </div>

      <CreditEstimate rows={[{ label: "User Story Generation", value: basis * REQUIREMENT_CREDIT_RATES.storyGeneration }]} remaining={remaining} />

      <div className="flex justify-end mt-5">
        <button type="button" onClick={onGenerate} className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors inline-flex items-center gap-2">
          <Sparkles size={15} /> Generate User Stories
        </button>
      </div>
    </div>
  );
}

/* ─── Story review card (edit / approve / delete / regenerate) ─── */
function StoryReviewCard({
  story, regenerating, onApprove, onDelete, onRegenerate, onEdit,
}: {
  story: GeneratedStory;
  regenerating: boolean;
  onApprove: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onEdit: (patch: Partial<GeneratedStory>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(story.title);
  const [narrative, setNarrative] = useState(story.narrative);
  const [ac, setAc] = useState(story.acceptanceCriteria.join("\n"));

  const save = () => {
    onEdit({ title: title.trim(), narrative: narrative.trim(), acceptanceCriteria: ac.split("\n").map((l) => l.trim()).filter(Boolean) });
    setEditing(false);
  };

  return (
    <div className={`border rounded-card p-4 transition-colors ${story.status === "approved" ? "border-success/50 bg-[#ECFDF5]/40" : "border-border bg-white"}`}>
      {editing ? (
        <div className="space-y-2.5">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-9 px-3 rounded-btn border border-border text-sm font-semibold text-navy focus:outline-none focus:border-pink" />
          <textarea value={narrative} onChange={(e) => setNarrative(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-btn border border-border text-sm text-navy focus:outline-none focus:border-pink resize-y" />
          <textarea value={ac} onChange={(e) => setAc(e.target.value)} rows={3} placeholder="One acceptance criterion per line" className="w-full px-3 py-2 rounded-btn border border-border text-xs text-navy focus:outline-none focus:border-pink resize-y" />
          <div className="flex gap-2">
            <button onClick={save} className="h-8 px-3 text-xs font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">Save</button>
            <button onClick={() => setEditing(false)} className="h-8 px-3 text-xs font-medium text-muted hover:text-navy transition-colors">Cancel</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <p className="text-sm font-semibold text-navy">{story.title}</p>
            {story.status === "approved" && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-success/15 text-success flex items-center gap-1 flex-shrink-0"><Check size={11} /> Approved</span>
            )}
          </div>
          <p className="text-[13px] text-muted leading-relaxed mb-2">{story.narrative}</p>
          {story.acceptanceCriteria.length > 0 && (
            <ul className="space-y-0.5 mb-3">
              {story.acceptanceCriteria.map((c, i) => <li key={i} className="text-xs text-navy leading-snug">✓ {c}</li>)}
            </ul>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {story.status !== "approved" && (
              <button onClick={onApprove} className="h-8 px-3 text-xs font-medium bg-success/10 text-success border border-success/30 rounded-btn hover:bg-success/20 transition-colors inline-flex items-center gap-1.5"><Check size={13} /> Approve</button>
            )}
            <button onClick={() => setEditing(true)} className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5"><Pencil size={12} /> Edit</button>
            <button onClick={onRegenerate} disabled={regenerating} className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors inline-flex items-center gap-1.5 disabled:opacity-50">
              {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Regenerate
            </button>
            <button onClick={onDelete} className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-error bg-white hover:bg-[#FEF2F2] transition-colors inline-flex items-center gap-1.5"><Trash2 size={12} /> Delete</button>
          </div>
        </>
      )}
    </div>
  );
}
