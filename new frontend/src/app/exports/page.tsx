"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Loader2, FileText, TestTube2, AlertCircle } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { useProject } from "@/contexts/ProjectContext";
import { api } from "@/lib/api";
import type { Story } from "@/lib/api";
import { PageLayout, PageHeader, PageActions } from "@/components/layout/PageLayout";

const FORMATS = [
  { id: "playwright", label: "Playwright",    description: "TypeScript E2E tests" },
  { id: "cypress",    label: "Cypress",       description: "JavaScript E2E tests" },
  { id: "pytest",     label: "PyTest",        description: "Python unit/E2E tests" },
  { id: "bdd",        label: "BDD / Gherkin", description: "Feature files (Given/When/Then)" },
  { id: "selenium",   label: "Selenium",      description: "Java/Python WebDriver" },
  { id: "postman",    label: "Postman",       description: "API test collection JSON" },
];

type ExportType = "test_cases" | "stories";

export default function ExportsPage() {
  const { selectedProject } = useProject();

  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState("playwright");
  const [outputMode, setOutputMode] = useState<"separate" | "combined">("separate");
  const [exportType, setExportType] = useState<ExportType>("test_cases");
  const [exporting, setExporting] = useState(false);

  const fetchStories = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await api.getStories(1, 200);
      const projectStories = selectedProject
        ? res.data.filter((s) => s.projectId === selectedProject.id)
        : res.data;
      setStories(projectStories);
      setSelected(new Set(projectStories.map((s) => s.id)));
    } catch {
      setFetchError("Could not load stories. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const totalTests = stories
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + (s.testCaseCount ?? 0), 0);

  const toggleAll = () => {
    if (selected.size === stories.length) setSelected(new Set());
    else setSelected(new Set(stories.map((s) => s.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleDownload() {
    if (selected.size === 0 || exporting) return;
    setExporting(true);
    try {
      const selectedIds = Array.from(selected);
      if (exportType === "stories") {
        const selectedStories = stories.filter((s) => selected.has(s.id));
        const exportData = selectedStories.map((s) => ({
          id: s.id,
          description: s.description,
          status: s.storyStatus,
          projectId: s.projectId,
          testCaseCount: s.testCaseCount,
          impactedTestCasesCount: s.impactedTestCasesCount,
        }));
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
        triggerDownload(blob, "stories-export.json");
      } else {
        if (outputMode === "combined") {
          const allTcs: { storyId: string; testCases: any[] }[] = [];
          const combinedFailed: string[] = [];
          for (const storyId of selectedIds) {
            try {
              const res = await api.getTestCases(storyId);
              allTcs.push({ storyId, testCases: res.testCases });
            } catch {
              combinedFailed.push(storyId);
            }
          }
          if (combinedFailed.length > 0) {
            setFetchError(`Failed to fetch test cases for: ${combinedFailed.join(', ')}`);
          }
          const combinedText = allTcs.map((r) => {
            const tcs = r.testCases.map((tc: any) =>
              `// ${tc.title}\n// Priority: ${tc.priority}\n${tc.steps?.map((s: string, i: number) => `// Step ${i + 1}: ${s}`).join("\n") ?? ""}\n// Expected: ${tc.expectedResult ?? ""}`
            ).join("\n\n");
            return `/* Story: ${r.storyId} */\n${tcs}`;
          }).join("\n\n");
          const ext = format === "pytest" ? "py" : format === "bdd" ? "feature" : format === "postman" ? "json" : "ts";
          const blob = new Blob([combinedText], { type: "text/plain" });
          triggerDownload(blob, `test-cases-${format}.${ext}`);
        } else {
          const failed: string[] = [];
          for (const storyId of selectedIds) {
            try {
              const blob = await api.downloadTestCases(storyId);
              triggerDownload(blob, `${storyId}-tests.xlsx`);
            } catch {
              failed.push(storyId);
            }
          }
          if (failed.length > 0) {
            setFetchError(`Failed to download: ${failed.join(', ')}`);
          }
        }
      }
    } finally {
      setExporting(false);
    }
  }

  return (
    <PageLayout>
      <PageHeader title="Exports" actions={<PageActions />} />

      <div className="flex flex-1 overflow-hidden mx-auto w-full max-w-[1600px]">
        {/* Left panel — story selector */}
        <div className="w-[360px] flex-shrink-0 border-r border-border flex flex-col h-full overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">
              Stories {!loading && <span className="text-muted font-normal">({stories.length})</span>}
            </p>
            {!loading && stories.length > 0 && (
              <button onClick={toggleAll} className="text-xs text-cyan hover:underline">
                {selected.size === stories.length ? "Deselect All" : "Select All"}
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">Loading stories…</p>
              </div>
            )}
            {!loading && fetchError && (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted px-4 text-center">
                <AlertCircle size={24} className="text-error" />
                <p className="text-sm text-error">{fetchError}</p>
                <button onClick={fetchStories} className="text-xs text-cyan hover:underline">Retry</button>
              </div>
            )}
            {!loading && !fetchError && stories.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted px-4 text-center">
                <FileText size={32} className="text-muted/40" />
                <p className="text-sm">No stories found{selectedProject ? ` in ${selectedProject.name}` : ""}.</p>
                <p className="text-xs">Upload a story first to export test cases.</p>
              </div>
            )}
            {!loading && !fetchError && stories.map((s) => (
              <label
                key={s.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-border transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="w-4 h-4 accent-pink flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-cyan">{s.id}</span>
                    <span className="text-sm font-medium text-navy truncate">
                      {(s.description ?? s.id).slice(0, 60)}{(s.description?.length ?? 0) > 60 ? "…" : ""}
                    </span>
                  </div>
                  <p className="text-xs text-muted">
                    {s.testCaseCount ?? 0} tests
                    {(s.impactedTestCasesCount ?? 0) > 0 ? ` · ${s.impactedTestCasesCount} impacted` : ""}
                    {s.storyStatus ? ` · ${s.storyStatus.replace(/_/g, " ")}` : ""}
                  </p>
                </div>
              </label>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border bg-gray-50">
            <p className="text-sm font-medium text-navy">
              {selected.size} stories selected · {totalTests} tests
            </p>
          </div>
        </div>

        {/* Right panel — format + options + download */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="max-w-[680px] space-y-6"
          >
            {/* Export type */}
            <motion.div variants={fadeInUp}>
              <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-3">Export Type</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setExportType("test_cases")}
                  className={`flex items-start gap-3 p-4 rounded-card border text-left transition-colors ${exportType === "test_cases" ? "border-pink bg-surface-pink" : "border-border bg-white hover:bg-gray-50"}`}>
                  <TestTube2 size={20} className={exportType === "test_cases" ? "text-pink" : "text-muted"} />
                  <div>
                    <p className="text-sm font-semibold text-navy">Test Cases</p>
                    <p className="text-xs text-muted mt-0.5">Export generated test cases as framework code</p>
                  </div>
                </button>
                <button onClick={() => setExportType("stories")}
                  className={`flex items-start gap-3 p-4 rounded-card border text-left transition-colors ${exportType === "stories" ? "border-pink bg-surface-pink" : "border-border bg-white hover:bg-gray-50"}`}>
                  <FileText size={20} className={exportType === "stories" ? "text-pink" : "text-muted"} />
                  <div>
                    <p className="text-sm font-semibold text-navy">Stories</p>
                    <p className="text-xs text-muted mt-0.5">Export story metadata as JSON</p>
                  </div>
                </button>
              </div>
            </motion.div>

            {/* Framework selector — only for test cases */}
            {exportType === "test_cases" && (
              <motion.div variants={fadeInUp}>
                <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-3">Framework</p>
                <div className="grid grid-cols-2 gap-3">
                  {FORMATS.map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setFormat(fmt.id)}
                      className={`flex items-start gap-3 p-4 rounded-card border text-left transition-colors ${
                        format === fmt.id
                          ? "border-pink bg-surface-pink"
                          : "border-border bg-white hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        format === fmt.id ? "bg-pink text-white" : "bg-gray-100 text-muted"
                      }`}>
                        {fmt.label.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-navy">{fmt.label}</p>
                        <p className="text-xs text-muted mt-0.5">{fmt.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Output mode — only for test cases */}
            {exportType === "test_cases" && (
              <motion.div variants={fadeInUp}>
                <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-3">Output</p>
                <div className="space-y-2">
                  {(["separate", "combined"] as const).map((m) => (
                    <label key={m} className="flex items-center gap-3 cursor-pointer">
                      <div
                        onClick={() => setOutputMode(m)}
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          outputMode === m ? "border-pink" : "border-muted"
                        }`}
                      >
                        {outputMode === m && <div className="w-2 h-2 rounded-full bg-pink" />}
                      </div>
                      <span className="text-sm text-navy">
                        {m === "separate" ? "Separate Excel file per story (.xlsx)" : "Single combined text file"}
                      </span>
                    </label>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Summary + download */}
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5 space-y-4">
              <div>
                <p className="text-sm text-navy font-medium">
                  {selected.size} stories ·{" "}
                  {exportType === "test_cases"
                    ? `${totalTests} tests · ${FORMATS.find((f) => f.id === format)?.label} · ${outputMode === "separate" ? `${selected.size} files` : "1 file"}`
                    : "Stories JSON export"}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  disabled={selected.size === 0 || exporting || loading}
                  onClick={handleDownload}
                  className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  {exporting ? "Exporting…" : "Download"}
                </button>
              </div>
              {exportType === "test_cases" && totalTests === 0 && selected.size > 0 && !loading && (
                <p className="text-xs text-muted">
                  Selected stories have no test cases yet. Generate tests first.
                </p>
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
