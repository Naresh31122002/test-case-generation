"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  RefreshCw,
  GitCompare,
  Download,
  X,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileSpreadsheet,
  FileJson,
  FileType2,
  type LucideIcon,
} from "lucide-react";
import type { Story } from "@/lib/seed";
import { useAIAction, AI_ACTION_COSTS } from "@/contexts/AIActionContext";
import { api } from "@/lib/api";
import { BASE_URL, post, get } from "@/lib/apiClient";

/* ─────────────────────────── Async lifecycle ─────────────────────────── */

type Phase = "idle" | "loading" | "success" | "error";

/* ─────────────────────────── Modal shell ─────────────────────────── */

function Modal({
  title,
  icon: Icon,
  onClose,
  children,
}: {
  title: string;
  icon: LucideIcon;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md bg-white border border-border rounded-card shadow-card overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-surface-pink text-pink flex items-center justify-center">
              <Icon size={15} />
            </span>
            <h2 className="text-base font-semibold text-navy">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-navy transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

/** Shared success/error result panels reused by every modal. */
function ResultPanel({
  phase,
  successTitle,
  successBody,
  error,
  onRetry,
  onClose,
}: {
  phase: "success" | "error";
  successTitle: string;
  successBody: string;
  error: string;
  onRetry: () => void;
  onClose: () => void;
}) {
  if (phase === "success") {
    return (
      <div className="p-6 text-center">
        <span className="w-12 h-12 rounded-full bg-[#ECFDF5] text-success flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 size={26} />
        </span>
        <h3 className="text-base font-semibold text-navy mb-1">{successTitle}</h3>
        <p className="text-sm text-muted mb-5">{successBody}</p>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors"
        >
          Done
        </button>
      </div>
    );
  }
  return (
    <div className="p-6 text-center">
      <span className="w-12 h-12 rounded-full bg-[#FEF2F2] text-error flex items-center justify-center mx-auto mb-3">
        <AlertTriangle size={26} />
      </span>
      <h3 className="text-base font-semibold text-navy mb-1">Action failed</h3>
      <p className="text-sm text-muted mb-5">{error}</p>
      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onRetry}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

/** Primary submit button that reflects the loading phase. */
function SubmitButton({
  loading,
  disabled,
  onClick,
  children,
}: {
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading || disabled}
      className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-50 inline-flex items-center gap-2"
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

/* ─────────────────────────── Upload New Version ─────────────────────────── */

function UploadVersionModal({ story, onClose, onVersionUploaded }: { story: Story; onClose: () => void; onVersionUploaded?: (versionNumber?: number) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [pasteText, setPasteText] = useState("");
  const [jiraKey, setJiraKey] = useState("");
  const [inputMode, setInputMode] = useState<"file" | "paste" | "jira">("file");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  async function submit() {
    setPhase("loading");
    setError("");
    try {
      const formData = new FormData();
      if (inputMode === "file" && file) {
        formData.append("file", file);
      } else if (inputMode === "paste" && pasteText.trim()) {
        formData.append("content", pasteText.trim());
      } else if (inputMode === "jira" && jiraKey.trim()) {
        formData.append("jira_issue_key", jiraKey.trim());
      } else {
        throw new Error("Please provide content for the new version.");
      }
      if (notes.trim()) formData.append("version_notes", notes.trim());
      const result = await api.uploadNewVersion(story.id, formData);
      setPhase("success");
      onVersionUploaded?.(result?.version_number);
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  const TAB_CLASSES = (active: boolean) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      active ? "border-pink text-pink" : "border-transparent text-muted hover:text-navy"
    }`;

  return (
    <Modal title="Upload New Version" icon={Upload} onClose={onClose}>
      {phase === "error" ? (
        <ResultPanel
          phase={phase}
          successTitle="New version uploaded"
          successBody=""
          error={error}
          onRetry={submit}
          onClose={onClose}
        />
      ) : phase === "success" ? (
        <div className="p-5 flex flex-col items-center gap-4 text-center">
          <span className="w-12 h-12 rounded-full bg-[#ECFDF5] text-success flex items-center justify-center">
            <CheckCircle2 size={24} />
          </span>
          <div>
            <h3 className="text-base font-semibold text-navy">New version uploaded</h3>
            <p className="text-sm text-muted mt-1">Test regeneration has started. Check the Tests tab — new test cases will appear shortly.</p>
          </div>
          <button
            onClick={onClose}
            className="h-9 px-6 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="p-5 space-y-4">
          {/* Input mode tabs */}
          <div className="flex border-b border-border -mt-1">
            <button className={TAB_CLASSES(inputMode === "file")} onClick={() => setInputMode("file")}>Upload File</button>
            <button className={TAB_CLASSES(inputMode === "paste")} onClick={() => setInputMode("paste")}>Paste Text</button>
            <button className={TAB_CLASSES(inputMode === "jira")} onClick={() => setInputMode("jira")}>Import from Jira</button>
          </div>

          {/* File upload */}
          {inputMode === "file" && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={`flex flex-col items-center justify-center gap-2 py-8 px-4 rounded-card border-2 border-dashed cursor-pointer transition-colors ${
                dragging ? "border-pink bg-surface-pink/40" : "border-border hover:border-pink hover:bg-gray-50"
              }`}
            >
              <span className="w-10 h-10 rounded-full bg-surface-pink text-pink flex items-center justify-center">
                <UploadCloud size={20} />
              </span>
              {file ? (
                <div className="flex items-center gap-2 text-sm text-navy">
                  <FileText size={15} className="text-pink" />
                  <span className="font-medium">{file.name}</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-navy">Drag and drop your file here</p>
                  <p className="text-xs text-muted">PDF, DOCX, TXT, MD supported</p>
                </>
              )}
              <button type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
                Browse Files
              </button>
              <input ref={inputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt,.md"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
          )}

          {/* Paste text */}
          {inputMode === "paste" && (
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Story content</label>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                placeholder="Paste your updated user story, requirements or acceptance criteria here…"
                className="w-full px-3 py-2.5 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-y"
                autoFocus
              />
              <p className="text-xs text-muted mt-1">{pasteText.length} characters</p>
            </div>
          )}

          {/* Jira import */}
          {inputMode === "jira" && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-navy mb-1.5">Jira Issue Key</label>
                <input type="text" value={jiraKey} onChange={(e) => setJiraKey(e.target.value)}
                  placeholder="e.g. PROJ-123"
                  className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors"
                  autoFocus />
              </div>
              <p className="text-xs text-muted">
                The issue description and acceptance criteria will be imported as the new version.
                Make sure your Jira integration is configured in Settings.
              </p>
            </div>
          )}

          {/* Version notes */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Version notes <span className="text-muted font-normal">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="What changed in this version?"
              className="w-full px-3 py-2.5 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-y" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <SubmitButton loading={phase === "loading"}
              disabled={inputMode === "file" ? !file : inputMode === "paste" ? !pasteText.trim() : !jiraKey.trim()}
              onClick={submit}>
              Upload
            </SubmitButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────── Compare ─────────────────────────── */

/** Build a v-list down to v1 from the story's current version (e.g. "v3"). */
function versionsFor(story: Story): string[] {
  const n = parseInt(story.version.replace(/\D/g, ""), 10) || 1;
  return Array.from({ length: n }, (_, i) => `v${n - i}`);
}

function CompareModal({ story, onClose }: { story: Story; onClose: () => void }) {
  const versions = versionsFor(story);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(versions[0]);
  const [previous, setPrevious] = useState(versions[1] ?? versions[0]);
  const [result, setResult] = useState<any>(null);

  const sameVersion = current === previous;

  async function submit() {
    setPhase("loading");
    setError("");
    try {
      const data = await post<any>(`/api/stories/${story.id}/compare`, {
        version_a: current === 'Current' ? 'current' : current.replace('v',''),
        version_b: previous === 'Current' ? 'current' : previous.replace('v',''),
      });
      setResult(data);
      setPhase("success");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  return (
    <Modal title="Compare Versions" icon={GitCompare} onClose={onClose}>
      {phase === "success" && result ? (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-navy">{result.version_a.label}</p>
              <p className="text-muted">{result.version_a.tc_count} test cases</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-navy">{result.version_b.label}</p>
              <p className="text-muted">{result.version_b.tc_count} test cases</p>
            </div>
          </div>
          {result.tc_delta !== 0 && (
            <p className={`text-sm font-medium ${result.tc_delta > 0 ? 'text-success' : 'text-error'}`}>
              {result.tc_delta > 0 ? `+${result.tc_delta}` : result.tc_delta} test cases
            </p>
          )}
          {result.tests_added?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-success mb-1">Added tests ({result.tests_added.length})</p>
              <ul className="space-y-0.5">{result.tests_added.map((t: string, i: number) => <li key={i} className="text-xs text-navy truncate">+ {t}</li>)}</ul>
            </div>
          )}
          {result.tests_removed?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-error mb-1">Removed tests ({result.tests_removed.length})</p>
              <ul className="space-y-0.5">{result.tests_removed.map((t: string, i: number) => <li key={i} className="text-xs text-navy truncate">- {t}</li>)}</ul>
            </div>
          )}
          {result.content_diff?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted mb-1">Content changes</p>
              <pre className="text-[10px] bg-gray-50 border border-border rounded p-2 overflow-auto max-h-32 font-mono">{result.content_diff.join('')}</pre>
            </div>
          )}
          <div className="flex justify-end">
            <button onClick={onClose} className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors">Close</button>
          </div>
        </div>
      ) : phase === "error" ? (
        <ResultPanel phase={phase} successTitle="" successBody="" error={error} onRetry={submit} onClose={onClose} />
      ) : (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Version A</label>
              <select value={current} onChange={(e) => setCurrent(e.target.value)}
                className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy bg-white focus:outline-none focus:border-pink transition-colors cursor-pointer">
                {versions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Version B</label>
              <select value={previous} onChange={(e) => setPrevious(e.target.value)}
                className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy bg-white focus:outline-none focus:border-pink transition-colors cursor-pointer">
                {versions.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
          {sameVersion && <p className="text-xs text-error">Select two different versions to compare.</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors">Cancel</button>
            <SubmitButton loading={phase === "loading"} disabled={sameVersion} onClick={submit}>
              {phase === "loading" ? "Comparing…" : "Run Comparison"}
            </SubmitButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────── Export ─────────────────────────── */

const EXPORT_FORMATS: { id: string; label: string; icon: LucideIcon; ext: string; description: string }[] = [
  { id: "excel",      label: "Excel",         icon: FileSpreadsheet, ext: ".xlsx",    description: "Spreadsheet with all test case data" },
  { id: "playwright", label: "Playwright",    icon: FileType2,       ext: ".spec.ts", description: "TypeScript E2E tests" },
  { id: "cypress",    label: "Cypress",       icon: FileType2,       ext: ".spec.js", description: "JavaScript E2E tests" },
  { id: "pytest",     label: "PyTest",        icon: FileText,        ext: ".py",      description: "Python unit/E2E tests" },
  { id: "bdd",        label: "BDD / Gherkin", icon: FileText,        ext: ".feature", description: "Given/When/Then feature files" },
  { id: "selenium",   label: "Selenium",      icon: FileType2,       ext: ".py",      description: "Python WebDriver tests" },
  { id: "postman",    label: "Postman",       icon: FileJson,        ext: ".json",    description: "API test collection" },
];

function ExportModal({ story, onClose }: { story: Story; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [format, setFormat] = useState(EXPORT_FORMATS[0]); // default Excel
  const [approvedOnly, setApprovedOnly] = useState(false);

  async function submit() {
    setPhase("loading");
    setError("");
    try {
      if (format.id === "excel") {
        // Direct Excel download from backend
        const downloadUrl = (story as any).downloadUrl ?? `/api/stories/testcases/download/${story.id}`;
        const res = await fetch(BASE_URL + downloadUrl, { credentials: "include" });
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `test-cases-${story.id}.xlsx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        // LLM-generated framework code from export-code endpoint
        const params = new URLSearchParams({ format: format.id, approved_only: String(approvedOnly) });
        const data = await get<{ code: string; format: string }>(`/api/stories/${story.id}/export-code?${params}`);
        const code = data.code ?? "";
        const blob = new Blob([code], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${story.id}-tests${format.ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      }
      setPhase("success");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  return (
    <Modal title="Export" icon={Download} onClose={onClose}>
      {phase === "success" || phase === "error" ? (
        <ResultPanel
          phase={phase}
          successTitle="Export ready"
          successBody={`${story.id}${format.ext} downloaded.`}
          error={error}
          onRetry={submit}
          onClose={onClose}
        />
      ) : (
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted">Choose a format to export the tests for {story.id}.</p>

          <div className="grid grid-cols-2 gap-2">
            {EXPORT_FORMATS.map((f) => {
              const Icon = f.icon;
              const on = format.id === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f)}
                  className={`flex items-center gap-2.5 px-3 py-3 rounded-card border text-left transition-colors ${
                    on
                      ? "border-brand-primary bg-brand-primary-light/40"
                      : "border-border hover:border-pink hover:bg-gray-50"
                  }`}
                >
                  <span className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    on ? "bg-pink text-white" : "bg-gray-100 text-muted"
                  }`}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-navy">{f.label}</p>
                    <p className="text-[11px] text-muted">{f.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {format.id !== "excel" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={approvedOnly}
                onChange={(e) => setApprovedOnly(e.target.checked)}
                className="w-4 h-4 accent-pink"
              />
              <span className="text-sm text-navy">Include only approved tests</span>
            </label>
          )}

          {format.id !== "excel" && (
            <p className="text-xs text-muted flex items-center gap-1">
              <span className="w-3 h-3 rounded-full bg-cyan/20 text-cyan flex items-center justify-center text-[9px] font-bold">AI</span>
              Code generated by AI from your test cases.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <SubmitButton loading={phase === "loading"} onClick={submit}>
              {phase === "loading" ? "Exporting…" : "Export"}
            </SubmitButton>
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ─────────────────────────── Action bar ─────────────────────────── */
/* ─────────────────────────── Action bar ─────────────────────────── */

type ActiveModal = "upload" | "compare" | null;

export function StoryActions({ story, onVersionUploaded }: { story: Story; onVersionUploaded?: (versionNumber?: number) => void }) {
  const [active, setActive] = useState<ActiveModal>(null);
  const { runAIAction } = useAIAction();
  const close = () => setActive(null);

  // Generate Tests — calls real backend regenerate endpoint
  const generateTests = () =>
    runAIAction({
      name: "Generate Tests",
      credits: AI_ACTION_COSTS.generateTests,
      description: `Generate a Functional, Negative, Boundary and Security test suite for ${story.id}.`,
      run: () => api.regenerateTests(story.id).then(() => undefined),
    });

  const buttons: { id: string; label: string; icon: LucideIcon; onClick: () => void }[] = [
    { id: "upload",  label: "Upload New Version", icon: Upload,     onClick: () => setActive("upload") },
    { id: "compare", label: "Compare",            icon: GitCompare, onClick: () => setActive("compare") },
  ];

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        {buttons.map((b) => {
          const Icon = b.icon;
          return (
            <button
              key={b.id}
              type="button"
              onClick={b.onClick}
              className="h-9 px-3 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <Icon size={14} />
              {b.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence>
        {active === "upload" && <UploadVersionModal story={story} onClose={close} onVersionUploaded={onVersionUploaded} />}
        {active === "compare" && <CompareModal story={story} onClose={close} />}
      </AnimatePresence>
    </>
  );
}
