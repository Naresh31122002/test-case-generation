"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAIAction, AI_ACTION_COSTS } from "@/contexts/AIActionContext";
import { useProject } from "@/contexts/ProjectContext";
import { makeStoryId } from "@/lib/storyId";

/** Shared mock async op (~1.8s, ~10% failure) for the Create Story flow. */
function mockRunNewStory(ms = 1800): Promise<void> {
  return new Promise((resolve, reject) =>
    setTimeout(() => (Math.random() < 0.1 ? reject(new Error("Generation failed. Please try again.")) : resolve()), ms)
  );
}
import {
  ArrowLeft,
  Upload,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  FileText,
  X,
  Zap,
  Plus,
  Eye,
  Trash2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { easeStandard, easeOut, duration, spring } from "@/lib/motion";

type StepId = 1 | 2 | 3;

/** Credits charged per story when generating tests. */
const CREDITS_PER_STORY = 25;
/** Minimum characters required for a pasted story to be valid. */
const MIN_STORY_CHARS = 50;

type StorySource = "paste" | "upload" | "jira";

/** A single detected/selected story heading into the wizard. */
interface DetectedStory {
  id: string;
  /** Display title (first meaningful line). */
  title: string;
  /** Raw story text (for paste) or descriptive subtitle (upload / jira). */
  content: string;
  charCount: number;
  valid: boolean;
  source: StorySource;
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
  const { selectedProject } = useProject();
  const [step, setStep] = useState<StepId>(1);
  const [prevStep, setPrevStep] = useState<StepId>(1);
  const [pasteBlocks, setPasteBlocks] = useState<string[]>([""]);
  const [dragging, setDragging] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [jiraKeys, setJiraKeys] = useState<string[]>([]);
  const [detected, setDetected] = useState<DetectedStory[] | null>(null);
  const [checkedTypes, setCheckedTypes] = useState(
    Object.fromEntries(testTypes.map((t) => [t.id, true]))
  );
  // Active project: ProjectContext is the source of truth (it stays in sync with
  // the dashboard's project selector). Fall back to localStorage only until the
  // context has resolved, then to "default". This prevents uploading a story under
  // a different project_id than the one the dashboard later filters by.
  const projectId =
    selectedProject?.id ??
    (typeof window !== "undefined" ? localStorage.getItem("activeProject") ?? "default" : "default");

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
                pasteBlocks={pasteBlocks}
                setPasteBlocks={setPasteBlocks}
                dragging={dragging}
                setDragging={setDragging}
                files={files}
                setFiles={setFiles}
                jiraKeys={jiraKeys}
                setJiraKeys={setJiraKeys}
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
                pasteBlocks={pasteBlocks}
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

/** Short uppercase extension badge color, by file type — purely cosmetic. */
function extBadge(name: string): { label: string; bg: string; fg: string } {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { label: "PDF", bg: "#FEF2F2", fg: "#DC2626" };
  if (ext === "docx" || ext === "doc") return { label: "DOC", bg: "#EFF6FF", fg: "#2563EB" };
  if (ext === "md") return { label: "MD", bg: "#F0FDF4", fg: "#16A34A" };
  return { label: "TXT", bg: "#F1F5F9", fg: "#64748B" };
}

/**
 * Uploaded-files panel — checkbox select, per-file preview/remove, file-type
 * badge, collapsible. Every file here is newly added this session (the page
 * doesn't reload a saved project), so all rows carry the "New" badge.
 */
function FileListPanel({ files, setFiles }: { files: File[]; setFiles: (f: File[]) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const allSelected = files.length > 0 && selected.size === files.length;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(files.map((_, i) => i)));
  }
  function toggleOne(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }
  function removeOne(i: number) {
    setFiles(files.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      const next = new Set<number>();
      prev.forEach((idx) => {
        if (idx < i) next.add(idx);
        else if (idx > i) next.add(idx - 1);
      });
      return next;
    });
  }
  function removeSelected() {
    setFiles(files.filter((_, i) => !selected.has(i)));
    setSelected(new Set());
  }

  return (
    <div className="border border-border rounded-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border bg-gray-50">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 text-[13px] font-semibold text-navy"
        >
          <FileText size={14} className="text-muted" />
          File ({files.length})
          {collapsed ? <ChevronDown size={14} className="text-muted" /> : <ChevronUp size={14} className="text-muted" />}
        </button>
        {selected.size > 0 && !collapsed && (
          <button
            type="button"
            onClick={removeSelected}
            className="text-[11px] font-semibold text-error hover:underline"
          >
            Remove {selected.size} selected
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Select all */}
          <label className="flex items-center gap-2.5 px-4 py-2.5 border-b border-border cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="w-4 h-4 rounded border-border text-pink focus:ring-pink/30"
            />
            <span className="text-sm text-navy">Select All</span>
          </label>

          {/* Rows */}
          <div className="divide-y divide-border max-h-60 overflow-y-auto">
            {files.map((file, i) => {
              const badge = extBadge(file.name);
              return (
                <div key={`${file.name}-${i}`} className="flex items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.has(i)}
                    onChange={() => toggleOne(i)}
                    className="w-4 h-4 rounded border-border text-pink focus:ring-pink/30 flex-shrink-0"
                  />
                  <span
                    className="w-7 h-7 rounded flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                    style={{ backgroundColor: badge.bg, color: badge.fg }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-sm text-navy truncate flex-1">{file.name}</span>
                  <span className="text-[11px] font-semibold bg-brand-primary-light text-brand-primary rounded-full px-2 py-0.5 flex-shrink-0">
                    New
                  </span>
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    title="Preview"
                    className="text-muted hover:text-navy transition-colors flex-shrink-0"
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOne(i)}
                    title="Remove file"
                    className="text-muted hover:text-error transition-colors flex-shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                  <span className="text-xs text-muted flex-shrink-0 w-14 text-right">{formatSize(file.size)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      {previewFile && (
        <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
      )}
    </div>
  );
}

/** Minimal file preview — image/text inline, otherwise a name + size fallback
 *  (no server-side preview endpoint exists yet for PDF/DOCX). */
function FilePreviewModal({ file, onClose }: { file: File; onClose: () => void }) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const isImage = file.type.startsWith("image/");
  const isText = file.name.toLowerCase().endsWith(".txt") || file.name.toLowerCase().endsWith(".md");
  const url = isImage ? URL.createObjectURL(file) : null;

  if (isText && textContent === null) {
    file.text().then(setTextContent).catch(() => setTextContent(""));
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/30 px-4"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] bg-white border border-border rounded-card shadow-card overflow-hidden flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <p className="text-sm font-semibold text-navy truncate">{file.name}</p>
          <button type="button" onClick={onClose} className="text-muted hover:text-navy transition-colors">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {isImage && url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={file.name} className="max-w-full rounded-btn" />
          ) : isText ? (
            <pre className="text-xs text-navy whitespace-pre-wrap font-mono">{textContent ?? "Loading…"}</pre>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
              <FileText size={32} className="text-muted" />
              <p className="text-sm text-navy">{formatSize(file.size)} · {file.type || "document"}</p>
              <p className="text-xs text-muted">No inline preview available for this file type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StepInput({
  direction, pasteBlocks, setPasteBlocks,
  dragging, setDragging, files, setFiles, jiraKeys, setJiraKeys, detected, setDetected, onContinue,
}: {
  direction: number;
  pasteBlocks: string[];
  setPasteBlocks: (v: string[]) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  files: File[];
  setFiles: (f: File[]) => void;
  jiraKeys: string[];
  setJiraKeys: (v: string[]) => void;
  detected: DetectedStory[] | null;
  setDetected: (d: DetectedStory[] | null) => void;
  onContinue: () => void;
}) {
  const [jiraInput, setJiraInput] = useState("");

  // Each paste block may itself contain multiple stories (--- or "As a…").
  const pastedStories = pasteBlocks.flatMap((b) => parsePastedStories(b));

  // Continue is enabled if ANY source has usable content (sources combine).
  const hasContent =
    pastedStories.some((s) => s.length >= MIN_STORY_CHARS) ||
    files.length > 0 ||
    jiraKeys.length > 0;

  /* ── Paste block helpers ── */
  const updateBlock = (i: number, v: string) =>
    setPasteBlocks(pasteBlocks.map((b, idx) => (idx === i ? v : b)));
  const addBlock = () => setPasteBlocks([...pasteBlocks, ""]);
  const removeBlock = (i: number) =>
    setPasteBlocks(pasteBlocks.length === 1 ? [""] : pasteBlocks.filter((_, idx) => idx !== i));

  /* ── Jira helpers ── */
  const addJiraKey = () => {
    const key = jiraInput.trim().toUpperCase();
    if (key && !jiraKeys.includes(key)) setJiraKeys([...jiraKeys, key]);
    setJiraInput("");
  };
  const removeJiraKey = (key: string) => setJiraKeys(jiraKeys.filter((k) => k !== key));

  /** Combine ALL sources into one detected list, then go to the select phase. */
  function buildPreview() {
    const list: DetectedStory[] = [];
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
    jiraKeys.forEach((key, i) => {
      list.push({
        id: `jira-${i}`,
        title: key,
        content: "Imported from Jira",
        charCount: 0,
        valid: true,
        source: "jira",
        selected: true,
      });
    });
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

  const sourcesWithContent =
    [pastedStories.some((s) => s.length >= MIN_STORY_CHARS), files.length > 0, jiraKeys.length > 0]
      .filter(Boolean).length;

  // ── Input phase: all three methods are stacked in one view (not tabs) so
  // it's clear they can be combined — paste a story AND upload a doc AND
  // import a Jira issue all at once, then Continue processes everything. ──
  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">Add your stories</h2>
      <p className="text-sm text-muted mb-6">Paste text, upload files, and/or import from Jira — mix and match, then continue.</p>

      {sourcesWithContent > 1 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 mb-6 rounded-card bg-surface-cyan border border-cyan/30 text-sm text-navy">
          <Sparkles size={15} className="text-cyan flex-shrink-0" />
          Using {sourcesWithContent} sources together — all stories below will be combined.
        </div>
      )}

      {/* ── Section: Paste Stories ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-surface-pink text-pink flex items-center justify-center flex-shrink-0">
            <FileText size={14} />
          </span>
          <h3 className="text-sm font-semibold text-navy">Paste Stories</h3>
          {pastedStories.length > 0 && (
            <span className="text-[11px] font-semibold bg-gray-100 text-muted rounded-full px-2 py-0.5">
              {pastedStories.length}
            </span>
          )}
        </div>

        <div className="space-y-4">
          {pasteBlocks.map((block, i) => (
            <div key={i} className="relative">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-muted">Story {i + 1}</span>
                {(pasteBlocks.length > 1 || block.trim().length > 0) && (
                  <button
                    type="button"
                    onClick={() => removeBlock(i)}
                    className="text-muted hover:text-error transition-colors inline-flex items-center gap-1 text-[11px] font-medium"
                  >
                    <X size={12} /> Remove
                  </button>
                )}
              </div>
              <textarea
                value={block}
                onChange={(e) => updateBlock(i, e.target.value)}
                placeholder={`As a [user type], I want to [do something] so that [I get some benefit].\n\nAcceptance Criteria:\n- [Criterion 1]\n- [Criterion 2]`}
                className="w-full h-[180px] p-4 font-mono text-[13px] border border-border rounded-btn resize-none text-navy placeholder:text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 transition-colors leading-relaxed"
              />
              <span className="absolute bottom-3 right-3 text-[11px] text-muted">
                {block.trim().length} chars
              </span>
            </div>
          ))}

          {/* Add another story */}
          <button
            type="button"
            onClick={addBlock}
            className="w-full h-10 flex items-center justify-center gap-2 border border-dashed border-border rounded-btn text-sm font-medium text-muted hover:text-pink hover:border-pink hover:bg-surface-pink/30 transition-colors"
          >
            <Plus size={15} />
            Add another story
          </button>

          <p className="text-xs text-muted">
            Add a block per story, or paste several in one block separated by a line containing{" "}
            <code className="px-1 py-0.5 rounded bg-gray-100 text-navy">---</code>. Minimum {MIN_STORY_CHARS} characters per story.
          </p>

          {/* Detected stories preview (live) */}
          {pastedStories.length > 0 && (
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
      </section>

      {/* ── Section: Upload Files ── */}
      <section className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-surface-cyan text-cyan flex items-center justify-center flex-shrink-0">
            <Upload size={14} />
          </span>
          <h3 className="text-sm font-semibold text-navy">Upload Files</h3>
          {files.length > 0 && (
            <span className="text-[11px] font-semibold bg-gray-100 text-muted rounded-full px-2 py-0.5">
              {files.length}
            </span>
          )}
        </div>

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
            <FileListPanel files={files} setFiles={setFiles} />
          )}
        </div>
      </section>

      {/* ── Section: Import from Jira ── */}
      <section className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-lg bg-surface-cyan text-cyan flex items-center justify-center flex-shrink-0">
            <FileText size={14} />
          </span>
          <h3 className="text-sm font-semibold text-navy">Import from Jira</h3>
          {jiraKeys.length > 0 && (
            <span className="text-[11px] font-semibold bg-gray-100 text-muted rounded-full px-2 py-0.5">
              {jiraKeys.length}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={jiraInput}
              onChange={(e) => setJiraInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addJiraKey(); } }}
              placeholder="Jira Issue Key (e.g. AUTH-001)"
              className="w-[200px] px-3 h-9 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
            />
            <button
              type="button"
              onClick={addJiraKey}
              disabled={!jiraInput.trim()}
              className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Import
            </button>
          </div>

          {/* Imported keys */}
          {jiraKeys.length > 0 && (
            <div className="border border-border rounded-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border bg-gray-50">
                <p className="text-[13px] font-semibold text-navy">Imported Issues ({jiraKeys.length})</p>
              </div>
              <div className="divide-y divide-border max-h-44 overflow-y-auto">
                {jiraKeys.map((key) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="w-8 h-8 rounded-lg bg-surface-cyan text-cyan flex items-center justify-center flex-shrink-0">
                      <FileText size={15} />
                    </span>
                    <span className="text-sm font-medium text-navy flex-1">{key}</span>
                    <button
                      type="button"
                      onClick={() => removeJiraKey(key)}
                      className="text-muted hover:text-error transition-colors flex-shrink-0"
                      title="Remove issue"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-muted">
            Add multiple issue keys, one at a time. Not connected?{" "}
            <Link href="/settings/integrations" className="text-cyan hover:underline">Connect Jira</Link>
          </p>
        </div>
      </section>

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

  const validItems = detected.filter((s) => s.valid);
  const selectedCount = detected.filter((s) => s.valid && s.selected).length;
  const allSelected = validItems.length > 0 && selectedCount === validItems.length;
  const estimatedCredits = selectedCount * CREDITS_PER_STORY;

  const toggleAll = () =>
    setDetected(detected.map((s) => (s.valid ? { ...s, selected: !allSelected } : s)));

  const sourceLabel: Record<StorySource, string> = {
    paste: "Pasted",
    upload: "File",
    jira: "Jira",
  };

  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">Select stories to process</h2>
      <p className="text-sm text-muted mb-4">
        We detected {detected.length} {detected.length === 1 ? "story" : "stories"} across all sources. Choose which to include.
      </p>

      {/* Common select-all toggle */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm font-medium text-pink hover:underline"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
        <span className="text-xs text-muted">{selectedCount} of {validItems.length} selected</span>
      </div>

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
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-navy truncate">
                  Story {i + 1} · <span className="text-muted font-normal">{s.title}</span>
                </p>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-muted flex-shrink-0">
                  {sourceLabel[s.source]}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                {s.source === "paste" ? `${s.charCount} characters` : s.content}
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
      <div className="flex items-center justify-between p-4 rounded-card bg-brand-primary-light/40 border border-brand-primary mb-6">
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
  direction, onBack, detected, files, pasteBlocks, projectId,
}: {
  direction: number;
  onBack: () => void;
  detected: DetectedStory[] | null;
  files: File[];
  pasteBlocks: string[];
  projectId: string;
}) {
  const router = useRouter();
  const { notify } = useAIAction();
  const { reloadProjects } = useProject();
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");

  // Improve Story modal state
  const [improveModalOpen, setImproveModalOpen] = useState(false);
  const [improveInstructions, setImproveInstructions] = useState("");
  const [improving, setImproving] = useState(false);
  const [improvedStory, setImprovedStory] = useState<string | null>(null);
  const [improveError, setImproveError] = useState<string | null>(null);
  // Local copy of story content that can be improved (starts from pasteBlocks)
  const [currentStoryContent, setCurrentStoryContent] = useState(
    pasteBlocks.join("\n---\n").trim()
  );

  async function handleImprove() {
    if (!currentStoryContent.trim()) return;
    setImproving(true);
    setImprovedStory(null);
    setImproveError(null);
    try {
      const { api } = await import("@/lib/api");
      const result = await api.improveStory(currentStoryContent, improveInstructions);
      setImprovedStory(result.improved_story);
    } catch (e: any) {
      setImproveError(e?.message ?? "Improvement failed. Please try again.");
    } finally {
      setImproving(false);
    }
  }

  function acceptImprovedStory() {
    if (improvedStory) {
      setCurrentStoryContent(improvedStory);
      // Also update pasteBlocks reference used by handleGenerate
      pasteBlocks.splice(0, pasteBlocks.length, improvedStory);
    }
    setImproveModalOpen(false);
    setImprovedStory(null);
    setImproveInstructions("");
  }

  async function handleGenerate() {
    setSubmitting(true);
    try {
      const { api } = await import("@/lib/api");
      const selectedStories = detected?.filter((s) => s.selected && s.valid) ?? [];
      const stories = selectedStories.length > 0 ? selectedStories : [null];
      let lastStoryId = "";

      for (let i = 0; i < stories.length; i++) {
        const s = stories[i];
        const storyId = makeStoryId(projectId);
        lastStoryId = storyId;
        const formData = new FormData();
        formData.append("story_id", storyId);
        formData.append("project_id", projectId);
        formData.append("source", "frontend");
        if (s?.source === "upload" && files[i]) {
          formData.append("file", files[i]);
        } else {
          const content = s?.content ?? pasteBlocks.join("\n---\n").trim();
          formData.append("content", content);
        }
        if (stories.length > 1) setProgress(`Uploading story ${i + 1} of ${stories.length}…`);
        const result = await api.uploadStory(formData);
        lastStoryId = result.storyId || storyId;
      }
      reloadProjects();
      router.push(`/stories/${lastStoryId}?analyzing=true`);
    } catch (err: any) {
      notify({
        variant: "error",
        title: "Upload failed",
        detail: err?.message ?? "Upload failed. Try again.",
      });
      setSubmitting(false);
    }
  }

  return (
    <>
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
          onClick={() => setImproveModalOpen(true)}
          disabled={submitting}
          className="text-sm font-medium text-muted hover:text-navy transition-colors disabled:opacity-40"
        >
          Improve Story First
        </button>
        <div className="flex items-center gap-3">
          {progress && submitting && <p className="text-sm text-muted">{progress}</p>}
          <button
            onClick={handleGenerate}
            disabled={submitting}
            className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors disabled:opacity-40"
          >
            {submitting ? "Uploading…" : "Generate New Tests Only"}
          </button>
          <button
            onClick={handleGenerate}
            disabled={submitting}
            className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors inline-flex items-center gap-2 disabled:opacity-40"
          >
            Generate + Analyze Impact
          </button>
        </div>
      </div>
    </StepWrapper>

    {/* Improve Story Modal */}
    {improveModalOpen && (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-navy/20 px-4" onMouseDown={() => { if (!improving) { setImproveModalOpen(false); setImprovedStory(null); setImproveInstructions(""); } }}>
        <div className="w-full max-w-2xl bg-white border border-border rounded-card shadow-card overflow-hidden max-h-[90vh] flex flex-col" onMouseDown={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
            <div>
              <h2 className="text-base font-semibold text-navy">Improve Story</h2>
              <p className="text-xs text-muted mt-0.5">Tell the AI how to improve your story, then accept the result.</p>
            </div>
            <button onClick={() => { if (!improving) { setImproveModalOpen(false); setImprovedStory(null); setImproveInstructions(""); } }} className="text-muted hover:text-navy transition-colors">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Current story */}
            <div>
              <label className="block text-sm font-semibold text-navy mb-2">
                {improvedStory ? "Original story" : "Your story"}
              </label>
              <div className="bg-gray-50 border border-border rounded-card px-4 py-3 text-sm text-navy max-h-40 overflow-y-auto whitespace-pre-wrap">
                {currentStoryContent || "No story content found."}
              </div>
            </div>

            {/* Instructions input */}
            {!improvedStory && (
              <div>
                <label className="block text-sm font-semibold text-navy mb-2">
                  How should it be improved? <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  value={improveInstructions}
                  onChange={e => setImproveInstructions(e.target.value)}
                  placeholder={'e.g. "Add more specific acceptance criteria for error states" or "Make the MFA flow clearer with specific code expiry rules"'}
                  rows={3}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-none"
                />
                {improveError && <p className="text-xs text-error mt-1">{improveError}</p>}
              </div>
            )}

            {/* Improved story result */}
            {improvedStory && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-5 h-5 rounded-full bg-success/20 text-success flex items-center justify-center text-xs">✓</span>
                  <label className="text-sm font-semibold text-navy">Improved story</label>
                </div>
                <div className="bg-[#ECFDF5] border border-[#6EE7B7] rounded-card px-4 py-3 text-sm text-navy max-h-64 overflow-y-auto whitespace-pre-wrap">
                  {improvedStory}
                </div>
                <button
                  onClick={() => { setImprovedStory(null); }}
                  className="mt-2 text-xs text-muted hover:text-navy underline"
                >
                  Not happy? Try again with different instructions
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
            <button
              onClick={() => { if (!improving) { setImproveModalOpen(false); setImprovedStory(null); setImproveInstructions(""); } }}
              disabled={improving}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            {!improvedStory ? (
              <button
                onClick={handleImprove}
                disabled={improving || !currentStoryContent.trim()}
                className="h-9 px-5 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {improving ? (
                  <><span className="w-3 h-3 rounded-full border-2 border-white border-t-transparent animate-spin" /> Improving…</>
                ) : (
                  "✨ Improve with AI"
                )}
              </button>
            ) : (
              <button
                onClick={acceptImprovedStory}
                className="h-9 px-5 rounded-btn bg-success text-white text-sm font-medium hover:bg-[#059669] transition-colors flex items-center gap-2"
              >
                ✓ Use this version
              </button>
            )}
          </div>
        </div>
      </div>
    )}
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
