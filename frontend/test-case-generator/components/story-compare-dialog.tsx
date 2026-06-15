"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText, Brain, X, ArrowLeftRight } from "lucide-react"
import { Story, api, TestCase } from "@/lib/api"

interface StoryCompareDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  stories: Story[]
  initialStoryId?: string
}

export function StoryCompareDialog({ open, onOpenChange, stories, initialStoryId }: StoryCompareDialogProps) {
  const [leftId, setLeftId] = useState(initialStoryId || "")
  const [rightId, setRightId] = useState("")
  const [leftTCs, setLeftTCs] = useState<TestCase[]>([])
  const [rightTCs, setRightTCs] = useState<TestCase[]>([])
  const [loadingLeft, setLoadingLeft] = useState(false)
  const [loadingRight, setLoadingRight] = useState(false)

  useEffect(() => { if (initialStoryId) setLeftId(initialStoryId) }, [initialStoryId])

  const fetchTCs = async (storyId: string, side: "left" | "right") => {
    if (!storyId) return
    side === "left" ? setLoadingLeft(true) : setLoadingRight(true)
    try {
      const res = await api.getTestCases(storyId)
      const raw = (res as any)?.testcases
      const tcs = Array.isArray(raw) ? raw : []
      side === "left" ? setLeftTCs(tcs) : setRightTCs(tcs)
    } catch {
      side === "left" ? setLeftTCs([]) : setRightTCs([])
    } finally {
      side === "left" ? setLoadingLeft(false) : setLoadingRight(false)
    }
  }

  useEffect(() => { if (leftId) fetchTCs(leftId, "left") }, [leftId])
  useEffect(() => { if (rightId) fetchTCs(rightId, "right") }, [rightId])

  const leftStory = stories.find(s => s.id === leftId)
  const rightStory = stories.find(s => s.id === rightId)

  const swap = () => {
    const tmp = leftId; setLeftId(rightId); setRightId(tmp)
    const tmpTCs = leftTCs; setLeftTCs(rightTCs); setRightTCs(tmpTCs)
  }

  const priorityStyle = (p?: string) => {
    if (p === "high") return { bg: "#fff1f2", color: "#be123c", border: "#fecdd3" }
    if (p === "medium") return { bg: "#fffbeb", color: "#b45309", border: "#fde68a" }
    return { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl rounded-2xl border-0 p-0 overflow-hidden flex flex-col"
        style={{ boxShadow: "0 24px 64px rgba(15,22,43,0.22)", maxHeight: "88vh" }}>
        {/* Header */}
        <div className="px-6 py-4 flex-shrink-0" style={{ background: "#0D1B2A" }}>
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: "rgba(162,210,233,0.18)" }}>
                <ArrowLeftRight className="w-3.5 h-3.5" style={{ color: "#A8DCE5" }} />
              </div>
              Compare Stories
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Story selectors */}
        <div className="flex items-center gap-3 px-6 py-3 flex-shrink-0 border-b border-[#E4F1F3]"
          style={{ background: "#fafbfd" }}>
          <select value={leftId} onChange={e => setLeftId(e.target.value)}
            className="flex-1 h-9 rounded-xl px-3 text-sm border border-[#A8D4DB] bg-white text-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#1A9FB5]/20">
            <option value="">Select story A…</option>
            {stories.map(s => <option key={s.id} value={s.id}>{s.id} — {(s.description || "").slice(0, 60)}</option>)}
          </select>
          <button onClick={swap} className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#E8F6F8] border border-[#C8E3E8]"
            style={{ color: "#1A9FB5" }}>
            <ArrowLeftRight className="w-4 h-4" />
          </button>
          <select value={rightId} onChange={e => setRightId(e.target.value)}
            className="flex-1 h-9 rounded-xl px-3 text-sm border border-[#A8D4DB] bg-white text-[#0D1B2A] focus:outline-none focus:ring-2 focus:ring-[#1A9FB5]/20">
            <option value="">Select story B…</option>
            {stories.map(s => <option key={s.id} value={s.id}>{s.id} — {(s.description || "").slice(0, 60)}</option>)}
          </select>
        </div>

        {/* Two-column comparison */}
        <div className="flex flex-1 overflow-hidden min-h-0">
          {[
            { story: leftStory, tcs: leftTCs, loading: loadingLeft, id: leftId, side: "A" },
            { story: rightStory, tcs: rightTCs, loading: loadingRight, id: rightId, side: "B" },
          ].map(({ story, tcs, loading, id, side }) => (
            <div key={side} className="flex-1 flex flex-col overflow-hidden border-r last:border-r-0 border-[#E4F1F3]">
              {/* Story info */}
              <div className="px-4 py-3 flex-shrink-0 border-b border-[#E4F1F3]" style={{ background: "#F4F8FA" }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded font-mono"
                    style={{ background: "#0D1B2A", color: "#A8DCE5" }}>{side}</span>
                  <span className="text-sm font-bold text-[#0D1B2A]">{story?.id || "—"}</span>
                  {story && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ background: "#E8F6F8", color: "#1A9FB5" }}>
                      {tcs.length} test cases
                    </span>
                  )}
                </div>
                {story?.description && (
                  <p className="text-xs text-[#4E7A8A] line-clamp-2">{story.description}</p>
                )}
              </div>

              {/* TC list */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {!id && (
                  <div className="py-12 text-center text-sm text-[#9ca3af]">Select a story above</div>
                )}
                {id && loading && (
                  <div className="py-12 text-center">
                    <div className="inline-flex items-center gap-2 text-sm text-[#1A9FB5]">
                      <div className="w-4 h-4 border-2 border-[#1A9FB5] border-t-transparent rounded-full animate-spin" />
                      Loading…
                    </div>
                  </div>
                )}
                {id && !loading && tcs.length === 0 && (
                  <div className="py-12 text-center text-sm text-[#9ca3af]">No test cases found</div>
                )}
                {tcs.map((tc, i) => {
                  const ps = priorityStyle(tc.priority)
                  return (
                    <div key={tc.test_case_id || tc.id || i}
                      className="rounded-xl p-3"
                      style={{ background: "#ffffff", border: "1px solid #C8E3E8" }}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className="w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                          style={{ background: "#E8F6F8", color: "#1A9FB5" }}>
                          {i + 1}
                        </div>
                        <span className="text-xs font-semibold text-[#0D1B2A] flex-1 truncate">{tc.title}</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                          style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                          {tc.priority || "low"}
                        </span>
                      </div>
                      {tc.steps?.length ? (
                        <div className="text-[11px] text-[#9ca3af]">{tc.steps.length} steps</div>
                      ) : null}
                    </div>
                  )
                })}
              </div>

              {/* Footer stats */}
              {tcs.length > 0 && (
                <div className="px-4 py-2.5 flex-shrink-0 border-t border-[#E4F1F3] flex items-center gap-3"
                  style={{ background: "#fafbfd" }}>
                  {(["high","medium","low"] as const).map(p => {
                    const count = tcs.filter(tc => (tc.priority || "low") === p).length
                    if (!count) return null
                    const ps = priorityStyle(p)
                    return (
                      <span key={p} className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: ps.bg, color: ps.color, border: `1px solid ${ps.border}` }}>
                        {p}: {count}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
