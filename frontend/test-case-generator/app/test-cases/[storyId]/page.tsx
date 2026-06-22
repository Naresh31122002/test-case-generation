"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { api, TestCase } from "@/lib/api";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Download, Brain, FileText, CheckCircle2,
  Eye, ChevronRight, Code2, ListChecks, AlertTriangle,
  Info, Play, BookOpen, Zap, X,
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

const priorityStyle = (p?: string) => {
  if (p === "high")   return { bg: "#FEF2F2", color: "#EF4444", border: "#FCA5A5", dot: "#EF4444", label: "High" };
  if (p === "medium") return { bg: "#FFFBEB", color: "#F59E0B", border: "#FDE68A", dot: "#F59E0B", label: "Medium" };
  return                     { bg: "#ECFDF5", color: "#10B981", border: "#A7F3D0", dot: "#10B981", label: "Low" };
};

export default function StoryTestCasesPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const storyId = typeof params?.storyId === "string" ? params.storyId : Array.isArray(params?.storyId) ? params.storyId[0] : "";

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [storyDescription, setStoryDescription] = useState<string | null>(null);
  const [storyContent, setStoryContent] = useState<string | null>(null);
  const [storyProject, setStoryProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [runMode, setRunMode] = useState(false);
  const [showStorySheet, setShowStorySheet] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{
    role: "assistant",
    content: "Hello! I can help you analyze the test cases for this story. What would you like to know?",
  }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "rag">("rag");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

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
          const sr = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/${storyId}`);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/testcases/download/${storyId}`);
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

  const filteredTCs = testCases.filter(tc => {
    const matchesPriority = filterPriority === "all" || tc.priority === filterPriority;
    const matchesSearch = !searchQuery || tc.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  const activeTC = filteredTCs[activeIdx] ?? null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>

        {/* ── Top bar ──────────────────────────────────────── */}
        <header className="flex items-center justify-between h-14 px-5 border-b border-border bg-card sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="h-5" />
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />Back
            </button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-1.5 text-sm">
              <BookOpen className="w-4 h-4 text-muted-foreground" />
              <button onClick={() => router.push("/")} className="text-muted-foreground hover:text-foreground transition-colors">Stories</button>
              <ChevronRight className="w-3.5 h-3.5 text-border" />
              <span className="font-semibold text-foreground">{storyId}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowStorySheet(true)}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />View Story
            </button>
            <button
              onClick={() => setRunMode(true)} disabled={testCases.length === 0}
              className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40 border border-border bg-white text-foreground">
              <Play className="w-3.5 h-3.5" />Run Tests
            </button>
            <button onClick={() => setShowExportDialog(true)} disabled={testCases.length === 0}
              className="h-8 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40 border border-border bg-white text-foreground">
              <Code2 className="w-3.5 h-3.5" />Export Script
            </button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={handleDownload}
              className="h-8 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 hover:opacity-90 transition-opacity"
              style={{ background: "#06B6D4" }}>
              <Download className="w-3.5 h-3.5" />Download
            </motion.button>
          </div>
        </header>

        {/* ── Page body ────────────────────────────────────── */}
        <div className="flex flex-col" style={{ background: "#F8FAFC", minHeight: "calc(100vh - 56px)" }}>

          {/* Story header strip */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-6 mt-6 rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: "#0F172A" }}
          >
            <div className="px-6 py-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                    style={{ background: "rgba(6,182,212,0.2)", color: "#06B6D4" }}>
                    <CheckCircle2 className="w-3 h-3" />{testCases.length} Test Cases
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                    style={{ background: "rgba(79,70,229,0.2)", color: "#818CF8" }}>
                    <Brain className="w-3 h-3" />AI Generated
                  </span>
                  {storyProject && (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ background: "rgba(255,255,255,0.08)", color: "#CBD5E1" }}>
                      {storyProject}
                    </span>
                  )}
                </div>
                <h1 className="text-base font-bold text-white">Story {storyId}</h1>
                {storyDescription && (
                  <p className="text-xs mt-0.5 leading-relaxed line-clamp-1 text-slate-400">{storyDescription}</p>
                )}
              </div>
            </div>
          </motion.div>

          {/* ── Split pane ───────────────────────────────────── */}
          <div className="flex-1 flex gap-0 mx-6 mt-4 mb-6 rounded-xl overflow-hidden border border-border shadow-sm bg-white min-h-0">

            {runMode ? (
              <RunMode storyId={storyId} testCases={testCases} onExit={() => setRunMode(false)} />
            ) : loading ? (
              <div className="flex-1 flex items-center justify-center py-16">
                <div className="inline-flex items-center gap-3 text-sm font-semibold text-cyan">
                  <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                  Loading test cases…
                </div>
              </div>
            ) : error ? (
              <div className="flex-1 flex items-center justify-center py-16 text-sm font-semibold text-destructive">{error}</div>
            ) : testCases.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: "#ECFEFF" }}>
                  <ListChecks className="w-6 h-6 text-cyan" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No tests generated.</p>
                <p className="text-sm text-muted-foreground">Generate tests from this story.</p>
              </div>
            ) : (
              <>
                {/* ── LEFT: test list ──────────────────────── */}
                <div className="w-72 flex-shrink-0 flex flex-col border-r border-border overflow-hidden">
                  {/* search + filters */}
                  <div className="px-3 py-3 border-b border-border flex-shrink-0 space-y-2" style={{ background: "#F8FAFC" }}>
                    <div className="flex items-center gap-2 h-8 px-3 rounded-lg bg-white border border-border">
                      <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
                      <input
                        className="flex-1 text-xs bg-transparent outline-none placeholder:text-muted-foreground"
                        placeholder="Search test cases…"
                        value={searchQuery}
                        onChange={e => { setSearchQuery(e.target.value); setActiveIdx(0) }}
                      />
                      {searchQuery && (
                        <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-wrap">
                      {["all", "high", "medium", "low"].map(p => (
                        <button key={p} onClick={() => { setFilterPriority(p); setActiveIdx(0) }}
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all capitalize"
                          style={filterPriority === p
                            ? { background: "#0F172A", color: "#fff" }
                            : { background: "#F8FAFC", color: "#64748B", border: "1px solid #E2E8F0" }}>
                          {p === "all" ? "All" : p}
                        </button>
                      ))}
                      <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto font-semibold" style={{ background: "#ECFEFF", color: "#06B6D4" }}>
                        {filteredTCs.length}
                      </span>
                    </div>
                  </div>

                  {/* list rows */}
                  <div className="flex-1 overflow-y-auto">
                    <AnimatePresence>
                      {filteredTCs.map((tc, idx) => {
                        const ps = priorityStyle(tc.priority);
                        const isActive = activeIdx === idx;
                        return (
                          <motion.button
                            key={tc.test_case_id || tc.id || idx}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            onClick={() => setActiveIdx(idx)}
                            className="w-full text-left flex items-center gap-3 px-4 py-3 transition-all relative border-b border-border"
                            style={{ background: isActive ? "#ECFEFF" : "transparent" }}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r" style={{ background: "#06B6D4" }} />
                            )}
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors"
                              style={{
                                background: isActive ? "#06B6D4" : "#F8FAFC",
                                color: isActive ? "#fff" : "#64748B",
                                border: isActive ? "1px solid #06B6D4" : "1px solid #E2E8F0",
                              }}>
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate leading-tight" style={{ color: isActive ? "#0F172A" : "#374151" }}>
                                {tc.title}
                              </div>
                              <div className="text-[10px] font-mono mt-0.5 truncate text-muted-foreground">
                                {tc.test_case_id || tc.id || "—"}
                              </div>
                            </div>
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: ps.dot }} />
                          </motion.button>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* priority legend */}
                  <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0 border-t border-border" style={{ background: "#F8FAFC" }}>
                    {[["high","#EF4444"],["medium","#F59E0B"],["low","#10B981"]].map(([l, c]) => (
                      <div key={l} className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
                        <span className="text-[10px] capitalize text-muted-foreground">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── RIGHT: detail panel ──────────────────── */}
                {activeTC && (
                  <motion.div
                    key={activeIdx}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex-1 flex flex-col overflow-hidden min-w-0"
                  >
                    {/* detail header */}
                    <div className="px-6 py-4 flex-shrink-0 border-b border-border" style={{ background: "#F8FAFC" }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <h2 className="text-base font-bold text-foreground leading-tight">{activeTC.title}</h2>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[11px] font-mono text-muted-foreground">{activeTC.test_case_id || activeTC.id || "—"}</span>
                            {(() => {
                              const ps = priorityStyle(activeTC.priority);
                              return (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold"
                                  style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                                  {ps.label} priority
                                </span>
                              );
                            })()}
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold flex items-center gap-1"
                              style={{ background: "#EEF2FF", color: "#4F46E5" }}>
                              <Brain className="w-2.5 h-2.5" />AI
                            </span>
                          </div>
                        </div>
                        {/* prev / next */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => setActiveIdx(i => Math.max(0, i - 1))}
                            disabled={activeIdx === 0}
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-border transition-colors hover:bg-muted disabled:opacity-30 text-muted-foreground">
                            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                          </button>
                          <span className="text-xs text-muted-foreground px-1">{activeIdx + 1}/{filteredTCs.length}</span>
                          <button
                            onClick={() => setActiveIdx(i => Math.min(filteredTCs.length - 1, i + 1))}
                            disabled={activeIdx === filteredTCs.length - 1}
                            className="w-7 h-7 rounded-lg flex items-center justify-center border border-border transition-colors hover:bg-muted disabled:opacity-30 text-muted-foreground">
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
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: "#ECFEFF" }}>
                              <ListChecks className="w-3 h-3 text-cyan" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Test Steps</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: "#ECFEFF", color: "#06B6D4" }}>
                              {activeTC.steps?.length || 0}
                            </span>
                          </div>
                          <div className="space-y-2">
                            {activeTC.steps?.length ? activeTC.steps.map((step, i) => (
                              <div key={i} className="flex gap-3 items-start">
                                <div className="flex flex-col items-center flex-shrink-0">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white"
                                    style={{ background: "#06B6D4" }}>
                                    {i + 1}
                                  </div>
                                  {i < (activeTC.steps?.length ?? 0) - 1 && (
                                    <div className="w-px flex-1 mt-1" style={{ background: "#A5F3FC", minHeight: 12 }} />
                                  )}
                                </div>
                                <div className="flex-1 pb-2">
                                  <div className="rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed border border-border bg-white">
                                    {step}
                                  </div>
                                </div>
                              </div>
                            )) : (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground italic px-2">
                                <Info className="w-4 h-4 flex-shrink-0" />No steps defined.
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Expected Results */}
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-lg flex items-center justify-center" style={{ background: "#ECFDF5" }}>
                              <CheckCircle2 className="w-3 h-3 text-success" />
                            </div>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Expected Result</span>
                          </div>
                          <div className="space-y-2">
                            {(() => {
                              const results = activeTC.expected_results?.length
                                ? activeTC.expected_results
                                : activeTC.expected_result ? [activeTC.expected_result] : [];
                              return results.length ? results.map((r, i) => (
                                <div key={i} className="flex gap-3 items-start">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ background: "#ECFDF5", border: "1.5px solid #A7F3D0" }}>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                                  </div>
                                  <div className="flex-1 rounded-lg px-3 py-2.5 text-sm text-foreground leading-relaxed border border-border bg-white">
                                    {r}
                                  </div>
                                </div>
                              )) : (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground italic px-2">
                                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-warning" />No expected results defined.
                                </div>
                              );
                            })()}
                          </div>
                          {activeTC.description && (
                            <div className="mt-4">
                              <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Description</div>
                              <div className="rounded-lg px-4 py-3 text-sm text-foreground leading-relaxed border border-border bg-white">
                                {activeTC.description}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ═══════ STORY CONTENT SHEET ═══════ */}
      <Sheet open={showStorySheet} onOpenChange={setShowStorySheet}>
        <SheetContent side="right" className="w-[440px] p-0 flex flex-col gap-0">
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F172A" }}>
            <SheetHeader>
              <SheetTitle className="text-white text-base font-bold">Story Content</SheetTitle>
              <SheetDescription style={{ color: "#64748B" }}>ID: {storyId}</SheetDescription>
            </SheetHeader>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
            {storyDescription && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">AI Description</div>
                <div className="rounded-xl p-4 bg-white border border-border">
                  <p className="text-sm text-foreground leading-relaxed">{storyDescription}</p>
                </div>
              </div>
            )}
            {storyContent && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Full Content</div>
                <div className="rounded-xl p-4 bg-white border border-border">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{storyContent}</p>
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
