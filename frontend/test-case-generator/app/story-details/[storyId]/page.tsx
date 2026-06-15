"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Brain, FileText, Eye, AlertCircle,
  LayoutDashboard, Clock, ChevronRight, ShieldCheck, Code2, Download,
} from "lucide-react";
import { Chatbot } from "@/components/chatbot";
import { Btn } from "@/components/ui/btn";
import { Toggle } from "@/components/ui/toggle-switch";
import { ExportScriptDialog } from "@/components/export-script-dialog";
import { api, TestCase } from "@/lib/api";

function EmptyImpactState({ highOnly }: { highOnly: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4"
        style={{ background: "#E1F5F8" }}>
        <ShieldCheck className="w-7 h-7" style={{ color: "#1A9FB5" }} />
      </div>
      <h3 className="text-sm" style={{ color: "#0D1B2A", fontWeight: 500 }}>No impacted test cases</h3>
      <p className="text-sm mt-1 max-w-xs" style={{ color: "#5F5E5A" }}>
        {highOnly
          ? "No high-severity modifications were found for this story."
          : "This story did not modify any existing test cases."}
      </p>
    </div>
  );
}

interface ImpactedTestCase {
  id: string;
  modified_title: string;
  modified_test_case_id: string;
  severity: "high" | "medium" | "low";
  priority: "high" | "medium" | "low";
  original_priority: string;
  impacts: any[];
  original_story_id: string;
  original_title: string;
  original_steps?: string[];
  original_expected_result?: string;
}

function cleanAndParseLLMResponse(response: string) {
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  cleaned = cleaned.trim();
  try { return { parsed: JSON.parse(cleaned), cleaned }; }
  catch { return { parsed: null, cleaned }; }
}
function formatRagTestCases(tc: any[]) {
  return tc.map((t, i) => {
    const steps = Array.isArray(t.steps) ? t.steps.join("\n") : t.steps;
    return `Test Case ${i + 1}: ${t.title}\nSteps:\n${steps}\nExpected Result: ${t.expected_result}\n`;
  }).join("\n\n");
}

