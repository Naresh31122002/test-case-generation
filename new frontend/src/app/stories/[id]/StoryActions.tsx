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
import { BASE_URL } from "@/lib/apiClient";

/* ─────────────────────────── Async lifecycle ─────────────────────────── */

type Phase = "idle" | "loading" | "success" | "error";

/** Simulated async op (~10% failure) so loading/success/error states are real. */
function runMockAsync(ms = 1400): Promise<void> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.1) reject(new Error("Something went wrong. Please try again."));
      else resolve();
    }, ms);
  });
}

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

function UploadVersionModal({ story, onClose }: { story: Story; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
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
      if (file) {
        formData.append("file", file);
      } else if (notes.trim()) {
        formData.append("content", notes.trim());
      } else {
        throw new Error("Please provide a file or notes for the new version.");
      }
      await api.uploadNewVersion(story.id, formData);
      setPhase("success");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  return (
    <Modal title="Upload New Version" icon={Upload} onClose={onClose}>
      {phase === "success" || phase === "error" ? (
        <ResultPanel
          phase={phase}
          successTitle="New version uploaded"
          successBody={`${file?.name ?? "Your document"} is now the latest version of ${story.id}.`}
          error={error}
          onRetry={submit}
          onClose={onClose}
        />
      ) : (
        <div className="p-5 space-y-4">
          {/* Drag & drop / browse */}
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
                <p className="text-xs text-muted">or</p>
              </>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
              className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors"
            >
              Browse Files
            </button>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.md"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          {/* Version notes */}
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Version notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What changed in this version?"
              className="w-full px-3 py-2.5 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-y"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <SubmitButton loading={phase === "loading"} disabled={!file} onClick={submit}>
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

  const sameVersion = current === previous;

  async function submit() {
    setPhase("loading");
    setError("");
    try {
      await runMockAsync();
      setPhase("success");
    } catch (err) {
      setError((err as Error).message);
      setPhase("error");
    }
  }

  return (
    <Modal title="Compare Versions" icon={GitCompare} onClose={onClose}>
      {phase === "success" || phase === "error" ? (
        <ResultPanel
          phase={phase}
          successTitle="Comparison ready"
          successBody={`Differences between ${previous} and ${current} of ${story.id} are ready to review.`}
          error={error}
          onRetry={submit}
          onClose={onClose}
        />
      ) : (
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Current version</label>
              <select
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy bg-white focus:outline-none focus:border-pink transition-colors cursor-pointer"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Previous version</label>
              <select
                value={previous}
                onChange={(e) => setPrevious(e.target.value)}
                className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy bg-white focus:outline-none focus:border-pink transition-colors cursor-pointer"
              >
                {versions.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {sameVersion && (
            <p className="text-xs text-error">Select two different versions to compare.</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
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

const EXPORT_FORMATS: { id: string; label: string; icon: LucideIcon; ext: string }[] = [
  { id: "pdf",   label: "PDF",   icon: FileType2,        ext: ".pdf" },
  { id: "excel", label: "Excel", icon: FileSpreadsheet,  ext: ".xlsx" },
  { id: "csv",   label: "CSV",   icon: FileText,         ext: ".csv" },
  { id: "json",  label: "JSON",  icon: FileJson,         ext: ".json" },
];

function ExportModal({ story, onClose }: { story: Story; onClose: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState("");
  const [format, setFormat] = useState(EXPORT_FORMATS[1]); // default to Excel (the only working format)

  async function submit() {
    // Only Excel is supported via the real backend endpoint
    if (format.id !== "excel") {
      setError(`${format.label} export is not yet available. Only Excel (.xlsx) is supported.`);
      setPhase("error");
      return;
    }
    setPhase("loading");
    setError("");
    try {
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
          successBody={`${story.id}${format.ext} has been generated and is ready to download.`}
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
                    <p className="text-[11px] text-muted">{f.ext}</p>
                  </div>
                </button>
              );
            })}
          </div>

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

type ActiveModal = "upload" | "compare" | "export" | null;

export function StoryActions({ story }: { story: Story }) {
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
    { id: "upload",   label: "Upload New Version", icon: Upload,     onClick: () => setActive("upload") },
    { id: "generate", label: "Generate Tests",     icon: RefreshCw,  onClick: generateTests },
    { id: "compare",  label: "Compare",            icon: GitCompare, onClick: () => setActive("compare") },
    { id: "export",   label: "Export",             icon: Download,   onClick: () => setActive("export") },
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
        {active === "upload" && <UploadVersionModal story={story} onClose={close} />}
        {active === "compare" && <CompareModal story={story} onClose={close} />}
        {active === "export" && <ExportModal story={story} onClose={close} />}
      </AnimatePresence>
    </>
  );
}
