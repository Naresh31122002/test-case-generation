"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api, TestCase } from "@/lib/api";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Brain, FileText, CheckCircle2,
  Eye, LayoutDashboard, Clock, ChevronRight, Code2,
} from "lucide-react";
import { Chatbot } from "@/components/chatbot";
import { ExportScriptDialog } from "@/components/export-script-dialog";

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

  /* dialogs */
  const [selectedTC, setSelectedTC] = useState<TestCase | null>(null);
  const [showTCDialog, setShowTCDialog] = useState(false);
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
        setTestCases(Array.isArray(raw) ? raw : []);
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
          // backend unreachable — fall back to mock
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
    if (p === "high") return { bg: "#fff1f2", color: "#be123c", border: "#fecdd3" };
    if (p === "medium") return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" };
    return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" };
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top bar */}
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

        <div className="p-6 space-y-5" style={{ background: "#F6F8FB", minHeight: "calc(100vh - 56px)" }}>

          {/* Story header card */}
          <div className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm overflow-hidden">
            <div className="px-6 py-5" style={{ background: "#0F162B" }}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(55,122,207,0.2)", color: "#A2D2E9" }}>
                      <CheckCircle2 className="w-3.5 h-3.5" />{testCases.length} Test Cases
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(162,210,233,0.15)", color: "#A2D2E9" }}>
                      <Brain className="w-3.5 h-3.5" />AI Generated
                    </span>
                    {storyProject && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(162,210,233,0.15)", color: "#A2D2E9" }}>
                        <FileText className="w-3.5 h-3.5" />{storyProject}
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold text-white">Story {storyId}</h1>
                  {storyDescription && <p className="text-sm mt-1 leading-relaxed" style={{ color: "#A2D2E9" }}>{storyDescription}</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setShowStorySheet(true)}
                    className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-80"
                    style={{ background: "rgba(162,210,233,0.15)", color: "#A2D2E9", border: "1px solid rgba(162,210,233,0.25)" }}>
                    <Eye className="w-3.5 h-3.5" />View Story
                  </button>
                  <button
                    onClick={() => setShowExportDialog(true)}
                    disabled={testCases.length === 0}
                    className="h-8 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-95 disabled:opacity-40"
                    style={{ background: "#A2D2E9", color: "#0F162B" }}>
                    <Code2 className="w-3.5 h-3.5" />Export Script
                  </button>
                  <button onClick={handleDownload}
                    className="h-8 px-3 rounded-xl text-xs font-semibold text-white flex items-center gap-1.5 transition-all hover:opacity-90"
                    style={{ background: "#377ACF" }}>
                    <Download className="w-3.5 h-3.5" />Download
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Test cases list */}
          <div className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#eef2f8] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#377ACF]" />
              <span className="font-semibold text-sm text-[#0F162B]">Test Cases</span>
              {!loading && <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f0f6ff] text-[#377ACF]">{testCases.length}</span>}
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center gap-3 text-sm font-semibold text-[#377ACF]">
                  <div className="w-5 h-5 border-2 border-[#377ACF] border-t-transparent rounded-full animate-spin" />Loading…
                </div>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-sm font-semibold text-red-600">{error}</div>
            ) : testCases.length === 0 ? (
              <div className="py-12 text-center text-sm text-[#9ca3af]">No test cases found for this story.</div>
            ) : (
              <div className="divide-y divide-[#eef2f8]">
                {testCases.map((tc, idx) => {
                  const ps = priorityStyle(tc.priority);
                  return (
                    <div key={tc.test_case_id || tc.id || idx}
                      onClick={() => { setSelectedTC(tc); setShowTCDialog(true); }}
                      className="flex items-center gap-4 px-5 py-3.5 cursor-pointer group hover:bg-[#f0f6ff] transition-colors">
                      {/* number */}
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                        style={{ background: "#f0f6ff", color: "#377ACF" }}>
                        {idx + 1}
                      </div>
                      {/* title */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#1a2540] truncate">{tc.title}</div>
                        <div className="text-xs text-[#9ca3af] font-mono mt-0.5">{tc.test_case_id || tc.id || "—"}</div>
                      </div>
                      {/* priority */}
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0"
                        style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                        {tc.priority || "low"}
                      </span>
                      {/* steps count */}
                      {tc.steps?.length ? (
                        <span className="text-xs text-[#9ca3af] flex-shrink-0">{tc.steps.length} steps</span>
                      ) : null}
                      {/* eye icon */}
                      <Eye className="w-4 h-4 text-[#c8d8eb] group-hover:text-[#377ACF] transition-colors flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ═══════ TEST CASE DETAILS DIALOG ═══════ */}
      <Dialog open={showTCDialog} onOpenChange={setShowTCDialog}>
        <DialogContent className="max-w-2xl rounded-2xl border-0 p-0 overflow-hidden" style={{ boxShadow: "0 24px 64px rgba(15,22,43,0.22)" }}>
          {/* header */}
          <div className="px-6 py-5" style={{ background: "#0F162B" }}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(162,210,233,0.18)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "#A2D2E9" }} />
                </div>
                {selectedTC?.title}
              </DialogTitle>
              <DialogDescription className="text-sm font-mono mt-0.5" style={{ color: "#A2D2E9" }}>
                {selectedTC?.test_case_id || selectedTC?.id || "—"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedTC && (
            <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto" style={{ background: "#F6F8FB" }}>
              {/* Priority + AI badge */}
              <div className="flex items-center gap-3">
                {(() => { const ps = priorityStyle(selectedTC.priority); return (
                  <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                    {selectedTC.priority || "low"} priority
                  </span>
                ); })()}
                <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(55,122,207,0.1)", color: "#377ACF" }}>
                  <Brain className="w-3 h-3" />AI Generated
                </span>
              </div>

              <div className="grid grid-cols-2 gap-5">
                {/* Steps */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#5a7ca0] mb-2">Test Steps</div>
                  <div className="space-y-2">
                    {selectedTC.steps?.length ? selectedTC.steps.map((step, i) => (
                      <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#dde6f0]">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "#377ACF" }}>
                          {i + 1}
                        </div>
                        <p className="text-sm text-[#374151]">{step}</p>
                      </div>
                    )) : <p className="text-sm text-[#9ca3af] italic">No steps defined.</p>}
                  </div>
                </div>

                {/* Expected results */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#5a7ca0] mb-2">Expected Results</div>
                  <div className="space-y-2">
                    {(selectedTC.expected_results?.length
                      ? selectedTC.expected_results
                      : selectedTC.expected_result ? [selectedTC.expected_result] : []
                    ).map((r, i) => (
                      <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#dde6f0]">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "#15803d" }}>
                          {i + 1}
                        </div>
                        <p className="text-sm text-[#374151]">{r}</p>
                      </div>
                    ))}
                    {!selectedTC.expected_results?.length && !selectedTC.expected_result && (
                      <p className="text-sm text-[#9ca3af] italic">No expected results defined.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
