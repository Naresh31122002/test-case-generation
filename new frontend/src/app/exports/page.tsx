"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Download } from "lucide-react";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { useProject } from "@/contexts/ProjectContext";
import { storiesForProject } from "@/lib/projects";
import { PageLayout, PageHeader, PageActions } from "@/components/layout/PageLayout";

const FORMATS = [
  { id: "playwright", label: "Playwright",    description: "TypeScript E2E tests" },
  { id: "cypress",    label: "Cypress",       description: "JavaScript E2E tests" },
  { id: "pytest",     label: "PyTest",        description: "Python unit/E2E tests" },
  { id: "bdd",        label: "BDD / Gherkin", description: "Feature files (Given/When/Then)" },
  { id: "selenium",   label: "Selenium",      description: "Java/Python WebDriver" },
  { id: "postman",    label: "Postman",       description: "API test collection JSON" },
];

export default function ExportsPage() {
  const { selectedProject } = useProject();
  const stories = storiesForProject(selectedProject);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState("playwright");
  const [mode, setMode] = useState<"separate" | "combined">("separate");

  // Default selection = all stories in the current project.
  useEffect(() => {
    setSelected(new Set(stories.map((s) => s.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject]);

  const totalTests = stories
    .filter((s) => selected.has(s.id))
    .reduce((sum, s) => sum + s.testCount, 0);

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

  return (
    <PageLayout>
      <PageHeader title="Exports" actions={<PageActions />} />

      <div className="flex flex-1 overflow-hidden mx-auto w-full max-w-[1600px]">
        {/* Left panel — story selector */}
        <div className="w-[360px] flex-shrink-0 border-r border-border flex flex-col h-full overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm font-semibold text-navy">Stories</p>
            <button onClick={toggleAll} className="text-xs text-cyan hover:underline">
              {selected.size === stories.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {stories.map((s) => (
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
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-cyan">{s.id}</span>
                    <span className="text-sm font-medium text-navy truncate">{s.title}</span>
                  </div>
                  <p className="text-xs text-muted">{s.testCount} tests · {s.coverage}% coverage</p>
                </div>
              </label>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-border bg-gray-50">
            <p className="text-sm font-medium text-navy">
              {selected.size} stories selected ({totalTests} tests)
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
            {/* Format grid */}
            <motion.div variants={fadeInUp}>
              <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-3">Format</p>
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

            {/* Output mode */}
            <motion.div variants={fadeInUp}>
              <p className="text-[13px] font-semibold text-muted uppercase tracking-wide mb-3">Output</p>
              <div className="space-y-2">
                {(["separate", "combined"] as const).map((m) => (
                  <label key={m} className="flex items-center gap-3 cursor-pointer">
                    <div
                      onClick={() => setMode(m)}
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        mode === m ? "border-pink" : "border-muted"
                      }`}
                    >
                      {mode === m && <div className="w-2 h-2 rounded-full bg-pink" />}
                    </div>
                    <span className="text-sm text-navy">
                      {m === "separate" ? "Separate files per story" : "Single combined file"}
                    </span>
                  </label>
                ))}
              </div>
            </motion.div>

            {/* Summary + download */}
            <motion.div variants={fadeInUp} className="bg-white border border-border rounded-card p-5 space-y-4">
              <div>
                <p className="text-sm text-navy font-medium">
                  {selected.size} stories · {totalTests} tests ·{" "}
                  {FORMATS.find((f) => f.id === format)?.label} ·{" "}
                  {mode === "separate" ? `${selected.size} files` : "1 file"}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  disabled={selected.size === 0}
                  className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} />
                  Download All
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </PageLayout>
  );
}
