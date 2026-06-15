"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Download, Code2, ChevronRight, Check } from "lucide-react"
import { TestCase } from "@/lib/api"
import { FORMATS, ScriptFormat, generateScript, downloadScript, FormatMeta } from "@/lib/test-script-export"

interface ExportScriptDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  storyId: string
  testCases: TestCase[]
}

export function ExportScriptDialog({ open, onOpenChange, storyId, testCases }: ExportScriptDialogProps) {
  const [selected, setSelected] = useState<ScriptFormat>("playwright")
  const [preview, setPreview] = useState("")
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open && testCases.length > 0) {
      setPreview(generateScript(selected, storyId, testCases))
    }
  }, [selected, open, testCases, storyId])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    downloadScript(selected, storyId, testCases)
  }

  const selectedMeta = FORMATS.find(f => f.id === selected)!

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl rounded-2xl border-0 p-0 overflow-hidden flex flex-col"
        style={{ boxShadow: "0 24px 64px rgba(15,22,43,0.22)", maxHeight: "88vh" }}
      >
        {/* Header */}
        <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0D1B2A" }}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(162,210,233,0.18)" }}>
                <Code2 className="w-3.5 h-3.5" style={{ color: "#A8DCE5" }} />
              </div>
              Export Test Script
            </DialogTitle>
            <DialogDescription className="text-sm mt-0.5" style={{ color: "#A8DCE5" }}>
              {storyId} · {testCases.length} test case{testCases.length !== 1 ? "s" : ""} · Select a format to preview and download
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body — two columns */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* Left — format picker */}
          <div className="w-56 flex-shrink-0 flex flex-col border-r border-[#E4F1F3]" style={{ background: "#F4F8FA" }}>
            <div className="px-4 py-3 border-b border-[#E4F1F3]">
              <span className="text-[11px] font-bold uppercase tracking-widest text-[#4E7A8A]">Framework</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {FORMATS.map(fmt => (
                <button
                  key={fmt.id}
                  onClick={() => setSelected(fmt.id)}
                  className="w-full text-left px-3 py-2.5 rounded-xl transition-all"
                  style={selected === fmt.id
                    ? { background: "#1A9FB5", color: "#ffffff" }
                    : { color: "#374151" }
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{fmt.label}</span>
                    {selected === fmt.id
                      ? <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#ffffff" }} />
                      : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 opacity-30" />
                    }
                  </div>
                  <div className="text-[11px] mt-0.5 leading-tight"
                    style={{ color: selected === fmt.id ? "#E1F5F8" : "#9ca3af" }}>
                    .{fmt.ext}
                  </div>
                </button>
              ))}
            </div>

            {/* Format info */}
            <div className="p-3 border-t border-[#E4F1F3]">
              <div className="rounded-xl p-3" style={{ background: "#ffffff", border: "1px solid #C8E3E8" }}>
                <div className="text-[11px] font-bold text-[#0D1B2A] mb-1">{selectedMeta.label}</div>
                <div className="text-[11px] text-[#4E7A8A] leading-relaxed">{selectedMeta.description}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                    style={{ background: "#E1F5F8", color: "#0F7A8A" }}>
                    .{selectedMeta.ext}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                    style={{ background: "#F4F8FA", color: "#4E7A8A", border: "1px solid #E4F1F3" }}>
                    {selectedMeta.language}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right — code preview */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Preview toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#E4F1F3] flex-shrink-0"
              style={{ background: "#fafbfd" }}>
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: "#fde68a" }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: "#bbf7d0" }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: "#9DD6DE" }} />
                </div>
                <span className="text-xs font-mono text-[#9ca3af] ml-1">
                  {`${storyId.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${selected}.${selectedMeta.ext}`}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="text-xs font-semibold px-3 py-1 rounded-lg transition-all"
                style={copied
                  ? { background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }
                  : { background: "#E1F5F8", color: "#0F7A8A", border: "1px solid #1A9FB5" }
                }
              >
                {copied ? "✓ Copied!" : "Copy"}
              </button>
            </div>

            {/* Code */}
            <div className="flex-1 overflow-auto" style={{ background: "#0F1117" }}>
              <pre
                className="text-xs leading-relaxed p-5 font-mono h-full"
                style={{ color: "#e6edf3", whiteSpace: "pre", minHeight: "100%" }}
              >
                {preview || "No test cases to export."}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-t border-[#E4F1F3] bg-white">
          <div className="text-xs text-[#9ca3af]">
            Steps are scaffolded as comments — add your selectors and assertions to complete each test.
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => onOpenChange(false)}
              className="h-9 px-4 rounded-xl text-sm font-semibold border border-[#C8E3E8] text-[#374151] hover:bg-[#F4F8FA] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDownload}
              className="h-9 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: "#1A9FB5" }}
            >
              <Download className="w-4 h-4" />
              Download .{selectedMeta.ext}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
