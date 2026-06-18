"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  FileText,
  X,
  Zap,
} from "lucide-react";
import { easeStandard, easeOut, duration, spring } from "@/lib/motion";

type StepId = 1 | 2 | 3;
type InputTab = "paste" | "upload" | "jira";

/** Credits charged per story when generating tests. */
const CREDITS_PER_STORY = 25;
/** Minimum characters required for a pasted story to be valid. */
const MIN_STORY_CHARS = 50;

/** A single detected/selected story heading into the wizard. */
interface DetectedStory {
  id: string;
  /** Display title (first meaningful line). */
  title: string;
  /** Raw story text (for paste) or file description (for upload). */
  content: string;
  charCount: number;
  valid: boolean;
  source: "paste" | "upload";
  selected: boolean;
}

/** Derive a short title from a story body — first non-empty line, truncated. */
function deriveTitle(text: string): string {
  const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "Untitled story";
  return firstLine.length > 80 ? firstLine.slice(0, 77) + "…" : firstLine;
}

/**
 * Parse pasted text into multiple stories.
 *  - Primary separator: a line containing only `---`.
 *  - Fallback: auto-detect on the user-story pattern ("As a … I want …").
 */
function parsePastedStories(raw: string): string[] {
  const text = raw.trim();
  if (!text) return [];

  // 1. Explicit `---` separator.
  if (/^\s*---\s*$/m.test(text)) {
    return text
      .split(/^\s*---\s*$/m)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // 2. Auto-detect: split before each "As a/an …" that starts a line.
  const matches = Array.from(text.matchAll(/^\s*as an?\b/gim));
  if (matches.length > 1) {
    const blocks: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0;
      const end = i + 1 < matches.length ? matches[i + 1].index ?? text.length : text.length;
      const block = text.slice(start, end).trim();
      if (block) blocks.push(block);
    }
    return blocks;
  }

  // 3. Single story.
  return [text];
}

const testTypes = [
  { id: "functional", label: "Functional", description: "Core happy-path scenarios", count: "~8 tests" },
  { id: "negative", label: "Negative", description: "Invalid inputs, wrong states", count: "~4 tests" },
  { id: "boundary", label: "Boundary", description: "Edge values, limits", count: "~3 tests" },
  { id: "security", label: "Security", description: "Auth, injection, permissions", count: "~3 tests" },
  { id: "accessibility", label: "Accessibility", description: "ARIA, keyboard, contrast", count: "~2 tests" },
];

const qualityIssues = [
  { title: "Missing acceptance criteria for error states", description: "No criteria for server-unavailable scenario.", area: "Completeness" },
  { title: "User role is ambiguous", description: "Which type of user? Admin, guest, or standard?", area: "Clarity" },
  { title: "No definition of post-lockout behavior", description: "Unlock after 15 minutes — automatic or manual reset?", area: "Testability" },
];

const steps: { id: StepId; label: string }[] = [
  { id: 1, label: "Input" },
  { id: 2, label: "Settings" },
  { id: 3, label: "Generate" },
];

