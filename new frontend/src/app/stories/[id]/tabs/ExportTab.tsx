"use client";

import { useState, useEffect } from "react";
import { Copy, Download, Loader2, RefreshCw, Globe, CheckCircle2, AlertTriangle } from "lucide-react";
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

  // Crawl state
  const [crawling, setCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [domSnapshot, setDomSnapshot] = useState<{ elementCount: number } | null>(null);

  async function handleCrawl() {
    setCrawling(true);
    setCrawlError(null);
    try {
      const res = await fetch(`/api/stories/${story.id}/crawl`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Crawl failed");
      setDomSnapshot({ elementCount: data.element_count ?? data.elementCount ?? 0 });
      // Re-generate code now that selectors are available
      generate(selected, approvedOnly);
    } catch (e: any) {
      setCrawlError(e.message);
    } finally {
      setCrawling(false);
    }
  }

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

      {/* Crawl banner — shown only when the story has a pageUrl */}
      {story.pageUrl && (
        <motion.div variants={fadeInUp}>
          {domSnapshot ? (
            /* Green: page crawled */
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-card border border-green-200 bg-green-50">
              <div className="flex items-center gap-2 text-sm text-green-800">
                <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                <span className="font-medium">Page crawled</span>
                <span className="text-green-600">— {domSnapshot.elementCount} interactive elements found. Export code uses real selectors.</span>
              </div>
              <button
                onClick={handleCrawl}
                disabled={crawling}
                className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-900 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <RefreshCw size={12} className={crawling ? "animate-spin" : ""} />
                Re-crawl
              </button>
            </div>
          ) : (
            /* Amber: not yet crawled */
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-card border border-amber-200 bg-amber-50">
              <div className="flex items-center gap-2 text-sm text-amber-800">
                <Globe size={16} className="text-amber-500 flex-shrink-0" />
                <span>
                  <span className="font-medium">Crawl page for real selectors</span>
                  <span className="text-amber-600"> — export code will use generic placeholders until the page is crawled.</span>
                </span>
              </div>
              <button
                onClick={handleCrawl}
                disabled={crawling}
                className="h-8 px-3 text-xs font-semibold bg-amber-500 text-white rounded-btn hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-1.5 flex-shrink-0"
              >
                {crawling ? <Loader2 size={12} className="animate-spin" /> : <Globe size={12} />}
                {crawling ? "Crawling…" : "Crawl page"}
              </button>
            </div>
          )}
          {crawlError && (
            <div className="flex items-center gap-2 mt-2 text-xs text-red-600">
              <AlertTriangle size={12} />
              {crawlError}
            </div>
          )}
        </motion.div>
      )}

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