export default function StoryImpactAnalysisPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("project_id");
  const storyId = typeof params?.storyId === "string" ? params.storyId : Array.isArray(params?.storyId) ? params.storyId[0] : "";

  const [impacted, setImpacted] = useState<ImpactedTestCase[]>([]);
  const [storyDescription, setStoryDescription] = useState<string | null>(null);
  const [storyContent, setStoryContent] = useState<string | null>(null);
  const [storyProject, setStoryProject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingOriginal, setLoadingOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState("");
  const [selectedTC, setSelectedTC] = useState<ImpactedTestCase | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showStorySheet, setShowStorySheet] = useState(false);
  const [summary, setSummary] = useState({ total: 0, impacted: 0, pct: 0, high: 0, medium: 0, low: 0 });
  const [highOnly, setHighOnly] = useState(false);

  /* export script — lazy-loaded story test cases */
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportTestCases, setExportTestCases] = useState<TestCase[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  const openExport = async () => {
    setExportLoading(true);
    setShowExportDialog(true);
    try {
      const res = await api.getTestCases(storyId);
      const raw = (res as any)?.testcases;
      setExportTestCases(Array.isArray(raw) ? raw : []);
    } catch { setExportTestCases([]); }
    finally { setExportLoading(false); }
  };

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

  const highToggleDisabled = impacted.length === 0;
  const visibleImpacted = highOnly && !highToggleDisabled
    ? impacted.filter(tc => (tc.impacts[0]?.impact_severity || tc.severity) === "high")
    : impacted;

  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{
    role: "assistant",
    content: "Hello! I can help you understand this impact analysis. What would you like to know?",
  }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "rag">("rag");

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
    setCurrentTime(new Date().toLocaleTimeString());
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!storyId || !projectId) return;
    (async () => {
      try {
        setLoading(true);
        let data: any;
        try {
          const res = await fetch(`http://127.0.0.1:5000/api/stories/impacts/story-test-cases/${storyId}?project_id=${projectId}`);
          if (!res.ok) throw new Error("Failed to fetch impact analysis");
          data = await res.json();
        } catch {
          // backend unreachable — use mock
          const { MOCK_IMPACT_MAP, MOCK_STORY_MAP } = await import("@/lib/mock-stories");
          data = MOCK_IMPACT_MAP[storyId] || { total_test_cases: "0", impacted_test_cases_count: "0", impact_percentage: "0", severity_summary: { high: "0", medium: "0", low: "0" }, impacted_test_cases: [] };
          const ms = MOCK_STORY_MAP[storyId];
          if (ms) { setStoryDescription(ms.description); setStoryContent(ms.doc_content_text); setStoryProject(ms.project_id); }
        }

        const transformed: ImpactedTestCase[] = data.impacted_test_cases
          .filter((tc: any) => tc.impacts?.length > 0)
          .map((tc: any) => ({
            id: tc.test_case_id,
            original_title: tc.original_title || "",
            modified_title: tc.impacts[0]?.impact_analysis_json
              ? JSON.parse(tc.impacts[0].impact_analysis_json)?.modified_test_case?.title || `Modified ${tc.original_title}`
              : `Modified ${tc.original_title}`,
            modified_test_case_id: `${tc.test_case_id}-MOD-${tc.impacts.length}`,
            severity: tc.impacts[0]?.impact_severity || "low",
            priority: tc.impacts[0]?.impact_priority || "low",
            original_priority: tc.impacts[0]?.impact_analysis_json
              ? JSON.parse(tc.impacts[0].impact_analysis_json)?.modified_test_case?.priority || "Medium"
              : "Medium",
            impacts: tc.impacts,
            original_story_id: storyId,
            original_steps: [],
            original_expected_result: "",
          }));

        setImpacted(transformed);
        setSummary({
          total: parseInt(data.total_test_cases),
          impacted: parseInt(data.impacted_test_cases_count),
          pct: parseFloat(data.impact_percentage),
          high: parseInt(data.severity_summary.high),
          medium: parseInt(data.severity_summary.medium),
          low: parseInt(data.severity_summary.low),
        });

        // Only fetch story from backend if not already set by mock above
        if (!storyDescription) {
          try {
            const sr = await fetch(`http://127.0.0.1:5000/api/stories/${storyId}`);
            if (sr.ok) {
              const sd = await sr.json();
              setStoryDescription(sd.description);
              setStoryContent(sd.document_content);
              setStoryProject(sd.project_id);
            }
          } catch {}
        }
      } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
      finally { setLoading(false); }
    })();
  }, [storyId, projectId]);

  useEffect(() => {
    if (!showOriginal || !selectedTC?.id) return;
    (async () => {
      try {
        setLoadingOriginal(true);
        const res = await fetch(`http://127.0.0.1:5000/api/stories/${storyId}/test-cases/${selectedTC.id}`)
          .catch(() => null);
        if (!res || !res.ok) throw new Error();
        const d = await res.json();
        setSelectedTC(p => p ? { ...p, original_steps: d.test_steps || d.steps || [], original_expected_result: d.expected_result || "", original_title: d.title || d.test_title || p.original_title } : null);
      } catch {} finally { setLoadingOriginal(false); }
    })();
  }, [showOriginal]);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isGenerating) return;
    setChatMessages(p => [...p, { role: "user", content: message }]);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate-test-cases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context: "Impact analysis support", model: selectedModel, storyId }),
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

  const sevStyle = (s?: string) => {
    if (s === "high") return { bg: "#fff1f2", color: "#be123c", border: "#fecdd3", bar: "#be123c" };
    if (s === "medium") return { bg: "#fffbeb", color: "#b45309", border: "#fde68a", bar: "#b45309" };
    return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0", bar: "#15803d" };
  };
  const priStyle = (p?: string) => {
    if (p === "high") return { bg: "#fdf4ff", color: "#7e22ce", border: "#e9d5ff" };
    if (p === "medium") return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
    return { bg: "#f9fafb", color: "#374151", border: "#e5e7eb" };
  };

  const parsedModified = (tc: ImpactedTestCase | null) => {
    if (!tc?.impacts[0]?.impact_analysis_json) return null;
    try { return JSON.parse(tc.impacts[0].impact_analysis_json); } catch { return null; }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex items-center justify-between h-14 px-5 border-b border-[#eef2f8] sticky top-0 z-50" style={{ background: "rgba(255,255,255,0.85)", backdropFilter: "blur(8px)" }}>
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[#5a7ca0] hover:text-[#0F162B]" />
            <Separator orientation="vertical" className="h-5" />
            <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-[#5a7ca0] hover:text-[#0F162B] transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-1.5 text-sm">
              <button onClick={() => router.push("/")} className="flex items-center gap-1.5 text-[#1A9FB5] hover:text-[#178fa3] cursor-pointer hover:underline transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                <span>Dashboard</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-[#b0c4d8]" />
              <span className="font-semibold text-[#0F162B]">Impact Analysis</span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#0F162B]">
            <Clock className="w-4 h-4 text-[#1A9FB5]" />
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
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(162,210,233,0.15)", color: "#A2D2E9" }}>
                      <Brain className="w-3.5 h-3.5" />{impacted.length} Modified Test Cases
                    </span>
                    {storyProject && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(162,210,233,0.15)", color: "#A2D2E9" }}>
                        <FileText className="w-3.5 h-3.5" />{storyProject}
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold text-white">Impact Analysis — Story {storyId}</h1>
                  {storyDescription && (
                    <p className="text-sm mt-1 leading-relaxed" style={{ color: "#A2D2E9" }}>{storyDescription}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Btn variant="dark-ghost" onClick={() => router.push(`/test-cases/${storyId}`)}>
                    <FileText className="w-3.5 h-3.5" />View Test Cases
                  </Btn>
                  <Btn variant="dark-ghost" onClick={() => setShowStorySheet(true)}>
                    <Eye className="w-3.5 h-3.5" />View Story
                  </Btn>
                  <Btn variant="dark-ghost" onClick={openExport}>
                    <Code2 className="w-3.5 h-3.5" />Export Script
                  </Btn>
                  <Btn variant="dark-ghost" onClick={handleDownload}>
                    <Download className="w-3.5 h-3.5" />Download
                  </Btn>
                </div>
              </div>
            </div>
          </div>

          {/* Stat cards */}
          {!loading && !error && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Total Test Cases", value: summary.total, color: "#1a2540" },
                { label: "Modified", value: summary.impacted, color: "#0F7A8A" },
                { label: "Modification %", value: `${summary.pct}%`, color: "#1A9FB5" },
                {
                  label: "Severity Breakdown",
                  custom: (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {[["H", summary.high, "high"], ["M", summary.medium, "medium"], ["L", summary.low, "low"]].map(([l, v, s]) => {
                        // H stays red (danger), L stays green (safe); M becomes neutral teal (not amber)
                        const st = s === "medium"
                          ? { bg: "#E1F5F8", color: "#0F7A8A", border: "#1A9FB5" }
                          : sevStyle(s as string);
                        return <span key={l as string} className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{l}: {v}</span>;
                      })}
                    </div>
                  ),
                },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[#5a7ca0] mb-1">{s.label}</div>
                  {s.custom ? s.custom : <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Impact cards list */}
          <div className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#eef2f8] flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#1A9FB5]" />
              <span className="font-semibold text-sm text-[#0F162B]">Modified Test Cases</span>
              {!loading && <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#E1F5F8] text-[#1A9FB5]">{visibleImpacted.length}</span>}
              {/* High-severity-only unified toggle */}
              <span className="ml-auto">
                <Toggle
                  checked={highOnly}
                  onChange={() => setHighOnly(p => !p)}
                  disabled={highToggleDisabled}
                  label="High severity only"
                />
              </span>
            </div>

            {loading ? (
              <div className="py-16 text-center">
                <div className="inline-flex items-center gap-3 text-sm font-semibold text-[#1A9FB5]">
                  <div className="w-5 h-5 border-2 border-[#1A9FB5] border-t-transparent rounded-full animate-spin" />Loading…
                </div>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-sm font-semibold text-red-600">{error}</div>
            ) : visibleImpacted.length === 0 ? (
              <EmptyImpactState highOnly={highOnly} />
            ) : (
              <div className="divide-y divide-[#eef2f8]">
                {visibleImpacted.map((tc, idx) => {
                  const sev = sevStyle(tc.impacts[0]?.impact_severity);
                  const pri = priStyle(tc.impacts[0]?.impact_priority);
                  return (
                    <div key={tc.id || idx}
                      onClick={() => { setSelectedTC(tc); setShowOriginal(false); setShowDetail(true); }}
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer group hover:bg-[#E1F5F8] transition-colors">
                      {/* severity bar + number */}
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: sev.bar }} />
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: sev.bg, color: sev.color }}>
                          {idx + 1}
                        </div>
                      </div>
                      {/* title + id */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-[#1a2540] truncate">{tc.modified_title}</div>
                        <div className="text-xs text-[#9ca3af] font-mono mt-0.5">{`${tc.id}-MOD-${tc.impacts.length}`}</div>
                      </div>
                      {/* badges */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                          {tc.impacts[0]?.impact_severity || "low"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: pri.bg, color: pri.color, border: `1px solid ${pri.border}` }}>
                          {tc.impacts[0]?.impact_priority || "low"}
                        </span>
                      </div>
                      <Eye className="w-4 h-4 text-[#c8d8eb] group-hover:text-[#1A9FB5] transition-colors flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ═══════ IMPACT DETAIL DIALOG ═══════ */}
      <Dialog open={showDetail} onOpenChange={v => { setShowDetail(v); if (!v) setShowOriginal(false); }}>
        <DialogContent className="max-w-3xl rounded-2xl border-0 p-0 overflow-hidden max-h-[90vh] flex flex-col" style={{ boxShadow: "0 24px 64px rgba(15,22,43,0.22)" }}>
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F162B" }}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(162,210,233,0.18)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "#A2D2E9" }} />
                </div>
                Test Case Details
              </DialogTitle>
              <DialogDescription className="text-sm font-mono mt-0.5" style={{ color: "#A2D2E9" }}>
                Original: {selectedTC?.id} · Modified: {selectedTC ? `${selectedTC.id}-MOD-${selectedTC.impacts.length}` : "—"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedTC && (() => {
            const mod = parsedModified(selectedTC);
            const sev = sevStyle(selectedTC.impacts[0]?.impact_severity);
            const pri = priStyle(selectedTC.impacts[0]?.impact_priority);
            return (
              <div className="overflow-y-auto flex-1 p-6 space-y-5" style={{ background: "#F6F8FB" }}>
                {/* Modified title */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#377ACF] mb-2">Modified Title</div>
                  <div className="rounded-xl p-4 bg-[#eff6ff] border border-[#bfdbfe]">
                    <p className="text-sm text-[#1e40af] font-medium">{selectedTC.modified_title}</p>
                  </div>
                </div>

                {/* Impact reason */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#b45309] mb-2">Impact Reason</div>
                  <div className="rounded-xl p-4 bg-[#fffbeb] border border-[#fde68a]">
                    <p className="text-sm text-[#78350f]">{mod?.modification_reason || "No reason provided."}</p>
                  </div>
                </div>

                {/* Modified steps + expected */}
                <div className="rounded-xl p-4 border border-[#bbf7d0] space-y-4" style={{ background: "#f0fdf4" }}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#15803d]" />
                    <span className="text-sm font-bold text-[#15803d]">Modified Test Case</span>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#15803d] mb-2">Steps</div>
                    <div className="space-y-2">
                      {mod?.modified_test_case?.steps?.map((s: string, i: number) => (
                        <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#d1fae5]">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "#16a34a" }}>{i + 1}</div>
                          <p className="text-sm text-[#374151]">{s}</p>
                        </div>
                      )) || <p className="text-sm text-[#9ca3af] italic">No steps.</p>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#15803d] mb-2">Expected Result</div>
                    <div className="rounded-xl p-4 bg-white border border-[#d1fae5]">
                      <p className="text-sm text-[#374151]">{mod?.modified_test_case?.expected_result || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* References + priority grid */}
                <div className="rounded-xl p-4 border border-[#dde6f0] space-y-4" style={{ background: "#fafafa" }}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#5a7ca0]" />
                    <span className="text-sm font-bold text-[#5a7ca0]">References</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#7e22ce] mb-1">Original Story</div>
                        <div className="rounded-xl px-3 py-2 font-mono text-sm bg-[#fdf4ff] border border-[#e9d5ff] text-[#7e22ce]">{storyId}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#7e22ce] mb-1">Original TC ID</div>
                        <div className="rounded-xl px-3 py-2 font-mono text-sm bg-[#fdf4ff] border border-[#e9d5ff] text-[#7e22ce]">{selectedTC.id}</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#15803d] mb-1">New Story ID</div>
                        <div className="rounded-xl px-3 py-2 font-mono text-sm bg-[#f0fdf4] border border-[#bbf7d0] text-[#15803d]">
                          {selectedTC.impacts[0]?.impacting_story_id || "—"}
                        </div>
                      </div>
                      <button onClick={() => setShowOriginal(p => !p)}
                        className="w-full h-9 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80"
                        style={{ background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe" }}>
                        <Eye className="w-3.5 h-3.5" />{showOriginal ? "Hide Original" : "View Original"}
                      </button>
                    </div>
                  </div>

                  {/* Priority comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#7e22ce] mb-1">Original Priority</div>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-[#fdf4ff] border border-[#e9d5ff]">
                        <AlertCircle className="w-4 h-4 text-[#7e22ce]" />
                        <span className="text-sm font-medium text-[#7e22ce]">{selectedTC.original_priority}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-[#15803d] mb-1">Modified Priority</div>
                      <div className="flex items-center gap-2 rounded-xl px-3 py-2 bg-[#f0fdf4] border border-[#bbf7d0]">
                        <AlertCircle className="w-4 h-4 text-[#15803d]" />
                        <span className="text-sm font-medium text-[#15803d]">{mod?.modified_test_case?.priority || "Medium"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Original TC (expandable) */}
                {showOriginal && (
                  <div className="rounded-xl p-4 border border-[#bfdbfe] space-y-4" style={{ background: "#eff6ff" }}>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#1d4ed8]" />
                      <span className="text-sm font-bold text-[#1d4ed8]">Original Test Case</span>
                    </div>
                    {loadingOriginal ? (
                      <div className="text-sm text-center py-4 text-[#1d4ed8]">Loading…</div>
                    ) : (
                      <>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1d4ed8] mb-2">Title</div>
                          <div className="rounded-xl p-4 bg-white border border-[#bfdbfe]">
                            <p className="text-sm text-[#374151]">{selectedTC.original_title || "—"}</p>
                          </div>
                        </div>
                        {selectedTC.original_steps?.length ? (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1d4ed8] mb-2">Steps</div>
                            <div className="space-y-2">
                              {selectedTC.original_steps.map((s, i) => (
                                <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#bfdbfe]">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0" style={{ background: "#1d4ed8" }}>{i + 1}</div>
                                  <p className="text-sm text-[#374151]">{s}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1d4ed8] mb-2">Expected Result</div>
                          <div className="rounded-xl p-4 bg-white border border-[#bfdbfe]">
                            <p className="text-sm text-[#374151]">{selectedTC.original_expected_result || "—"}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Severity / Priority / Date bar */}
                <div className="flex items-center flex-wrap gap-4 px-4 py-3 rounded-xl bg-white border border-[#dde6f0] text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[#5a7ca0]">Severity:</span>
                    <span className="font-bold" style={{ color: sev.color }}>{selectedTC.impacts[0]?.impact_severity?.toUpperCase() || "LOW"}</span>
                  </div>
                  <div className="w-px h-4 bg-[#dde6f0]" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[#5a7ca0]">Priority:</span>
                    <span className="font-bold" style={{ color: pri.color }}>{selectedTC.impacts[0]?.impact_priority?.toUpperCase() || "LOW"}</span>
                  </div>
                  <div className="w-px h-4 bg-[#dde6f0]" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-[#5a7ca0]">Modified:</span>
                    <span className="text-[#7e22ce]">
                      {selectedTC.impacts[0]?.impact_created_on ? new Date(selectedTC.impacts[0].impact_created_on).toLocaleString() : "—"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
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
        testCases={exportTestCases}
      />
    </SidebarProvider>
  );
}