export default function CreateStoryPage() {
  const [step, setStep] = useState<StepId>(1);
  const [prevStep, setPrevStep] = useState<StepId>(1);
  const [inputTab, setInputTab] = useState<InputTab>("paste");
  const [storyText, setStoryText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [detected, setDetected] = useState<DetectedStory[] | null>(null);
  const [checkedTypes, setCheckedTypes] = useState(
    Object.fromEntries(testTypes.map((t) => [t.id, true]))
  );
  // Active project from localStorage
  const [projectId] = useState<string>(
    typeof window !== "undefined" ? localStorage.getItem("activeProject") ?? "default" : "default"
  );

  const goTo = (next: StepId) => {
    setPrevStep(step);
    setStep(next);
  };

  const direction = step > prevStep ? 1 : -1;

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center px-8 gap-4">
        <Link
          href="/stories"
          className="text-muted hover:text-navy transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-navy">Create Story</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto py-10">
        <div className="max-w-[720px] mx-auto px-6">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-10">
            {steps.map((s, i) => (
              <div key={s.id} className="flex items-center">
                <motion.div
                  className="flex items-center gap-2"
                  animate={{ scale: step === s.id ? 1.05 : 1 }}
                  transition={spring.snappy}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors duration-200 ${
                      step === s.id
                        ? "bg-pink border-pink text-white"
                        : step > s.id
                        ? "bg-pink border-pink text-white"
                        : "bg-white border-border text-muted"
                    }`}
                  >
                    {step > s.id ? <CheckCircle2 size={14} /> : s.id}
                  </div>
                  <span
                    className={`text-sm font-medium transition-colors duration-200 ${
                      step === s.id ? "text-pink" : step > s.id ? "text-navy" : "text-muted"
                    }`}
                  >
                    {s.label}
                  </span>
                </motion.div>
                {i < steps.length - 1 && (
                  <div className="w-12 h-px bg-border mx-3" />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <StepInput
                key="step1"
                direction={direction}
                inputTab={inputTab}
                setInputTab={setInputTab}
                storyText={storyText}
                setStoryText={setStoryText}
                dragging={dragging}
                setDragging={setDragging}
                files={files}
                setFiles={setFiles}
                detected={detected}
                setDetected={setDetected}
                onContinue={() => goTo(2)}
              />
            )}
            {step === 2 && (
              <StepSettings
                key="step2"
                direction={direction}
                checkedTypes={checkedTypes}
                setCheckedTypes={setCheckedTypes}
                onBack={() => goTo(1)}
                onAnalyze={() => goTo(3)}
              />
            )}
            {step === 3 && (
              <StepGenerate
                key="step3"
                direction={direction}
                onBack={() => goTo(1)}
                detected={detected}
                files={files}
                storyText={storyText}
                projectId={projectId}
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1 ─── */
const ACCEPTED_EXTS = [".txt", ".docx", ".pdf", ".md"];

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTS.some((ext) => name.endsWith(ext));
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StepInput({
  direction, inputTab, setInputTab, storyText, setStoryText,
  dragging, setDragging, files, setFiles, detected, setDetected, onContinue,
}: {
  direction: number;
  inputTab: InputTab;
  setInputTab: (t: InputTab) => void;
  storyText: string;
  setStoryText: (v: string) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  files: File[];
  setFiles: (f: File[]) => void;
  detected: DetectedStory[] | null;
  setDetected: (d: DetectedStory[] | null) => void;
  onContinue: () => void;
}) {
  // Live-parsed preview of pasted stories (before committing to the select phase).
  const pastedStories = parsePastedStories(storyText);

  const hasContent =
    inputTab === "paste"
      ? pastedStories.some((s) => s.length >= MIN_STORY_CHARS)
      : inputTab === "upload"
      ? files.length > 0
      : true;

  /** Build the detected-stories list and move to the preview/select phase. */
  function buildPreview() {
    const list: DetectedStory[] = [];
    if (inputTab === "paste") {
      pastedStories.forEach((content, i) => {
        const charCount = content.trim().length;
        list.push({
          id: `paste-${i}`,
          title: deriveTitle(content),
          content,
          charCount,
          valid: charCount >= MIN_STORY_CHARS,
          source: "paste",
          selected: charCount >= MIN_STORY_CHARS,
        });
      });
    } else if (inputTab === "upload") {
      files.forEach((file, i) => {
        list.push({
          id: `file-${i}`,
          title: file.name,
          content: `${formatSize(file.size)} · ${file.type || "document"}`,
          charCount: file.size,
          valid: true,
          source: "upload",
          selected: true,
        });
      });
    }
    setDetected(list);
  }

  // ── Preview / selection phase ──
  if (detected) {
    return (
      <StoryPreview
        direction={direction}
        detected={detected}
        setDetected={setDetected}
        onBack={() => setDetected(null)}
        onContinue={onContinue}
      />
    );
  }

  // ── Input phase ──
  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">Add your stories</h2>
      <p className="text-sm text-muted mb-6">Paste text, upload files, or import from Jira. You can add multiple stories.</p>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-border mb-6">
        {(["paste", "upload", "jira"] as InputTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setInputTab(tab)}
            className={`pb-3 text-sm font-medium transition-colors capitalize ${
              inputTab === tab
                ? "text-navy border-b-2 border-pink"
                : "text-muted hover:text-navy"
            }`}
          >
            {tab === "paste" ? "Paste Stories" : tab === "upload" ? "Upload Files" : "Import from Jira"}
          </button>
        ))}
      </div>

      {inputTab === "paste" && (
        <div className="space-y-4">
          <div className="relative">
            <textarea
              value={storyText}
              onChange={(e) => setStoryText(e.target.value)}
              placeholder={`As a [user type], I want to [do something] so that [I get some benefit].\n\nAcceptance Criteria:\n- [Criterion 1]\n- [Criterion 2]\n\n---\n\nAs a [user type], I want to [do another thing]…`}
              className="w-full h-[240px] p-4 font-mono text-[13px] border border-border rounded-btn resize-none text-navy placeholder:text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 transition-colors leading-relaxed"
            />
            <span className="absolute bottom-3 right-3 text-[11px] text-muted">
              {storyText.length} chars
            </span>
          </div>
          <p className="text-xs text-muted">
            Separate multiple stories with a line containing <code className="px-1 py-0.5 rounded bg-gray-100 text-navy">---</code>, or we&apos;ll auto-detect the
            <span className="font-medium text-navy"> &ldquo;As a…&rdquo;</span> format. Minimum {MIN_STORY_CHARS} characters per story.
          </p>

          {/* Detected stories preview (live) */}
          {storyText.trim().length > 0 && (
            <div className="border border-border rounded-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-gray-50">
                <p className="text-[13px] font-semibold text-navy">
                  Detected Stories ({pastedStories.length})
                </p>
              </div>
              <div className="divide-y divide-border max-h-44 overflow-y-auto">
                {pastedStories.map((s, i) => {
                  const count = s.trim().length;
                  const ok = count >= MIN_STORY_CHARS;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-sm font-medium text-navy flex-shrink-0">Story {i + 1}</span>
                      <span className="text-xs text-muted truncate flex-1">{deriveTitle(s)}</span>
                      <span className={`text-[11px] font-medium flex-shrink-0 ${ok ? "text-success" : "text-error"}`}>
                        {ok ? `${count} chars` : `${count}/${MIN_STORY_CHARS} chars`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {inputTab === "upload" && (
        <div className="space-y-4">
          <motion.div
            animate={{
              borderColor: dragging ? "#06B6D4" : "#E2E8F0",
              scale: dragging ? 1.01 : 1,
              backgroundColor: dragging ? "#ECFEFF" : "#FFFFFF",
            }}
            transition={{ duration: duration.instant }}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const dropped = Array.from(e.dataTransfer.files).filter(isAcceptedFile);
              if (dropped.length) setFiles([...files, ...dropped]);
            }}
            className="h-[180px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.accept = ACCEPTED_EXTS.join(",");
              input.onchange = (e) => {
                const picked = Array.from((e.target as HTMLInputElement).files ?? []).filter(isAcceptedFile);
                if (picked.length) setFiles([...files, ...picked]);
              };
              input.click();
            }}
          >
            <Upload size={32} className="text-muted" />
            <p className="text-sm font-medium text-navy">Drop files here or click to browse</p>
            <p className="text-xs text-muted">Supports .txt, .docx, .pdf, .md — multiple files allowed</p>
          </motion.div>

          {/* File list */}
          {files.length > 0 && (
            <div className="border border-border rounded-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-gray-50">
                <p className="text-[13px] font-semibold text-navy">Files ({files.length})</p>
              </div>
              <div className="divide-y divide-border max-h-44 overflow-y-auto">
                {files.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-8 h-8 rounded-lg bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
                      <FileText size={15} />
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-navy truncate">{file.name}</p>
                      <p className="text-xs text-muted">{formatSize(file.size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFiles(files.filter((_, idx) => idx !== i))}
                      className="text-muted hover:text-error transition-colors flex-shrink-0"
                      title="Remove file"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {inputTab === "jira" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="Jira Issue Key (e.g. AUTH-001)"
              className="w-[200px] px-3 h-9 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
            />
            <button className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
              Import
            </button>
          </div>
          <p className="text-sm text-muted">
            Not connected?{" "}
            <Link href="/settings/integrations" className="text-cyan hover:underline">Connect Jira</Link>
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-8">
        <Link
          href="/stories"
          className="text-sm font-medium text-muted hover:text-navy transition-colors"
        >
          Cancel
        </Link>
        <button
          onClick={buildPreview}
          disabled={!hasContent}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </StepWrapper>
  );
}

/* ─── Step 1b: detected-stories preview + selection ─── */
function StoryPreview({
  direction, detected, setDetected, onBack, onContinue,
}: {
  direction: number;
  detected: DetectedStory[];
  setDetected: (d: DetectedStory[]) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const toggle = (id: string) =>
    setDetected(detected.map((s) => (s.id === id ? { ...s, selected: !s.selected } : s)));

  const selectedCount = detected.filter((s) => s.valid && s.selected).length;
  const estimatedCredits = selectedCount * CREDITS_PER_STORY;

  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">Select stories to process</h2>
      <p className="text-sm text-muted mb-6">
        We detected {detected.length} {detected.length === 1 ? "story" : "stories"}. Choose which to include.
      </p>

      <div className="space-y-2.5 mb-5">
        {detected.map((s, i) => (
          <label
            key={s.id}
            className={`flex items-center gap-3.5 p-4 border rounded-lg transition-colors ${
              !s.valid
                ? "border-border bg-gray-50 opacity-60 cursor-not-allowed"
                : s.selected
                ? "border-pink bg-surface-pink/40 cursor-pointer"
                : "border-border hover:bg-gray-50 cursor-pointer"
            }`}
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                s.valid && s.selected ? "bg-pink border-pink" : "bg-white border-navy"
              }`}
              onClick={(e) => { e.preventDefault(); if (s.valid) toggle(s.id); }}
            >
              {s.valid && s.selected && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-navy truncate">
                Story {i + 1}{s.source === "upload" ? "" : ""} · <span className="text-muted font-normal">{s.title}</span>
              </p>
              <p className="text-xs text-muted mt-0.5">
                {s.source === "paste"
                  ? `${s.charCount} characters`
                  : s.content}
              </p>
            </div>
            {!s.valid && (
              <span className="text-[11px] font-medium text-error flex-shrink-0 flex items-center gap-1">
                <AlertTriangle size={12} />
                Too short
              </span>
            )}
          </label>
        ))}
      </div>

      {/* Estimated credits */}
      <div className="flex items-center justify-between p-4 rounded-card bg-surface-pink/40 border border-[#FF0A78] mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-navy">
          <Zap size={16} className="text-pink" />
          Estimated credits
          <span className="text-muted font-normal">
            ({selectedCount} {selectedCount === 1 ? "story" : "stories"} × {CREDITS_PER_STORY})
          </span>
        </div>
        <span className="text-base font-bold text-pink tabular-nums">~{estimatedCredits} Credits</span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm font-medium text-muted hover:text-navy transition-colors"
        >
          Back
        </button>
        <button
          onClick={onContinue}
          disabled={selectedCount === 0}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue ({selectedCount})
        </button>
      </div>
    </StepWrapper>
  );
}

