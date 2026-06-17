"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Clipboard,
  AlertTriangle,
  Sparkles,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { easeStandard, easeOut, duration, spring } from "@/lib/motion";

type StepId = 1 | 2 | 3;
type InputTab = "paste" | "upload" | "jira";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [checkedTypes, setCheckedTypes] = useState(
    Object.fromEntries(testTypes.map((t) => [t.id, true]))
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
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
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
              />
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ─── Step 1 ─── */
function StepInput({
  direction, inputTab, setInputTab, storyText, setStoryText,
  dragging, setDragging, selectedFile, setSelectedFile, onContinue,
}: {
  direction: number;
  inputTab: InputTab;
  setInputTab: (t: InputTab) => void;
  storyText: string;
  setStoryText: (v: string) => void;
  dragging: boolean;
  setDragging: (v: boolean) => void;
  selectedFile: File | null;
  setSelectedFile: (f: File | null) => void;
  onContinue: () => void;
}) {
  const hasContent =
    inputTab === "paste" ? storyText.trim().length > 0 : selectedFile !== null;

  return (
    <StepWrapper direction={direction}>
      <h2 className="text-[24px] font-bold text-navy mb-1">Add your story</h2>
      <p className="text-sm text-muted mb-6">Paste text, upload a file, or import from Jira.</p>

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
            {tab === "paste" ? "Paste Story" : tab === "upload" ? "Upload File" : "Import from Jira"}
          </button>
        ))}
      </div>

      {inputTab === "paste" && (
        <div className="relative">
          <textarea
            value={storyText}
            onChange={(e) => setStoryText(e.target.value)}
            placeholder={`As a [user type], I want to [do something] so that [I get some benefit].\n\nAcceptance Criteria:\n- [Criterion 1]\n- [Criterion 2]\n- [Criterion 3]`}
            className="w-full h-[240px] p-4 font-mono text-[13px] border border-border rounded-btn resize-none text-navy placeholder:text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 transition-colors leading-relaxed"
          />
          <span className="absolute bottom-3 right-3 text-[11px] text-muted">
            {storyText.length} chars
          </span>
        </div>
      )}

      {inputTab === "upload" && (
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
            const file = e.dataTransfer.files[0];
            if (file) setSelectedFile(file);
          }}
          className="h-[240px] border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-3 cursor-pointer"
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".pdf,.docx,.txt";
            input.onchange = (e) => {
              const file = (e.target as HTMLInputElement).files?.[0];
              if (file) setSelectedFile(file);
            };
            input.click();
          }}
        >
          {selectedFile ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 size={20} className="text-success" />
              <div>
                <p className="text-sm font-semibold text-navy">{selectedFile.name}</p>
                <p className="text-xs text-muted">{(selectedFile.size / 1024).toFixed(1)} KB</p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                className="text-muted hover:text-error transition-colors ml-2"
              >
                ×
              </button>
            </div>
          ) : (
            <>
              <Upload size={32} className="text-muted" />
              <p className="text-sm font-medium text-navy">Drop a file here or click to browse</p>
              <p className="text-xs text-muted">Supports .pdf, .docx, .txt — up to 10MB</p>
            </>
          )}
        </motion.div>
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
          onClick={onContinue}
          disabled={!hasContent && inputTab !== "jira"}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Continue
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
function StepGenerate({ direction, onBack }: { direction: number; onBack: () => void }) {
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
          className="text-sm font-medium text-muted hover:text-navy transition-colors"
        >
          Improve Story First
        </button>
        <div className="flex gap-3">
          <button className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
            Generate New Tests Only
          </button>
          <Link
            href="/stories/LOGIN-001"
            className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors inline-flex items-center gap-2"
          >
            Generate + Analyze Impact
          </Link>
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
