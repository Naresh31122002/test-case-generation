"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, TestCase } from "@/lib/api";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Brain, FileText, CheckCircle2,
  Eye, LayoutDashboard, Clock, ChevronRight, Code2,
  ListChecks, AlertTriangle, Info, Play,
} from "lucide-react";
import { Chatbot } from "@/components/chatbot";
import { ExportScriptDialog } from "@/components/export-script-dialog";
import { RunMode } from "@/components/run-mode";

function cleanAndParseLLMResponse(response: string) {
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try { return { parsed: JSON.parse(cleaned), cleaned }; }
  catch { return { parsed: null, cleaned }; }
}
function formatRagTestCases(testCases: any[]) {
  return testCases.map((tc, idx) => {
    const steps = Array.isArray(tc.steps) ? tc.steps.join("\n") : tc.steps;
    return `Test Case ${idx + 1}: ${tc.title}\nSteps:\n${steps}\nExpected Result: ${tc.expected_result}\n`;
  }).join("\n\n");
}

export default function StoryTestCasesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");
  const storyId = typeof params?.storyId === "string" ? params.storyId : Array.isArray(params?.storyId) ? params.storyId[0] : "";

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [storyDescription, setStoryDescription] = useState<string | null>(null);
  const [storyContent, setStoryContent] = useState<string | null>(null);
  const [storyProject, setStoryProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");

  /* split pane — selected test case (no dialog) */
  const [activeIdx, setActiveIdx] = useState(0);

  /* run mode */
  const [runMode, setRunMode] = useState(false);

  /* sheets / export */
  const [showStorySheet, setShowStorySheet] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);

  /* chatbot */
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{
    role: "assistant",
    content: "Hello! I can help you analyze the test cases for this story. What would you like to know?",
  }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "rag">("rag");

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    setCurrentTime(new Date().toLocaleTimeString());
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!storyId) return;
    (async () => {
      try {
        setLoading(true);
        const res = await api.getTestCases(storyId);
        const raw = (res as any)?.testcases;
        const tcs = Array.isArray(raw) ? raw : [];
        setTestCases(tcs);
        setActiveIdx(0);
        setStoryDescription((res as any)?.storyDescription ?? null);
        if ((res as any)?.error) setError(String((res as any).error));

        try {
          const sr = await fetch(`http://127.0.0.1:5000/api/stories/${storyId}`);
          if (sr.ok) {
            const sd = await sr.json();
            setStoryContent(sd.document_content);
            setStoryProject(sd.project_id);
          }
        } catch {
          const { MOCK_STORY_MAP } = await import("@/lib/mock-stories");
          const ms = MOCK_STORY_MAP[storyId];
          if (ms) { setStoryContent(ms.doc_content_text); setStoryProject(ms.project_id); }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to fetch test cases");
      } finally { setLoading(false); }
    })();
  }, [storyId]);

  const handleDownload = async () => {
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/testcases/download/${storyId}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `test_cases_${storyId}.xlsx`;
      document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { console.error("Download failed"); }
  };

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isGenerating) return;
    setChatMessages(p => [...p, { role: "user", content: message }]);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-test-cases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context: "Generate or analyse test cases", model: selectedModel, storyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (selectedModel === "rag" && data.response) {
        const { parsed, cleaned } = cleanAndParseLLMResponse(data.response);
        setChatMessages(p => [...p, { role: "assistant", content: parsed && Array.isArray(parsed) ? formatRagTestCases(parsed) : cleaned || "[No output]" }]);
      } else setChatMessages(p => [...p, { role: "assistant", content: data.response }]);
    } catch { setChatMessages(p => [...p, { role: "assistant", content: "Connection error." }]); }
    finally { setIsGenerating(false); }
  };

  const priorityStyle = (p?: string) => {
    if (p === "high")   return { bg: "#fff1f2", color: "#be123c", border: "#fecdd3", dot: "#be123c" };
    if (p === "medium") return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", dot: "#b45309" };
    return                     { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", dot: "#15803d" };
  };

  const activeTC = testCases[activeIdx] ?? null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        {/* ── Top bar ──────────────────────────────────────── */}
        <header className="flex items-center justify-between h-14 px-5 border-b border-[#eef2f8] bg-white sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[#5a7ca0] hover:text-[#0F162B]" />
            <Separator orientation="vertical" className="h-5" />
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#5a7ca0] hover:text-[#0F162B] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-1.5 text-sm">
              <LayoutDashboard className="w-4 h-4 text-[#5a7ca0]" />
              <span className="text-[#5a7ca0]">Dashboard</span>
              <ChevronRight className="w-3.5 h-3.5 text-[#b0c4d8]" />
              <span className="font-semibold text-[#0F162B]">Test Cases</span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#0F162B]">
            <Clock className="w-4 h-4 text-[#377ACF]" />
            {currentTime || "—"}
          </div>
        </header>

        {/* ── Page body ────────────────────────────────────── */}
        <div className="flex flex-col" style={{ background: "#F6F8FB", minHeight: "calc(100vh - 56px)" }}>

          {/* Story header strip */}
          <div className="mx-6 mt-6 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: "#0F162B" }}>
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                    style={{ background: "rgba(55,122,207,0.25)", color: "#A2D2E9" }}>
                    <CheckCircle2 className="w-3 h-3" />{testCases.length} Test Cases
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                    style={{ background: "rgba(162,210,233,0.12)", color: "#A2D2E9" }}>
                    <Brain className="w-3 h-3" />AI Generated
                  </span>
                  {storyProject && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: "rgba(162,210,233,0.12)", color: "#A2D2E9" }}>
                      {storyProject}
                    </span>
                  )}
                </div>
                <h1 className="text-base font-bold text-white leading-tight">Story {storyId}</h1>
                {storyDescription && (
                  <p className="text-xs mt-0.5 leading-relaxed line-clamp-1" style={{ color: "#A2D2E9" }}>
                    {storyDescription}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setShowStorySheet(true)}
                  className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80"
                  style={{ background: "rgba(162,210,233,0.15)", color: "#A2D2E9", border: "1px solid rgba(162,210,233,0.25)" }}>
                  <Eye className="w-3.5 h-3.5" />View Story
                </button>
                <button
                  onClick={() => setRunMode(true)}
                  disabled={testCases.length === 0}
                  className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "rgba(162,210,233,0.25)", color: "#ffffff", border: "1px solid rgba(162,210,233,0.3)" }}>
                  <Play className="w-3.5 h-3.5" />Run Tests
                </button>
                <button onClick={() => setShowExportDialog(true)} disabled={testCases.length === 0}
                  className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "#A2D2E9", color: "#0F162B" }}>
                  <Code2 className="w-3.5 h-3.5" />Export Script
                </button>
                <button onClick={handleDownload}
                  className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
                  style={{ background: "#377ACF" }}>
                  <Download className="w-3.5 h-3.5" />Download
                </button>
              </div>
            </div>
          </div>

          {/* ── Split pane ───────────────────────────────────── */}
          <div className="flex-1 flex gap-0 mx-6 mt-4 mb-6 rounded-2xl overflow-hidden border border-[#dde6f0] shadow-sm"
            style={{ background: "#ffffff", minHeight: 0 }}>

            {runMode ? (
              <RunMode storyId={storyId} testCases={testCases} onExit={() => setRunMode(false)} />
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="inline-flex items-center gap-3 text-sm font-semibold text-[#377ACF]">
                  <div className="w-5 h-5 border-2 border-[#377ACF] border-t-transparent rounded-full animate-spin" />
                  Loading test cases…
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center py-16 text-sm font-semibold text-red-500">{error}</div>
            ) : testCases.length === 0 ? (
              <div className="flex-1 flex items-center justify-center py-16 text-sm text-[#9ca3af]">No test cases found.</div>
            ) : (
              <>
                {/* ── LEFT: numbered list ──────────────────── */}
                <div className="w-72 flex-shrink-0 flex flex-col border-r border-[#eef2f8] overflow-hidden">
                  {/* list header */}
                  <div className="px-4 py-3 border-b border-[#eef2f8] flex items-center justify-between flex-shrink-0"
                    style={{ background: "#fafbfd" }}>
                    <div className="flex items-center gap-2">
                      <ListChecks className="w-3.5 h-3.5 text-[#377ACF]" />
                      <span className="text-xs font-bold uppercase tracking-widest text-[#5a7ca0]">Test Cases</span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: "#f0f6ff", color: "#377ACF" }}>
                      {testCases.length}
                    </span>
                  </div>

                  {/* list rows */}
                  <div className="flex-1 overflow-y-auto">
                    {testCases.map((tc, idx) => {
                      const ps = priorityStyle(tc.priority);
                      const isActive = activeIdx === idx;
                      return (
                        <button
                          key={tc.test_case_id || tc.id || idx}
                          onClick={() => setActiveIdx(idx)}
                          className="w-full text-left flex items-center gap-3 px-4 py-3 transition-all relative"
                          style={{
                            background: isActive ? "#f0f6ff" : "transparent",
                            borderBottom: "1px solid #eef2f8",
                          }}
                        >
                          {/* active indicator bar */}
                          {isActive && (
                            <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r"
                              style={{ background: "#377ACF" }} />
                          )}

                          {/* number badge */}
                          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
                            style={{
                              background: isActive ? "#377ACF" : "#f0f6ff",
                              color: isActive ? "#ffffff" : "#377ACF",
                            }}>
                            {idx + 1}
                          </div>

                          {/* title + id */}
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold truncate leading-tight"
                              style={{ color: isActive ? "#1a2540" : "#374151" }}>
                              {tc.title}
                            </div>
                            <div className="text-[10px] font-mono mt-0.5 truncate" style={{ color: "#9ca3af" }}>
                              {tc.test_case_id || tc.id || "—"}
                            </div>
                          </div>

                          {/* priority dot */}
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ps.dot }} />
                        </button>
                      );
                    })}
                  </div>

                  {/* priority legend */}
                  <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
                    style={{ borderTop: "1px solid #eef2f8", background: "#fafbfd" }}>
                    {[["high","#be123c"],["medium","#b45309"],["low","#15803d"]].map(([l, c]) => (
                      <div key={l} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                        <span className="text-[10px] capitalize" style={{ color: "#9ca3af" }}>{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── RIGHT: detail panel ──────────────────── */}
                {activeTC && (
                  <div className="flex-1 flex flex-col overflow-hidden min-w-0">

                    {/* detail header */}
                    <div className="px-6 py-4 flex-shrink-0 border-b border-[#eef2f8]"
                      style={{ background: "#fafbfd" }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-[#0F162B] leading-tight">
                            {activeTC.title}
                          </h2>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-mono text-[#9ca3af]">
                              {activeTC.test_case_id || activeTC.id || "—"}
                            </span>
                            {(() => {
                              const ps = priorityStyle(activeTC.priority);
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                  style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                                  {activeTC.priority || "low"} priority
                                </span>
                              );
                            })()}
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                              style={{ background: "rgba(55,122,207,0.08)", color: "#377ACF" }}>
                              <Brain className="w-2.5 h-2.5" />AI
                            </span>
                          </div>
                        </div>
                        {/* next / prev */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                            disabled={activeIdx === 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#dde6f0] transition-colors hover:bg-[#f0f6ff] disabled:opacity-30"
                            style={{ color: "#5a7ca0" }}>
                            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                          </button>
                          <span className="text-xs text-[#9ca3af] px-1">{activeIdx + 1}/{testCases.length}</span>
                          <button
                            onClick={() => setActiveIdx(i => Math.min(testCases.length - 1, i + 1))}
                            disabled={activeIdx === testCases.length - 1}
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-[#dde6f0] transition-colors hover:bg-[#f0f6ff] disabled:opacity-30"
                            style={{ color: "#5a7ca0" }}>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* detail body — two columns */}
                    <div className="flex-1 overflow-y-auto p-6">
                      <div className="grid grid-cols-2 gap-6 h-full">

                        {/* Steps */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center"
                              style={{ background: "#f0f6ff" }}>
                              <ListChecks className="w-3 h-3 text-[#377ACF]" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-[#5a7ca0]">
                              Test Steps
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
                              style={{ background: "#f0f6ff", color: "#377ACF" }}>
                              {activeTC.steps?.length || 0}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {activeTC.steps?.length ? activeTC.steps.map((step, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                {/* step number with connecting line */}
                                <div className="flex flex-col items-center flex-shrink-0">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                    style={{ background: "#377ACF" }}>
                                    {i + 1}
                                  </div>
                                  {i < (activeTC.steps?.length ?? 0) - 1 && (
                                    <div className="w-px flex-1 mt-1" style={{ background: "#c8d8eb", minHeight: 12 }} />
                                  )}
                                </div>
                                <div className="flex-1 pb-2">
                                  <div className="rounded-xl px-3 py-2.5 text-sm text-[#374151] leading-relaxed"
                                    style={{ background: "#f8fafc", border: "1px solid #eef2f8" }}>
                                    {step}
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="flex items-center gap-2 text-sm text-[#9ca3af] italic px-2">
                                <Info className="w-4 h-4 flex-shrink-0" />No steps defined.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expected Results */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center"
                              style={{ background: "#f0fdf4" }}>
                              <CheckCircle2 className="w-3 h-3 text-[#15803d]" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-[#5a7ca0]">
                              Expected Result
                            </span>
                          </div>

                          <div className="space-y-2">
                            {(() => {
                              const results = activeTC.expected_results?.length
                                ? activeTC.expected_results
                                : activeTC.expected_result ? [activeTC.expected_result] : [];
                              return results.length ? results.map((r, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: "#f0fdf4", border: "1.5px solid #bbf7d0" }}>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-[#15803d]" />
                                  </div>
                                  <div className="flex-1 rounded-xl px-3 py-2.5 text-sm text-[#374151] leading-relaxed"
                                    style={{ background: "#f8fafc", border: "1px solid #eef2f8" }}>
                                    {r}
                                  </div>
                                </div>
                              )) : (
                                <div className="flex items-center gap-2 text-sm text-[#9ca3af] italic px-2">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-[#fde68a]" />
                                  No expected results defined.
                                </div>
                              );
                            })()}
                          </div>

                          {/* description if exists */}
                          {activeTC.description && (
                            <div className="mt-4">
                              <div className="text-[11px] font-bold uppercase tracking-widest text-[#5a7ca0] mb-2">
                                Description
                              </div>
                              <div className="rounded-xl px-4 py-3 text-sm text-[#374151] leading-relaxed"
                                style={{ background: "#f8fafc", border: "1px solid #eef2f8" }}>
                                {activeTC.description}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ═══════ STORY CONTENT SHEET ═══════ */}
      <Sheet open={showStorySheet} onOpenChange={setShowStorySheet}>
        <SheetContent side="right" className="w-[440px] p-0 flex flex-col gap-0">
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F162B" }}>
            <SheetHeader>
              <SheetTitle className="text-white text-base font-bold">Story Content</SheetTitle>
              <SheetDescription style={{ color: "#A2D2E9" }}>ID: {storyId}</SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: "#F6F8FB" }}>
            {storyDescription && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#5a7ca0] mb-2">AI Description</div>
                <div className="rounded-xl p-4 bg-white border border-[#dde6f0]">
                  <p className="text-sm text-[#374151] leading-relaxed">{storyDescription}</p>
                </div>
              </div>
            )}
            {storyContent && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#5a7ca0] mb-2">Full Content</div>
                <div className="rounded-xl p-4 bg-white border border-[#dde6f0]">
                  <p className="text-sm text-[#374151] whitespace-pre-wrap leading-relaxed">{storyContent}</p>
                </div>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Chatbot onSendMessage={handleSendMessage} chatMessages={chatMessages} isGenerating={isGenerating}
        selectedModel={selectedModel} onModelChange={m => setSelectedModel(m)} />

      <ExportScriptDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        storyId={storyId}
        testCases={testCases}
      />
    </SidebarProvider>
  );
}