/* ─── Step 2 ─── */
function StepSettings({
  direction, checkedTypes, setCheckedTypes, onBack, onAnalyze,
}: {
  direction: number;
  checkedTypes: Record<string, boolean>;
  setCheckedTypes: (v: Record<string, boolean>) => void;
  onBack: () => void;
  onAnalyze: () => void;
}) {
  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">What should we test?</h2>
      <p className="text-sm text-muted mb-6">Select the test types to generate. You can add more later.</p>

      <div className="space-y-3">
        {testTypes.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-4 p-4 border border-border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div
              className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                checkedTypes[t.id] ? "bg-pink border-pink" : "bg-white border-navy"
              }`}
              onClick={() =>
                setCheckedTypes({ ...checkedTypes, [t.id]: !checkedTypes[t.id] })
              }
            >
              {checkedTypes[t.id] && (
                <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                  <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-navy">{t.label}</p>
              <p className="text-xs text-muted">{t.description}</p>
            </div>
            <span className="text-[11px] font-semibold text-cyan">{t.count}</span>
          </label>
        ))}
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-sm font-medium text-muted hover:text-navy transition-colors"
        >
          Back
        </button>
        <button
          onClick={onAnalyze}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors"
        >
          Analyze Story
        </button>
      </div>
    </StepWrapper>
  );
}

/* ─── Step 3 ─── */
function StepGenerate({
  direction, onBack, detected, files, storyText, projectId,
}: {
  direction: number;
  onBack: () => void;
  detected: DetectedStory[] | null;
  files: File[];
  storyText: string;
  projectId: string;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>("");

  async function handleGenerate(analyzeImpact: boolean) {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { api } = await import("@/lib/api");
      const selectedStories = detected?.filter((s) => s.selected && s.valid) ?? [];

      // If no detected stories, fall back to raw storyText or first file
      const stories = selectedStories.length > 0 ? selectedStories : [null];
      let lastStoryId = "";

      for (let i = 0; i < stories.length; i++) {
        const s = stories[i];
        const formData = new FormData();
        // Generate a story ID from first words of title or content
        const rawTitle = s?.title ?? storyText.trim().split(/\s+/).slice(0, 4).join(" ");
        const words = rawTitle.replace(/[^a-zA-Z0-9\s]/g, "").trim().split(/\s+/).slice(0, 4).join("-").toUpperCase();
        const storyId = `STORY-${words || Date.now()}-${i}`;
        lastStoryId = storyId;

        formData.append("story_id", storyId);
        formData.append("project_id", projectId);
        formData.append("source", "frontend");

        if (s?.source === "upload" && files[i]) {
          formData.append("file", files[i]);
        } else {
          const content = s?.content ?? storyText.trim();
          formData.append("content", content);
        }

        if (stories.length > 1) {
          setProgress(`Uploading story ${i + 1} of ${stories.length}…`);
        }

        const result = await api.uploadStory(formData);
        lastStoryId = result.storyId || storyId;
      }

      router.push(`/stories/${lastStoryId}?analyzing=true`);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Upload failed. Try again.");
      setSubmitting(false);
    }
  }

  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">Story analysis complete.</h2>
      <p className="text-sm text-muted mb-6">Here&apos;s what we found before generating tests.</p>

      {/* Quality score card */}
      <div className="bg-white border border-border rounded-card p-5 mb-5">
        <div className="flex gap-6 items-center">
          {/* Donut */}
          <QualityDonut score={87} />
          {/* Bars */}
          <div className="flex-1 space-y-3">
            {[
              { label: "Completeness", value: 80 },
              { label: "Clarity", value: 95 },
              { label: "Testability", value: 63 },
            ].map((bar, i) => (
              <div key={bar.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted font-medium">{bar.label}</span>
                  <span className="font-semibold text-navy">{bar.value}%</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-cyan rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${bar.value}%` }}
                    transition={{ duration: duration.slow, delay: 0.3 + i * 0.08, ease: easeOut }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Issues */}
      <div className="bg-white border border-border rounded-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle size={16} className="text-warning" />
          <h3 className="text-[15px] font-semibold text-navy">Issues found ({qualityIssues.length})</h3>
        </div>
        <div className="space-y-3">
          {qualityIssues.map((issue, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: duration.base, delay: 0.6 + i * 0.08, ease: easeOut }}
              className="flex gap-3"
            >
              <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-navy">{issue.title}</p>
                <p className="text-xs text-muted mt-0.5">{issue.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Impact detection panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.base, delay: 0.85 }}
        className="bg-surface-cyan border border-cyan/30 rounded-card p-4 mb-6"
      >
        <div className="flex items-start gap-2">
          <Sparkles size={16} className="text-cyan flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-navy mb-1">Potential impact detected.</p>
            <p className="text-sm text-muted">
              This story may affect existing stories:{" "}
              <span className="text-navy font-medium">LOGIN-001 Login · AUTH-002 Registration · AUTH-003 Password Reset</span>.
              Estimated affected tests: 18.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          disabled={submitting}
          className="text-sm font-medium text-muted hover:text-navy transition-colors disabled:opacity-40"
        >
          Improve Story First
        </button>
        <div className="flex gap-3">
          {submitError && (
            <p className="text-sm text-error self-center">{submitError}</p>
          )}
          {progress && submitting && (
            <p className="text-sm text-muted self-center">{progress}</p>
          )}
          <button
            onClick={() => handleGenerate(false)}
            disabled={submitting}
            className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Uploading…" : "Generate New Tests Only"}
          </button>
          <button
            onClick={() => handleGenerate(true)}
            disabled={submitting}
            className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors inline-flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Uploading…" : "Generate + Analyze Impact"}
          </button>
        </div>
      </div>
    </StepWrapper>
  );
}

/* ─── Quality donut ─── */
function QualityDonut({ score }: { score: number }) {
  const size = 120;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);
  const center = size / 2;

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <circle cx={center} cy={center} r={radius} fill="none" stroke="#E2E8F0" strokeWidth={strokeWidth} />
        <motion.circle
          cx={center} cy={center} r={radius} fill="none" stroke="#06B6D4" strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          style={{ strokeDasharray: circumference }}
          transition={{ duration: duration.slow, ease: easeOut }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[24px] font-bold text-navy">{score}</span>
        <span className="text-[11px] text-muted">Quality</span>
      </div>
    </div>
  );
}

/* ─── Animated step wrapper ─── */
function StepWrapper({ children, direction }: { children: React.ReactNode; direction: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: direction * 32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: direction * -32 }}
      transition={{ duration: duration.moderate, ease: easeStandard }}
    >
      {children}
    </motion.div>
  );
}
