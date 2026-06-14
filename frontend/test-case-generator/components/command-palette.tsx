"use client"

import { useState, useEffect, useRef } from "react"
import { Search, FileText, Brain, ArrowRight, Clock, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { Story } from "@/lib/api"

interface CommandPaletteProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  stories: Story[]
  onSelectStory: (story: Story) => void
}

export function CommandPalette({ open, onOpenChange, stories, onSelectStory }: CommandPaletteProps) {
  const [query, setQuery] = useState("")
  const [recentIds, setRecentIds] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (open) {
      setQuery("")
      setTimeout(() => inputRef.current?.focus(), 50)
      try {
        const saved = localStorage.getItem("recent-story-ids")
        if (saved) setRecentIds(JSON.parse(saved).slice(0, 5))
      } catch {}
    }
  }, [open])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); onOpenChange(true) }
      if (e.key === "Escape") onOpenChange(false)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [onOpenChange])

  const filtered = query.trim()
    ? stories.filter(s =>
        s.id.toLowerCase().includes(query.toLowerCase()) ||
        (s.description || "").toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : []

  const recentStories = recentIds
    .map(id => stories.find(s => s.id === id))
    .filter(Boolean) as Story[]

  const handleSelect = (story: Story) => {
    // save to recent
    try {
      const updated = [story.id, ...recentIds.filter(id => id !== story.id)].slice(0, 5)
      localStorage.setItem("recent-story-ids", JSON.stringify(updated))
    } catch {}
    onSelectStory(story)
    onOpenChange(false)
  }

  const actions = [
    { label: "View Test Cases", icon: <FileText className="w-3.5 h-3.5" />, key: "tc" },
    { label: "View Impact Analysis", icon: <Brain className="w-3.5 h-3.5" />, key: "impact" },
  ]

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      style={{ background: "rgba(15,22,43,0.45)", backdropFilter: "blur(4px)" }}
      onClick={() => onOpenChange(false)}
    >
      <div
        className="w-full max-w-xl rounded-2xl overflow-hidden flex flex-col"
        style={{ background: "#ffffff", boxShadow: "0 32px 80px rgba(15,22,43,0.3)", maxHeight: "60vh" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#eef2f8]">
          <Search className="w-4 h-4 flex-shrink-0 text-[#377ACF]" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search stories by ID or description…"
            className="flex-1 text-sm bg-transparent outline-none text-[#1a2540] placeholder:text-[#b0c4d8]"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[#9ca3af] hover:text-[#374151]">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="text-[10px] px-1.5 py-0.5 rounded font-mono text-[#9ca3af]"
            style={{ background: "#F6F8FB", border: "1px solid #dde6f0" }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="overflow-y-auto flex-1">
          {query.trim() === "" && recentStories.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#9ca3af] flex items-center gap-1.5">
                <Clock className="w-3 h-3" />Recent
              </div>
              {recentStories.map(story => (
                <StoryRow key={story.id} story={story} onSelect={handleSelect} router={router} />
              ))}
            </div>
          )}

          {query.trim() !== "" && filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[#9ca3af]">No stories found for "{query}"</div>
          )}

          {filtered.length > 0 && (
            <div>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">Stories</div>
              {filtered.map(story => (
                <StoryRow key={story.id} story={story} onSelect={handleSelect} router={router} />
              ))}
            </div>
          )}

          {/* Quick actions */}
          {query.trim() === "" && (
            <div>
              <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-[#9ca3af]">Quick Actions</div>
              {[
                { label: "Go to Dashboard", icon: <ArrowRight className="w-3.5 h-3.5" />, action: () => { router.push("/"); onOpenChange(false) } },
              ].map(a => (
                <button key={a.label} onClick={a.action}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f0f6ff] transition-colors text-left">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: "#f0f6ff", color: "#377ACF" }}>
                    {a.icon}
                  </div>
                  <span className="text-sm text-[#374151]">{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-[#eef2f8] flex items-center gap-3"
          style={{ background: "#fafbfd" }}>
          <div className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
            <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: "#F6F8FB", border: "1px solid #dde6f0" }}>↵</kbd>
            open preview
          </div>
          <div className="flex items-center gap-1 text-[11px] text-[#9ca3af]">
            <kbd className="px-1.5 py-0.5 rounded font-mono text-[10px]" style={{ background: "#F6F8FB", border: "1px solid #dde6f0" }}>⌘K</kbd>
            toggle
          </div>
        </div>
      </div>
    </div>
  )
}

function StoryRow({ story, onSelect, router }: { story: Story; onSelect: (s: Story) => void; router: any }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#f0f6ff] transition-colors group">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: "#f0f6ff", color: "#377ACF" }}>
        <FileText className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => onSelect(story)}>
        <div className="text-sm font-semibold text-[#1a2540] truncate">{story.id}</div>
        <div className="text-xs text-[#9ca3af] truncate">{story.description || "No description"}</div>
      </div>
      <div className="hidden group-hover:flex items-center gap-1.5">
        <button onClick={e => { e.stopPropagation(); router.push(`/test-cases/${story.id}`) }}
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
          style={{ background: "#f0f6ff", color: "#377ACF", border: "1px solid #c8d8eb" }}>
          Test Cases
        </button>
        {typeof story.impactedTestCases === "number" && story.impactedTestCases > 0 && (
          <button onClick={e => { e.stopPropagation(); router.push(`/story-details/${story.id}?project_id=${story.project_id}`) }}
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
            style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
            Impact
          </button>
        )}
      </div>
      <span className="text-[11px] text-[#9ca3af] flex-shrink-0 group-hover:hidden">
        {story.test_case_count || 0} cases
      </span>
    </div>
  )
}
