"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Brain, FileText, Eye, AlertCircle,
  ChevronRight, ShieldCheck, Code2, Download, BookOpen,
} from "lucide-react";
import { Chatbot } from "@/components/chatbot";
import { Btn } from "@/components/ui/btn";
import { Toggle } from "@/components/ui/toggle-switch";
import { ExportScriptDialog } from "@/components/export-script-dialog";
import { api, TestCase } from "@/lib/api";

function EmptyImpactState({ highOnly }: { highOnly: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: "#ECFDF5" }}>
        <ShieldCheck className="w-7 h-7 text-success" />
      </div>
      <h3 className="text-sm font-medium text-foreground">No impacted test cases</h3>
      <p className="text-sm mt-1 max-w-xs text-muted-foreground">
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

const sevStyle = (s?: string) => {
  if (s === "high")   return { bg: "#FEF2F2", color: "#EF4444", border: "#FCA5A5", bar: "#EF4444" };
  if (s === "medium") return { bg: "#FFFBEB", color: "#F59E0B", border: "#FDE68A", bar: "#F59E0B" };
  return                     { bg: "#ECFDF5", color: "#10B981", border: "#A7F3D0", bar: "#10B981" };
};
const priStyle = (p?: string) => {
  if (p === "high")   return { bg: "#FEF2F2", color: "#EF4444", border: "#FCA5A5" };
  if (p === "medium") return { bg: "#FFFBEB", color: "#F59E0B", border: "#FDE68A" };
  return                     { bg: "#F0FDF4", color: "#10B981", border: "#A7F3D0" };
};

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
  const [selectedTC, setSelectedTC] = useState<ImpactedTestCase | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showStorySheet, setShowStorySheet] = useState(false);
  const [summary, setSummary] = useState({ total: 0, impacted: 0, pct: 0, high: 0, medium: 0, low: 0 });
  const [highOnly, setHighOnly] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [exportTestCases, setExportTestCases] = useState<TestCase[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{
    role: "assistant",
    content: "Hello! I can help you understand this impact analysis. What would you like to know?",
  }]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<"gemini" | "rag">("rag");

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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/testcases/download/${storyId}`);
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

  useEffect(() => {
    if (!storyId || !projectId) return;
    (async () => {
      try {
        setLoading(true);
        let data: any;
        try {
          const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/impacts/story-test-cases/${storyId}?project_id=${projectId}`);
          if (!res.ok) throw new Error("Failed");
          data = await res.json();
        } catch {
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

        if (!storyDescription) {
          try {
            const sr = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/${storyId}`);
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
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/${storyId}/test-cases/${selectedTC.id}`).catch(() => null);
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

  const parsedModified = (tc: ImpactedTestCase | null) => {
    if (!tc?.impacts[0]?.impact_analysis_json) return null;
    try { return JSON.parse(tc.impacts[0].impact_analysis_json); } catch { return null; }
  };

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        {/* Top bar */}
        <header
          className="flex items-center justify-between h-14 px-5 border-b border-border sticky top-0 z-50 bg-card"
        >
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
              <span className="font-semibold text-foreground">Impact Analysis</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => router.push(`/test-cases/${storyId}`)}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground">
              <FileText className="w-3.5 h-3.5" />View Test Cases
            </button>
            <button onClick={() => setShowStorySheet(true)}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground">
              <Eye className="w-3.5 h-3.5" />View Story
            </button>
            <button onClick={openExport}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground">
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

        <div className="p-6 space-y-5" style={{ background: "#F8FAFC", minHeight: "calc(100vh - 56px)" }}>

          {/* Story header */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden"
            style={{ background: "#0F172A" }}
          >
            <div className="px-6 py-5">
              <div className="flex items-start gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <span className="px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5" style={{ background: "rgba(6,182,212,0.2)", color: "#06B6D4" }}>
                      <Brain className="w-3.5 h-3.5" />{impacted.length} Modified Test Cases
                    </span>
                    {storyProject && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "rgba(255,255,255,0.08)", color: "#CBD5E1" }}>
                        {storyProject}
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg font-bold text-white">Impact Analysis — Story {storyId}</h1>
                  {storyDescription && (
                    <p className="text-sm mt-1 leading-relaxed text-slate-400">{storyDescription}</p>
                  )}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Stat cards */}
          {!loading && !error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="grid grid-cols-4 gap-4"
            >
              {[
                { label: "Total Test Cases",   value: summary.total,    color: "#0F172A", bg: "#F8FAFC", border: "#E2E8F0" },
                { label: "Modified",           value: summary.impacted, color: "#EF4444", bg: "#FEF2F2", border: "#FCA5A5" },
                { label: "Modification %",     value: `${summary.pct}%`, color: "#06B6D4", bg: "#ECFEFF", border: "#A5F3FC" },
                {
                  label: "Severity Breakdown",
                  value: null,
                  custom: (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      {[["H", summary.high, "high"], ["M", summary.medium, "medium"], ["L", summary.low, "low"]].map(([l, v, s]) => {
                        const st = sevStyle(s as string);
                        return <span key={l as string} className="px-2 py-0.5 rounded-full text-xs font-bold"
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{l}: {v}</span>;
                      })}
                    </div>
                  ),
                  color: "#0F172A", bg: "#FFFFFF", border: "#E2E8F0",
                },
              ].map((s, i) => (
                <div key={i} className="bg-white rounded-xl border px-5 py-4" style={{ borderColor: s.border, boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">{s.label}</div>
                  {s.custom ? s.custom : <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>}
                </div>
              ))}
            </motion.div>
          )}

          {/* Impact list */}
          <div className="bg-white rounded-xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
            <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan" />
              <span className="font-semibold text-sm text-foreground">Modified Test Cases</span>
              {!loading && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFEFF] text-cyan">{visibleImpacted.length}</span>
              )}
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
                <div className="inline-flex items-center gap-3 text-sm font-semibold text-cyan">
                  <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />Loading…
                </div>
              </div>
            ) : error ? (
              <div className="py-12 text-center text-sm font-semibold text-destructive">{error}</div>
            ) : visibleImpacted.length === 0 ? (
              <EmptyImpactState highOnly={highOnly} />
            ) : (
              <div className="divide-y divide-border">
                {visibleImpacted.map((tc, idx) => {
                  const sev = sevStyle(tc.impacts[0]?.impact_severity);
                  const pri = priStyle(tc.impacts[0]?.impact_priority);
                  return (
                    <motion.div
                      key={tc.id || idx}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => { setSelectedTC(tc); setShowOriginal(false); setShowDetail(true); }}
                      className="flex items-center gap-4 px-5 py-4 cursor-pointer group hover:bg-[#ECFEFF] transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ background: sev.bar }} />
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: sev.bg, color: sev.color }}>
                          {idx + 1}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{tc.modified_title}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">{`${tc.id}-MOD-${tc.impacts.length}`}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                          style={{ background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                          {tc.impacts[0]?.impact_severity || "low"}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize"
                          style={{ background: pri.bg, color: pri.color, border: `1px solid ${pri.border}` }}>
                          {tc.impacts[0]?.impact_priority || "low"}
                        </span>
                      </div>
                      <Eye className="w-4 h-4 text-border group-hover:text-cyan transition-colors flex-shrink-0" />
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ═══════ IMPACT DETAIL DIALOG ═══════ */}
      <Dialog open={showDetail} onOpenChange={v => { setShowDetail(v); if (!v) setShowOriginal(false); }}>
        <DialogContent className="max-w-3xl rounded-xl border-0 p-0 overflow-hidden max-h-[90vh] flex flex-col" style={{ boxShadow: "0 24px 64px rgba(15,23,42,0.2)" }}>
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F172A" }}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(6,182,212,0.2)" }}>
                  <FileText className="w-3.5 h-3.5 text-cyan" />
                </div>
                Test Case Details
              </DialogTitle>
              <DialogDescription className="text-sm font-mono mt-0.5 text-slate-500">
                Original: {selectedTC?.id} · Modified: {selectedTC ? `${selectedTC.id}-MOD-${selectedTC.impacts.length}` : "—"}
              </DialogDescription>
            </DialogHeader>
          </div>

          {selectedTC && (() => {
            const mod = parsedModified(selectedTC);
            const sev = sevStyle(selectedTC.impacts[0]?.impact_severity);
            const pri = priStyle(selectedTC.impacts[0]?.impact_priority);
            return (
              <div className="overflow-y-auto flex-1 p-6 space-y-5 bg-background">
                {/* Modified title */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-cyan mb-2">Modified Title</div>
                  <div className="rounded-xl p-4 bg-[#EFF6FF] border border-[#BFDBFE]">
                    <p className="text-sm text-[#1E40AF] font-medium">{selectedTC.modified_title}</p>
                  </div>
                </div>

                {/* Impact reason */}
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-warning mb-2">Impact Reason</div>
                  <div className="rounded-xl p-4 bg-[#FFFBEB] border border-[#FDE68A]">
                    <p className="text-sm text-[#78350F]">{mod?.modification_reason || "No reason provided."}</p>
                  </div>
                </div>

                {/* Modified steps + expected */}
                <div className="rounded-xl p-4 border border-[#A7F3D0] space-y-4" style={{ background: "#ECFDF5" }}>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-success" />
                    <span className="text-sm font-bold text-success">Modified Test Case</span>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-success mb-2">Steps</div>
                    <div className="space-y-2">
                      {mod?.modified_test_case?.steps?.map((s: string, i: number) => (
                        <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#D1FAE5]">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-success">{i + 1}</div>
                          <p className="text-sm text-foreground">{s}</p>
                        </div>
                      )) || <p className="text-sm text-muted-foreground italic">No steps.</p>}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-success mb-2">Expected Result</div>
                    <div className="rounded-xl p-4 bg-white border border-[#D1FAE5]">
                      <p className="text-sm text-foreground">{mod?.modified_test_case?.expected_result || "—"}</p>
                    </div>
                  </div>
                </div>

                {/* References */}
                <div className="rounded-xl p-4 border border-border space-y-4 bg-card">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-bold text-muted-foreground">References</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Original Story</div>
                        <div className="rounded-lg px-3 py-2 font-mono text-sm bg-muted border border-border text-foreground">{storyId}</div>
                      </div>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Original TC ID</div>
                        <div className="rounded-lg px-3 py-2 font-mono text-sm bg-muted border border-border text-foreground">{selectedTC.id}</div>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">New Story ID</div>
                        <div className="rounded-lg px-3 py-2 font-mono text-sm bg-muted border border-border text-foreground">
                          {selectedTC.impacts[0]?.impacting_story_id || "—"}
                        </div>
                      </div>
                      <button onClick={() => setShowOriginal(p => !p)}
                        className="w-full h-9 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-80 border border-border bg-white text-foreground">
                        <Eye className="w-3.5 h-3.5" />{showOriginal ? "Hide Original" : "View Original"}
                      </button>
                    </div>
                  </div>

                  {/* Priority comparison */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Original Priority</div>
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted border border-border">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{selectedTC.original_priority}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Modified Priority</div>
                      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-muted border border-border">
                        <AlertCircle className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">{mod?.modified_test_case?.priority || "Medium"}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Original TC */}
                {showOriginal && (
                  <div className="rounded-xl p-4 border border-[#BFDBFE] space-y-4 bg-[#EFF6FF]">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#1D4ED8]" />
                      <span className="text-sm font-bold text-[#1D4ED8]">Original Test Case</span>
                    </div>
                    {loadingOriginal ? (
                      <div className="text-sm text-center py-4 text-[#1D4ED8]">Loading…</div>
                    ) : (
                      <>
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8] mb-2">Title</div>
                          <div className="rounded-xl p-4 bg-white border border-[#BFDBFE]">
                            <p className="text-sm text-foreground">{selectedTC.original_title || "—"}</p>
                          </div>
                        </div>
                        {selectedTC.original_steps?.length ? (
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8] mb-2">Steps</div>
                            <div className="space-y-2">
                              {selectedTC.original_steps.map((s, i) => (
                                <div key={i} className="flex gap-3 px-3 py-2.5 rounded-xl bg-white border border-[#BFDBFE]">
                                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 bg-[#1D4ED8]">{i + 1}</div>
                                  <p className="text-sm text-foreground">{s}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div>
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#1D4ED8] mb-2">Expected Result</div>
                          <div className="rounded-xl p-4 bg-white border border-[#BFDBFE]">
                            <p className="text-sm text-foreground">{selectedTC.original_expected_result || "—"}</p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Severity / Priority bar */}
                <div className="flex items-center flex-wrap gap-4 px-4 py-3 rounded-xl bg-white border border-border text-sm">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-muted-foreground">Severity:</span>
                    <span className="font-bold capitalize" style={{ color: sev.color }}>{selectedTC.impacts[0]?.impact_severity || "low"}</span>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-muted-foreground">Priority:</span>
                    <span className="font-bold capitalize" style={{ color: pri.color }}>{selectedTC.impacts[0]?.impact_priority || "low"}</span>
                  </div>
                  <div className="w-px h-4 bg-border" />
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-muted-foreground">Modified:</span>
                    <span className="text-foreground">
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
        testCases={exportTestCases}
      />
    </SidebarProvider>
  );
}
