"use client";

import { useState, useEffect } from "react";
import { Copy, Download, Loader2, RefreshCw } from "lucide-react";
import { type Story } from "@/lib/seed";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { motion } from "framer-motion";

const FORMATS = [
  { id: "playwright", label: "Playwright", description: "TypeScript E2E tests" },
  { id: "cypress",    label: "Cypress",    description: "JavaScript E2E tests" },
  { id: "pytest",     label: "PyTest",     description: "Python unit/E2E tests" },
  { id: "bdd",        label: "BDD / Gherkin", description: "Feature files (Given/When/Then)" },
  { id: "selenium",   label: "Selenium",   description: "Java/Python WebDriver" },
  { id: "postman",    label: "Postman",    description: "API test collection JSON" },
];

export function ExportTab({ story, testCount }: { story: Story; testCount: number }) {
  const [selected, setSelected] = useState("playwright");
  const [approvedOnly, setApprovedOnly] = useState(true);
  const [code, setCode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function generate(fmt: string, approved: boolean) {
    setLoading(true); setError(null); setCode("");
    try {
      const params = new URLSearchParams({ format: fmt, approved_only: String(approved) });
      const res = await fetch(`/api/stories/${story.id}/export-code?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Generation failed');
      setCode(data.code ?? '');
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    if (testCount > 0) generate(selected, approvedOnly);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, approvedOnly, story.id]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext: Record<string, string> = { playwright: '.spec.ts', cypress: '.spec.js', pytest: '.py', bdd: '.feature', selenium: '.py', postman: '.json' };
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${story.id}-${selected}${ext[selected] ?? '.txt'}`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate" className="px-8 py-8 max-w-content mx-auto space-y-6">
      <motion.div variants={fadeInUp}>
        <h2 className="text-[24px] font-bold text-navy mb-1">Export Tests</h2>
        <p className="text-sm text-muted">AI-generated automation-ready scripts from your test cases.</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-2 gap-3">
        {FORMATS.map((fmt) => (
          <button key={fmt.id} onClick={() => setSelected(fmt.id)}
            className={`flex items-start gap-3 p-4 rounded-card border text-left transition-colors ${selected === fmt.id ? "border-pink bg-surface-pink" : "border-border bg-white hover:bg-gray-50"}`}>
            <div className={`w-8 h-8 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${selected === fmt.id ? "bg-pink text-white" : "bg-border text-muted"}`}>
              {fmt.label.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold text-navy">{fmt.label}</p>
              <p className="text-xs text-muted mt-0.5">{fmt.description}</p>
            </div>
          </button>
        ))}
      </motion.div>

      <motion.div variants={fadeInUp} className="flex flex-col gap-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={approvedOnly} onChange={(e) => setApprovedOnly(e.target.checked)} className="w-4 h-4 accent-pink" />
          <span className="text-sm text-navy">Include only approved tests</span>
        </label>
        <p className="text-sm text-muted">{testCount} test cases</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="relative rounded-lg overflow-hidden">
        <div className="bg-navy px-4 py-2 flex items-center justify-between">
          <span className="text-[12px] text-muted font-mono">{FORMATS.find((f) => f.id === selected)?.label}</span>
          <div className="flex items-center gap-3">
            <button onClick={() => generate(selected, approvedOnly)} disabled={loading} title="Regenerate" className="text-muted hover:text-white transition-colors disabled:opacity-50">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleCopy} disabled={!code || loading} className="flex items-center gap-1.5 text-xs text-muted hover:text-white transition-colors disabled:opacity-50">
              <Copy size={13} /> {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <div className="bg-[#0F172A] min-h-[200px] max-h-[400px] overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32 gap-2 text-muted text-sm">
              <Loader2 size={16} className="animate-spin" /> Generating {FORMATS.find(f=>f.id===selected)?.label} code…
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <p className="text-[#EF4444] text-sm">{error}</p>
              <button onClick={() => generate(selected, approvedOnly)} className="text-xs text-gray-400 hover:text-white underline">Retry</button>
            </div>
          ) : (
            <pre className="text-[#E2E8F0] font-mono text-[13px] p-5 leading-relaxed whitespace-pre">{code || '// No test cases yet'}</pre>
          )}
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-3">
        <button onClick={handleDownload} disabled={!code || loading}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2 disabled:opacity-50">
          <Download size={14} /> Download
        </button>
        <button onClick={handleCopy} disabled={!code || loading}
          className="h-9 px-5 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2 disabled:opacity-50">
          <Copy size={14} /> Copy to clipboard
        </button>
      </motion.div>
    </motion.div>
  );
}
