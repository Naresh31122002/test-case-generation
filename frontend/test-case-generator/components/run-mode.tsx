"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, MinusCircle, Download, RotateCcw, Play, ChevronDown, ChevronUp } from "lucide-react"
import { TestCase } from "@/lib/api"

type RunStatus = "pending" | "pass" | "fail" | "skip"

interface TCRunState {
  status: RunStatus
  note: string
  stepsChecked: boolean[]
}

interface RunModeProps {
  storyId: string
  testCases: TestCase[]
  onExit: () => void
}

const statusMeta: Record<RunStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending: { label: "Pending",  color: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb", icon: <MinusCircle className="w-4 h-4" /> },
  pass:    { label: "Pass",     color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0", icon: <CheckCircle2 className="w-4 h-4" /> },
  fail:    { label: "Fail",     color: "#be123c", bg: "#fff1f2", border: "#fecdd3", icon: <XCircle className="w-4 h-4" /> },
  skip:    { label: "Skip",     color: "#b45309", bg: "#fffbeb", border: "#fde68a", icon: <MinusCircle className="w-4 h-4" /> },
}

export function RunMode({ storyId, testCases, onExit }: RunModeProps) {
  const [runState, setRunState] = useState<TCRunState[]>(
    testCases.map(tc => ({
      status: "pending",
      note: "",
      stepsChecked: new Array(tc.steps?.length || 0).fill(false),
    }))
  )
  const [activeIdx, setActiveIdx] = useState(0)
  const [completed, setCompleted] = useState(false)

  const setStatus = (idx: number, status: RunStatus) => {
    setRunState(p => p.map((r, i) => i === idx ? { ...r, status } : r))
  }
  const setNote = (idx: number, note: string) => {
    setRunState(p => p.map((r, i) => i === idx ? { ...r, note } : r))
  }
  const toggleStep = (tcIdx: number, stepIdx: number) => {
    setRunState(p => p.map((r, i) => {
      if (i !== tcIdx) return r
      const steps = [...r.stepsChecked]
      steps[stepIdx] = !steps[stepIdx]
      return { ...r, stepsChecked: steps }
    }))
  }

  const passed  = runState.filter(r => r.status === "pass").length
  const failed  = runState.filter(r => r.status === "fail").length
  const skipped = runState.filter(r => r.status === "skip").length
  const pending = runState.filter(r => r.status === "pending").length
  const pct = Math.round(((passed + failed + skipped) / testCases.length) * 100)

  const downloadReport = () => {
    const lines = [
      `Test Run Report — ${storyId}`,
      `Date: ${new Date().toLocaleString()}`,
      ``,
      `Summary`,
      `─────────────────────────────────`,
      `Total:   ${testCases.length}`,
      `Passed:  ${passed}`,
      `Failed:  ${failed}`,
      `Skipped: ${skipped}`,
      `Pending: ${pending}`,
      ``,
      `Test Cases`,
      `─────────────────────────────────`,
      ...testCases.map((tc, i) => {
        const r = runState[i]
        const lines = [
          ``,
          `${i + 1}. ${tc.title}`,
          `   Status: ${r.status.toUpperCase()}`,
          `   Priority: ${tc.priority || "low"}`,
        ]
        if (r.note) lines.push(`   Note: ${r.note}`)
        if (tc.steps?.length) {
          lines.push(`   Steps:`)
          tc.steps.forEach((s, si) => lines.push(`     ${r.stepsChecked[si] ? "✓" : "○"} ${s}`))
        }
        return lines.join("\n")
      }),
    ]
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `run_report_${storyId}.txt`
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const activeTC = testCases[activeIdx]
  const activeRun = runState[activeIdx]

  return (
    <div className="flex flex-col h-full">
      {/* Run header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
        style={{ background: "#1A1A2E", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" style={{ color: "#FFB3C1" }} />
            <span className="text-sm font-bold text-white">Run Mode</span>
          </div>
          <span className="text-xs font-mono" style={{ color: "#FFB3C1" }}>{storyId}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { setRunState(testCases.map(tc => ({ status: "pending", note: "", stepsChecked: new Array(tc.steps?.length || 0).fill(false) }))); setActiveIdx(0); setCompleted(false) }}
            className="h-7 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors hover:opacity-80"
            style={{ background: "rgba(162,210,233,0.15)", color: "#FFB3C1" }}>
            <RotateCcw className="w-3 h-3" />Reset
          </button>
          <button onClick={downloadReport}
            className="h-7 px-3 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 hover:opacity-90"
            style={{ background: "#FF4D6D" }}>
            <Download className="w-3 h-3" />Report
          </button>
          <button onClick={onExit}
            className="h-7 px-3 rounded-lg text-xs font-semibold transition-colors hover:opacity-80"
            style={{ background: "rgba(255,255,255,0.08)", color: "#FFB3C1" }}>
            Exit Run
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-[#F0F0F0]" style={{ background: "#FAFAFA" }}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-semibold text-[#6B7280]">Progress — {pct}%</span>
          <div className="flex items-center gap-3">
            {[
              { label: "Pass", val: passed, color: "#15803d" },
              { label: "Fail", val: failed, color: "#be123c" },
              { label: "Skip", val: skipped, color: "#b45309" },
              { label: "Pending", val: pending, color: "#9ca3af" },
            ].map(s => s.val > 0 && (
              <span key={s.label} className="text-[11px] font-semibold" style={{ color: s.color }}>
                {s.label}: {s.val}
              </span>
            ))}
          </div>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: "#F0F0F0" }}>
          <div className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: failed > 0 ? "#be123c" : "#15803d" }} />
        </div>
      </div>

      {/* Split: list + detail */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left list */}
        <div className="w-64 flex-shrink-0 overflow-y-auto border-r border-[#F0F0F0]">
          {testCases.map((tc, idx) => {
            const r = runState[idx]
            const sm = statusMeta[r.status]
            return (
              <button key={idx} onClick={() => setActiveIdx(idx)}
                className="w-full text-left flex items-center gap-3 px-4 py-3 transition-colors relative"
                style={{
                  background: activeIdx === idx ? "#FFF0F3" : "transparent",
                  borderBottom: "1px solid #FFE4E8",
                }}>
                {activeIdx === idx && <div className="absolute left-0 top-0 bottom-0 w-0.5 rounded-r" style={{ background: "#FF4D6D" }} />}
                <div style={{ color: sm.color }}>{sm.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-[#1A1A2E]">{tc.title}</div>
                  <div className="text-[10px] mt-0.5" style={{ color: sm.color }}>{sm.label}</div>
                </div>
              </button>
            )
          })}
        </div>

        {/* Right detail */}
        {activeTC && activeRun && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Title */}
              <div>
                <h3 className="text-base font-bold text-[#1A1A2E]">{activeTC.title}</h3>
                <div className="text-xs font-mono text-[#9ca3af] mt-0.5">{activeTC.test_case_id || activeTC.id}</div>
              </div>

              {/* Steps with checkboxes */}
              {activeTC.steps?.length ? (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Steps</div>
                  <div className="space-y-2">
                    {activeTC.steps.map((step, si) => (
                      <label key={si} className="flex items-start gap-3 cursor-pointer group">
                        <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors border-2 ${activeRun.stepsChecked[si] ? "border-[#FF4D6D] bg-[#FF4D6D]" : "border-[#FCA5A5] bg-white"}`}
                          onClick={() => toggleStep(activeIdx, si)}>
                          {activeRun.stepsChecked[si] && <CheckCircle2 className="w-3 h-3 text-white" />}
                        </div>
                        <span className={`text-sm leading-relaxed transition-colors ${activeRun.stepsChecked[si] ? "line-through text-[#9ca3af]" : "text-[#374151]"}`}>
                          {step}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Expected result */}
              {(activeTC.expected_result || activeTC.expected_results?.[0]) && (
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Expected Result</div>
                  <div className="rounded-xl px-4 py-3 text-sm text-[#374151]" style={{ background: "#FFF0F3", border: "1px solid #FFE4E8" }}>
                    {activeTC.expected_result || activeTC.expected_results?.[0]}
                  </div>
                </div>
              )}

              {/* Note */}
              <div>
                <div className="text-[11px] font-bold uppercase tracking-widest text-[#6B7280] mb-2">Note (optional)</div>
                <textarea
                  rows={2}
                  value={activeRun.note}
                  onChange={e => setNote(activeIdx, e.target.value)}
                  placeholder="e.g. Failed on step 3 — button unresponsive"
                  className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#FF4D6D]/20"
                  style={{ border: "1px solid #FCA5A5", background: "#ffffff" }}
                />
              </div>
            </div>

            {/* Pass / Fail / Skip buttons */}
            <div className="flex items-center gap-2 px-5 py-4 flex-shrink-0 border-t border-[#F0F0F0]" style={{ background: "#FAFAFA" }}>
              {(["pass", "fail", "skip"] as RunStatus[]).map(s => {
                const sm = statusMeta[s]
                const isActive = activeRun.status === s
                return (
                  <button key={s} onClick={() => {
                    setStatus(activeIdx, s)
                    if (activeIdx < testCases.length - 1) setTimeout(() => setActiveIdx(i => i + 1), 300)
                  }}
                    className="flex-1 h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    style={isActive
                      ? { background: sm.bg, color: sm.color, border: `2px solid ${sm.border}` }
                      : { background: "#ffffff", color: "#9ca3af", border: "1px solid #FFE4E8" }
                    }>
                    {sm.icon}{sm.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
