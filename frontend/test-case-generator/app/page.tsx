"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, FileText, Download, Brain, Calendar,
  RefreshCw, ChevronLeft, ChevronRight, X, Eye,
  Clock, SlidersHorizontal, LayoutGrid, List,
  GripVertical, CheckCircle2, AlertCircle, Circle,
  Code2, Command, ArrowLeftRight, Layers,
  AlertTriangle, Users, TrendingUp, Plus, Zap,
  BookOpen, Shield, Activity, ExternalLink,
} from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { api, Story } from "@/lib/api"
import { toast } from "sonner"
import { Chatbot } from "@/components/chatbot"
import { ExportScriptDialog } from "@/components/export-script-dialog"
import { TestCase } from "@/lib/api"
import { CommandPalette } from "@/components/command-palette"
import { StoryCompareDialog } from "@/components/story-compare-dialog"

/* ─── types ─────────────────────────────────────────────────── */
interface FormData {
  storyId: string
  storyDescription: string
  createdDate: string
  fromDate: string
  toDate: string
}

function cleanAndParseLLMResponse(response: string) {
  let cleaned = response.trim()
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7)
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3)
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3)
  cleaned = cleaned.trim()
  try { return { parsed: JSON.parse(cleaned), cleaned } }
  catch { return { parsed: null, cleaned } }
}

function formatRagTestCases(testCases: any[]) {
  return testCases.map((tc, idx) => [
    `Test Case ${idx + 1}: ${tc.title}`,
    `Description: ${tc.description}`,
    "Steps:", ...tc.steps.map((s: string, i: number) => `  ${i + 1}. ${s}`),
    `Expected Result: ${tc.expected_result}`, "",
  ].join("\n")).join("\n")
}

/* ─── coverage color ─────────────────────────────────────────── */
function coverageColor(pct: number) {
  if (pct >= 90) return "#10B981"
  if (pct >= 75) return "#22C55E"
  if (pct >= 50) return "#F59E0B"
  return "#EF4444"
}

/* ─── story card (board view) ────────────────────────────────── */
type KanbanCol = "generated" | "review" | "approved"
const COLS: { id: KanbanCol; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
  { id: "generated", label: "Generated",   icon: <Circle className="w-3.5 h-3.5" />,       color: "#06B6D4", bg: "#ECFEFF",  border: "#A5F3FC" },
  { id: "review",    label: "Under Review", icon: <AlertCircle className="w-3.5 h-3.5" />,  color: "#F59E0B", bg: "#FFFBEB",  border: "#FDE68A" },
  { id: "approved",  label: "Approved",     icon: <CheckCircle2 className="w-3.5 h-3.5" />, color: "#10B981", bg: "#ECFDF5",  border: "#A7F3D0" },
]

/* ═══════════════════════ COMPONENT ═══════════════════════════════ */
export default function StoriesPage() {
  const router = useRouter()

  const [formData, setFormData] = useState<FormData>({ storyId: "", storyDescription: "", createdDate: "", fromDate: "", toDate: "" })
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" })
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStories, setTotalStories] = useState(0)
  const [perPage, setPerPage] = useState(10)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")
  const [projects, setProjects] = useState<string[]>([])
  const [selectedProject, setSelectedProject] = useState("")
  const [previewStory, setPreviewStory] = useState<Story | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportTestCases, setExportTestCases] = useState<TestCase[]>([])
  const [exportLoading, setExportLoading] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ projectId: "", storyId: "", content: "", file: null as File | null })
  const [newProjectName, setNewProjectName] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{
    role: "assistant",
    content: "Hello! I'm your AI Test Case Assistant.\n\n🔍 **RAG Mode**: Generate test cases from user stories.\n💬 **Gemini Mode**: Ask QA questions.\n\nWhat would you like to do?",
  }])
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedModel, setSelectedModel] = useState<"gemini" | "rag">("rag")
  const [viewMode, setViewMode] = useState<"table" | "board">("board")
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showCompare, setShowCompare] = useState(false)
  const [compareStoryId, setCompareStoryId] = useState("")
  const [filterNoTC, setFilterNoTC] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [showBulkBar, setShowBulkBar] = useState(false)
  const [storyColumns, setStoryColumns] = useState<Record<string, KanbanCol>>({})
  const dragStoryId = useRef<string | null>(null)
  const dragOverCol = useRef<KanbanCol | null>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem("kanban-columns")
      if (saved) setStoryColumns(JSON.parse(saved))
    } catch {}
  }, [])

  useEffect(() => {
    setStoryColumns(prev => {
      const next = { ...prev }
      let changed = false
      stories.forEach(s => {
        if (!next[s.id]) { next[s.id] = "generated"; changed = true }
      })
      if (changed) {
        try { localStorage.setItem("kanban-columns", JSON.stringify(next)) } catch {}
        return next
      }
      return prev
    })
  }, [stories])

  const moveCard = (storyId: string, col: KanbanCol) => {
    setStoryColumns(prev => {
      const next = { ...prev, [storyId]: col }
      try { localStorage.setItem("kanban-columns", JSON.stringify(next)) } catch {}
      return next
    })
  }

  useEffect(() => {
    try {
      const saved = localStorage.getItem("recent-searches")
      if (saved) setRecentSearches(JSON.parse(saved).slice(0, 5))
    } catch {}
  }, [])

  useEffect(() => {
    if (uploadStatus?.type === "success") {
      const t = setTimeout(() => setUploadStatus(null), 5000)
      return () => clearTimeout(t)
    }
  }, [uploadStatus])

  useEffect(() => { fetchStories(currentPage, perPage) }, [currentPage, dateFilter, selectedProject, sortOrder])
  useEffect(() => { fetchProjects() }, [])

  const fetchStories = async (page = 1, pp = 10) => {
    try {
      setLoading(true)
      const res = await api.getStories(page, pp, dateFilter.from, dateFilter.to, selectedProject, sortOrder)
      if (res.stories && Array.isArray(res.stories)) {
        setStories(res.stories)
        setTotalPages(Math.ceil(res.pagination.total / res.pagination.per_page))
        setTotalStories(res.pagination.total)
        setCurrentPage(res.pagination.page)
      } else toast.error("Invalid response format")
    } catch { toast.error("Failed to fetch stories") }
    finally { setLoading(false) }
  }

  const fetchProjects = async () => {
    try { const r = await api.getProjects(); setProjects(r.projects) } catch {}
  }

  const openExportForStory = async (story: Story) => {
    setExportLoading(true)
    setShowExportDialog(true)
    try {
      const res = await api.getTestCases(story.id)
      const raw = (res as any)?.testcases
      setExportTestCases(Array.isArray(raw) ? raw : [])
    } catch { setExportTestCases([]) }
    finally { setExportLoading(false) }
  }

  const saveRecentSearch = (q: string) => {
    try {
      const updated = [q, ...recentSearches.filter(r => r !== q)].slice(0, 5)
      setRecentSearches(updated)
      localStorage.setItem("recent-searches", JSON.stringify(updated))
    } catch {}
  }

  const handleSearch = async () => {
    setLoading(true)
    if (formData.storyId.trim()) {
      saveRecentSearch(formData.storyId.trim())
      const filtered = stories.filter(s => s.id.toLowerCase() === formData.storyId.trim().toLowerCase())
      setStories(filtered)
      if (!filtered.length) toast.info("No stories found with that ID")
      setLoading(false); return
    }
    if (formData.storyDescription.trim()) {
      saveRecentSearch(formData.storyDescription.trim())
      try {
        const data = await api.searchStories(formData.storyDescription.trim(), 3)
        setStories(data.stories || [])
        if (!(data.stories || []).length) toast.info("No matching stories")
        else toast.success(`Found ${data.stories.length} match${data.stories.length > 1 ? "es" : ""}`)
      } catch { toast.error("Similarity search failed") }
      setLoading(false); return
    }
    fetchStories(currentPage, perPage)
    setLoading(false)
  }

  const handleClearFilters = () => {
    setDateFilter({ from: "", to: "" }); setSelectedProject("")
    setFormData(p => ({ ...p, storyId: "", storyDescription: "" }))
    fetchStories(1, perPage)
  }

  const handleDownload = async (storyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000"}/api/stories/testcases/download/${storyId}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `test_cases_${storyId}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("Downloaded")
    } catch { toast.error("Download failed") }
  }

  const handleUploadStory = async () => {
    const projectId = uploadForm.projectId === "new" ? newProjectName : uploadForm.projectId
    if (!projectId || !uploadForm.storyId || (!uploadForm.content && !uploadForm.file)) {
      setUploadStatus({ type: "error", message: "Fill in Project, Story ID and content/file." }); return
    }
    setIsUploading(true)
    setUploadStatus({ type: "info", message: "Uploading and generating test cases…" })
    try {
      const fd = new FormData()
      fd.append("project_id", projectId); fd.append("story_id", uploadForm.storyId); fd.append("content", uploadForm.content)
      if (uploadForm.file) fd.append("file", uploadForm.file)
      const res = await fetch("/api/upload-story", { method: "POST", body: fd })
      const result = await res.json()
      if (res.ok) {
        setUploadStatus({ type: "success", message: result.message || "Upload successful!" })
        setUploadForm({ projectId: "", storyId: "", content: "", file: null }); setNewProjectName("")
        fetchStories(); fetchProjects()
      } else setUploadStatus({ type: "error", message: result.error || "Upload failed" })
    } catch { setUploadStatus({ type: "error", message: "Network error. Try again." }) }
    finally { setIsUploading(false) }
  }

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isGenerating) return
    setChatMessages(p => [...p, { role: "user", content: message }]); setIsGenerating(true)
    try {
      const res = await fetch("/api/generate-test-cases", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, context: selectedModel === "rag" ? "Generate comprehensive test cases" : "QA support", model: selectedModel }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      if (selectedModel === "rag" && data.response) {
        const { parsed, cleaned } = cleanAndParseLLMResponse(data.response)
        setChatMessages(p => [...p, { role: "assistant", content: parsed && Array.isArray(parsed) ? formatRagTestCases(parsed) : cleaned || "[No output]" }])
      } else setChatMessages(p => [...p, { role: "assistant", content: data.response }])
    } catch {
      setChatMessages(p => [...p, { role: "assistant", content: "Connection error — check backend." }])
    } finally { setIsGenerating(false) }
  }

  const renderPagination = () => {
    if (totalPages <= 0) return null
    const range = 5
    let start = Math.max(1, currentPage - Math.floor(range / 2))
    let end = Math.min(totalPages, start + range - 1)
    if (end - start + 1 < range) start = Math.max(1, end - range + 1)
    const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i)
    const go = (n: number) => { if (n !== currentPage && n >= 1 && n <= totalPages) fetchStories(n, perPage) }
    const changePerPage = (n: number) => { setPerPage(n); fetchStories(1, n) }

    return (
      <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-background/50 rounded-b-xl">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalStories)} of {totalStories}
          </span>
          <select value={perPage} onChange={e => changePerPage(Number(e.target.value))}
            className="h-7 rounded-lg px-2 text-xs border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-cyan">
            {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v} / page</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(currentPage - 1)} disabled={currentPage === 1}
            className="h-7 w-7 rounded-lg flex items-center justify-center border border-border bg-card text-cyan disabled:opacity-30 hover:bg-accent/5 transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {start > 1 && <><button onClick={() => go(1)} className="h-7 min-w-[28px] px-1.5 rounded-lg text-xs border border-border bg-card text-cyan hover:bg-accent/5">1</button>{start > 2 && <span className="text-muted-foreground text-xs px-0.5">…</span>}</>}
          {pages.map(n => (
            <button key={n} onClick={() => go(n)}
              className="h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-medium transition-colors"
              style={currentPage === n ? { background: "#06B6D4", color: "#fff", border: "1px solid #06B6D4" } : { border: "1px solid #E2E8F0", background: "#fff", color: "#06B6D4" }}>
              {n}
            </button>
          ))}
          {end < totalPages && <>{end < totalPages - 1 && <span className="text-muted-foreground text-xs px-0.5">…</span>}<button onClick={() => go(totalPages)} className="h-7 min-w-[28px] px-1.5 rounded-lg text-xs border border-border bg-card text-cyan hover:bg-accent/5">{totalPages}</button></>}
          <button onClick={() => go(currentPage + 1)} disabled={currentPage === totalPages}
            className="h-7 w-7 rounded-lg flex items-center justify-center border border-border bg-card text-cyan disabled:opacity-30 hover:bg-accent/5 transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  const bulkMove = (col: KanbanCol) => {
    selectedCards.forEach(id => moveCard(id, col))
    setSelectedCards(new Set())
    setShowBulkBar(false)
    toast.success(`Moved ${selectedCards.size} stories to ${col}`)
  }

  const toggleCardSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCards(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      setShowBulkBar(next.size > 0)
      return next
    })
  }

  /* ─── shared style helpers ───────────────────────────────── */
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5"

  /* ═══════════════════════ RENDER ═══════════════════════════════ */
  return (
    <SidebarProvider>
      <AppSidebar
        projects={projects}
        selectedProject={selectedProject}
        onProjectChange={setSelectedProject}
        onUploadClick={() => setShowUpload(true)}
      />

      <SidebarInset>
        {/* ── Top bar ─────────────────────────────────────────── */}
        <header className="flex items-center justify-between h-14 px-5 border-b border-border bg-card sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-cyan" />
              <span className="font-semibold text-foreground">Stories</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCommandPalette(true)}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              <Command className="w-3.5 h-3.5" />
              <span>Search</span>
              <kbd className="text-[10px] px-1 py-0.5 rounded font-mono ml-1 bg-muted border border-border">⌘K</kbd>
            </button>
            <button
              onClick={() => setShowCompare(true)}
              className="h-8 px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 border border-border hover:bg-muted transition-colors text-muted-foreground"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />Compare
            </button>
            <Separator orientation="vertical" className="h-5" />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/stories/new")}
              className="h-8 px-4 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5"
              style={{ background: "#06B6D4" }}
            >
              <Plus className="w-3.5 h-3.5" />New Story
            </motion.button>
          </div>
        </header>

        {/* ── Main content ────────────────────────────────────── */}
        <div className="p-6 space-y-5 min-h-[calc(100vh-56px)]" style={{ background: "#F8FAFC" }}>

          {/* ── Search bar ───────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex items-center gap-3 px-4 rounded-xl transition-shadow bg-white border border-border"
            style={{ height: 52, boxShadow: "0 1px 4px rgba(15,23,42,0.06)" }}
            onFocus={e => (e.currentTarget.style.borderColor = "#06B6D4")}
            onBlur={e => (e.currentTarget.style.borderColor = "#E2E8F0")}
          >
            <Search className="w-4 h-4 flex-shrink-0 text-muted-foreground" style={{
              color: formData.storyId || formData.storyDescription ? "#06B6D4" : undefined,
            }} />
            <input
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground text-foreground"
              placeholder="Search by Story ID (e.g. PROJ-123) or describe a story…"
              value={formData.storyId || formData.storyDescription}
              onChange={e => {
                const v = e.target.value
                const looksLikeId = /^[A-Za-z]+-?\d*$/.test(v.trim()) && !v.includes(" ")
                if (looksLikeId || v === "") {
                  setFormData(p => ({ ...p, storyId: v, storyDescription: "" }))
                } else {
                  setFormData(p => ({ ...p, storyDescription: v, storyId: "" }))
                }
              }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
            />
            {(formData.storyId || formData.storyDescription) && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                style={formData.storyId
                  ? { background: "#ECFEFF", color: "#06B6D4" }
                  : { background: "#F3E8FF", color: "#7C3AED" }
                }>
                {formData.storyId ? "ID match" : "Similarity"}
              </span>
            )}
            {(formData.storyId || formData.storyDescription) && (
              <button onClick={() => { setFormData(p => ({ ...p, storyId: "", storyDescription: "" })); fetchStories(1, perPage) }}
                className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 hover:bg-muted text-muted-foreground transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={handleSearch}
              className="h-8 px-4 rounded-lg text-xs font-semibold text-white flex-shrink-0 hover:opacity-90 transition-opacity"
              style={{ background: "#06B6D4" }}>
              Search
            </button>
          </motion.div>

          {/* ── Recent searches ───────────────────────────────── */}
          <AnimatePresence>
            {recentSearches.length > 0 && !formData.storyId && !formData.storyDescription && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 flex-wrap"
              >
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Recent:</span>
                {recentSearches.map(q => (
                  <button key={q}
                    onClick={() => {
                      const looksLikeId = /^[A-Za-z]+-?\d*$/.test(q.trim()) && !q.includes(" ")
                      setFormData(p => looksLikeId
                        ? { ...p, storyId: q, storyDescription: "" }
                        : { ...p, storyDescription: q, storyId: "" })
                      setTimeout(handleSearch, 0)
                    }}
                    className="text-xs px-2.5 py-1 rounded-full border border-border bg-white text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                    {q}
                  </button>
                ))}
                <button onClick={() => { setRecentSearches([]); localStorage.removeItem("recent-searches") }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-1">
                  Clear
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Stats strip ──────────────────────────────────── */}
          {!loading && stories.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="grid grid-cols-4 gap-4"
            >
              {[
                { label: "Total Stories",    value: totalStories, icon: <Layers className="w-4 h-4" />,        color: "#06B6D4",  bg: "#ECFEFF",  border: "#A5F3FC" },
                { label: "Total Test Cases", value: stories.reduce((a, s) => a + (s.test_case_count || 0), 0), icon: <FileText className="w-4 h-4" />, color: "#10B981",  bg: "#ECFDF5",  border: "#A7F3D0" },
                { label: "Projects",         value: projects.length, icon: <Users className="w-4 h-4" />,      color: "#7C3AED",  bg: "#F3E8FF",  border: "#C4B5FD" },
                { label: "No Test Cases",    value: stories.filter(s => !s.test_case_count).length, icon: <AlertTriangle className="w-4 h-4" />, color: "#F59E0B", bg: "#FFFBEB", border: "#FDE68A", clickable: true },
              ].map(stat => (
                <motion.div
                  key={stat.label}
                  whileHover={stat.clickable ? { scale: 1.01 } : undefined}
                  onClick={stat.clickable ? () => setFilterNoTC(f => !f) : undefined}
                  className={`rounded-xl px-5 py-4 flex items-center gap-3 border bg-white transition-all ${stat.clickable ? "cursor-pointer" : ""}`}
                  style={{
                    border: `1px solid ${filterNoTC && stat.clickable ? stat.color : stat.border}`,
                    boxShadow: "0 1px 3px rgba(15,23,42,0.06)",
                  }}
                >
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: stat.bg, color: stat.color }}>
                    {stat.icon}
                  </div>
                  <div>
                    <div className="text-2xl font-bold leading-tight" style={{ color: stat.color }}>{stat.value}</div>
                    <div className="text-[11px] font-medium text-muted-foreground leading-tight mt-0.5">{stat.label}</div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* ── Filter bar ──────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border px-5 py-4" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
            <div className="flex items-end flex-wrap gap-4">
              <div>
                <label className={labelCls}>From Date</label>
                <Input type="date" value={dateFilter.from}
                  onChange={e => setDateFilter(d => ({ ...d, from: e.target.value }))}
                  className="h-9 rounded-lg text-sm w-40" />
              </div>
              <div>
                <label className={labelCls}>To Date</label>
                <Input type="date" value={dateFilter.to}
                  onChange={e => setDateFilter(d => ({ ...d, to: e.target.value }))}
                  className="h-9 rounded-lg text-sm w-40" />
              </div>
              <button onClick={() => fetchStories(currentPage, perPage)}
                className="h-9 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: "#06B6D4" }}>
                <Calendar className="w-3.5 h-3.5" />Apply
              </button>
              <div className="w-px h-8 bg-border self-end" />
              <div>
                <label className={labelCls}>Sort</label>
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "desc" | "asc")}
                  className="h-9 rounded-lg px-3 text-sm border border-border bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-cyan">
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>
              <button onClick={() => fetchStories(currentPage, perPage)}
                className="h-9 px-4 rounded-lg text-sm font-semibold border border-border bg-white text-foreground flex items-center gap-2 hover:bg-muted transition-colors self-end">
                <RefreshCw className="w-3.5 h-3.5" />Refresh
              </button>
              <button onClick={handleClearFilters}
                className="h-9 px-4 rounded-lg text-sm font-semibold border border-border bg-white text-muted-foreground flex items-center gap-2 hover:bg-muted transition-colors self-end">
                <X className="w-3.5 h-3.5" />Clear All
              </button>
            </div>
          </div>

          {/* ── Results header + view toggle ─────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <SlidersHorizontal className="w-4 h-4 text-cyan" />
                <span className="font-semibold text-sm text-foreground">Results</span>
                {!loading && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#ECFEFF] text-cyan">
                    {filterNoTC ? stories.filter(s => !s.test_case_count).length : totalStories}
                  </span>
                )}
                {filterNoTC && (
                  <button
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold cursor-pointer"
                    style={{ background: "#FFFBEB", color: "#F59E0B", border: "1px solid #FDE68A" }}
                    onClick={() => setFilterNoTC(false)}>
                    <AlertTriangle className="w-3 h-3" />No test cases only<X className="w-3 h-3 ml-0.5" />
                  </button>
                )}
                {showBulkBar && selectedCards.size > 0 && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-2 ml-2 px-3 py-1 rounded-lg bg-foreground"
                  >
                    <span className="text-[11px] font-semibold text-white">{selectedCards.size} selected</span>
                    <span className="text-muted-foreground text-[11px]">Move to:</span>
                    {COLS.map(c => (
                      <button key={c.id} onClick={() => bulkMove(c.id)}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors hover:opacity-80"
                        style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                        {c.label}
                      </button>
                    ))}
                    <button onClick={() => { setSelectedCards(new Set()); setShowBulkBar(false) }}
                      className="text-muted-foreground hover:text-white ml-1">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                )}
              </div>

              {/* View toggle */}
              <div className="flex items-center rounded-lg border border-border bg-white p-0.5">
                {([
                  { mode: "board" as const, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Board" },
                  { mode: "table" as const, icon: <List className="w-3.5 h-3.5" />, label: "Table" },
                ]).map(v => (
                  <button key={v.mode} onClick={() => setViewMode(v.mode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all"
                    style={viewMode === v.mode
                      ? { background: "#0F172A", color: "#fff" }
                      : { color: "#64748B" }}>
                    {v.icon}{v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TABLE ──────────────────────────────────────── */}
            {viewMode === "table" && (
              <div className="bg-white rounded-xl border border-border overflow-hidden" style={{ boxShadow: "0 1px 3px rgba(15,23,42,0.06)" }}>
                {loading ? (
                  <div className="py-16 text-center">
                    <div className="inline-flex items-center gap-3 text-sm font-semibold text-cyan">
                      <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                      Loading stories…
                    </div>
                  </div>
                ) : stories.length === 0 ? (
                  <div className="py-20 text-center">
                    <BookOpen className="w-10 h-10 text-border mx-auto mb-3" />
                    <p className="text-sm font-medium text-foreground mb-1">No stories yet</p>
                    <p className="text-sm text-muted-foreground mb-4">Upload your first requirement to get started.</p>
                    <button onClick={() => setShowUpload(true)}
                      className="px-4 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                      style={{ background: "#06B6D4" }}>
                      + New Story
                    </button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: "#0F172A" }}>
                          {[
                            { label: "Story ID",        w: 120 },
                            { label: "Description",     w: 200 },
                            { label: "Content",         w: 200 },
                            { label: "Test Cases",      w: 130, center: true },
                            { label: "Impact Analysis", w: 140, center: true },
                            { label: "Generated",       w: 140, center: true },
                            { label: "Actions",         w: 100, center: true },
                          ].map(col => (
                            <th key={col.label} style={{ minWidth: col.w }}
                              className={`py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-white ${col.center ? "text-center" : "text-left"}`}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(filterNoTC ? stories.filter(s => !s.test_case_count) : stories).map((story, i) => (
                          <tr key={story.id || i}
                            onClick={() => { setPreviewStory(story); setShowPreview(true) }}
                            className="cursor-pointer border-b border-border transition-colors"
                            style={{ background: i % 2 === 0 ? "#ffffff" : "#F8FAFC" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#ECFEFF")}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#F8FAFC")}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan flex-shrink-0" />
                                <span className="text-sm font-semibold text-foreground truncate max-w-[100px]">{story.id}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <p className="text-sm text-muted-foreground line-clamp-2">{story.description || "—"}</p>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <p className="text-sm text-muted-foreground line-clamp-2">{story.doc_content_text || "—"}</p>
                            </td>
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              <button onClick={() => router.push(`/test-cases/${story.id}`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: "#ECFEFF", color: "#06B6D4", border: "1px solid #A5F3FC" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#CFFAFE")}
                                onMouseLeave={e => (e.currentTarget.style.background = "#ECFEFF")}>
                                <FileText className="w-3.5 h-3.5" />{story.test_case_count || 0} Cases
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              {typeof story.impactedTestCases === "number" ? (
                                <button onClick={() => router.push(`/story-details/${story.id}?project_id=${story.project_id}`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                  style={{ background: "#FFFBEB", color: "#F59E0B", border: "1px solid #FDE68A" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "#FEF3C7")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "#FFFBEB")}>
                                  <Brain className="w-3.5 h-3.5" />{story.impactedTestCases} Impacted
                                </button>
                              ) : <span className="text-xs text-muted-foreground italic">—</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {story.test_case_created_time ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-xs font-medium text-foreground">
                                    {new Date(story.test_case_created_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <span className="text-[11px] text-muted-foreground">
                                    {new Date(story.test_case_created_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                  </span>
                                </div>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </td>
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              <button onClick={e => handleDownload(story.id, e)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#D1FAE5")}
                                onMouseLeave={e => (e.currentTarget.style.background = "#ECFDF5")}>
                                <Download className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {renderPagination()}
                  </div>
                )}
              </div>
            )}

            {/* ── KANBAN BOARD ───────────────────────────────── */}
            {viewMode === "board" && (
              <>
                {loading ? (
                  <div className="py-16 text-center">
                    <div className="inline-flex items-center gap-3 text-sm font-semibold text-cyan">
                      <div className="w-5 h-5 border-2 border-cyan border-t-transparent rounded-full animate-spin" />
                      Loading stories…
                    </div>
                  </div>
                ) : stories.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="py-20 text-center bg-white rounded-xl border border-border"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ background: "#ECFEFF" }}>
                      <BookOpen className="w-7 h-7 text-cyan" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">No stories yet.</p>
                    <p className="text-sm text-muted-foreground mb-5">Upload your first requirement.</p>
                    <button onClick={() => setShowUpload(true)}
                      className="px-5 py-2.5 rounded-lg text-sm font-semibold text-white hover:opacity-90 transition-opacity"
                      style={{ background: "#06B6D4" }}>
                      + New Story
                    </button>
                  </motion.div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 items-start">
                    {COLS.map(col => {
                      const colStories = (filterNoTC ? stories.filter(s => !s.test_case_count) : stories)
                        .filter(s => (storyColumns[s.id] || "generated") === col.id)
                      return (
                        <div key={col.id}
                          onDragOver={e => { e.preventDefault(); dragOverCol.current = col.id }}
                          onDrop={() => {
                            if (dragStoryId.current && dragOverCol.current) {
                              moveCard(dragStoryId.current, dragOverCol.current)
                              dragStoryId.current = null; dragOverCol.current = null
                            }
                          }}
                          className="rounded-xl flex flex-col min-h-[180px] bg-white border"
                          style={{ borderColor: col.border }}
                        >
                          {/* Column header */}
                          <div className="flex items-center justify-between px-4 py-3 rounded-t-xl"
                            style={{ borderBottom: `1px solid ${col.border}`, background: col.bg }}>
                            <div className="flex items-center gap-2" style={{ color: col.color }}>
                              {col.icon}
                              <span className="font-bold text-sm">{col.label}</span>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white"
                              style={{ color: col.color, border: `1px solid ${col.border}` }}>
                              {colStories.length}
                            </span>
                          </div>

                          {/* Cards */}
                          <div className="flex flex-col gap-2.5 p-3 flex-1">
                            {colStories.length === 0 && (
                              <div className="flex items-center justify-center py-10 text-xs font-medium rounded-lg"
                                style={{ color: col.color, opacity: 0.5, border: `1.5px dashed ${col.border}` }}>
                                Drop stories here
                              </div>
                            )}
                            {colStories.map(story => (
                              <motion.div
                                key={story.id}
                                layout
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                draggable
                                onDragStart={() => { dragStoryId.current = story.id }}
                                onDragEnd={() => { dragStoryId.current = null }}
                                onClick={() => { setPreviewStory(story); setShowPreview(true) }}
                                className="group rounded-xl bg-white cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-md"
                                style={{
                                  border: selectedCards.has(story.id) ? `2px solid #06B6D4` : "1px solid #E2E8F0",
                                  boxShadow: selectedCards.has(story.id) ? "0 0 0 3px rgba(6,182,212,0.15)" : "0 1px 3px rgba(15,23,42,0.06)",
                                }}
                              >
                                {/* Card header */}
                                <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div
                                      onClick={e => toggleCardSelect(story.id, e)}
                                      className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 transition-colors cursor-pointer"
                                      style={selectedCards.has(story.id)
                                        ? { background: "#06B6D4", borderColor: "#06B6D4" }
                                        : { background: "#ffffff", borderColor: "#E2E8F0" }}
                                    >
                                      {selectedCards.has(story.id) && <CheckCircle2 className="w-2.5 h-2.5 text-white" />}
                                    </div>
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                                    <span className="text-xs font-bold text-foreground truncate">{story.id}</span>
                                    {story.project_id && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 bg-muted text-muted-foreground border border-border">
                                        {story.project_id}
                                      </span>
                                    )}
                                  </div>
                                  <GripVertical className="w-3.5 h-3.5 text-border flex-shrink-0" />
                                </div>

                                {/* Description */}
                                <div className="px-3.5 pb-2.5">
                                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                    {story.description || "No description."}
                                  </p>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-1.5 px-3.5 pb-2.5">
                                  <button onClick={e => { e.stopPropagation(); router.push(`/test-cases/${story.id}`) }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold hover:opacity-80 transition-opacity"
                                    style={{ background: "#ECFEFF", color: "#06B6D4", border: "1px solid #A5F3FC" }}>
                                    <FileText className="w-2.5 h-2.5" />{story.test_case_count || 0}
                                  </button>
                                  {typeof story.impactedTestCases === "number" && story.impactedTestCases > 0 && (
                                    <button onClick={e => { e.stopPropagation(); router.push(`/story-details/${story.id}?project_id=${story.project_id}`) }}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold hover:opacity-80 transition-opacity"
                                      style={{ background: "#FFFBEB", color: "#F59E0B", border: "1px solid #FDE68A" }}>
                                      <Brain className="w-2.5 h-2.5" />{story.impactedTestCases}↑
                                    </button>
                                  )}
                                  {story.test_case_created_time && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                      {new Date(story.test_case_created_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>

                                {/* Hover actions */}
                                <div className="hidden group-hover:flex items-center gap-1.5 px-3.5 pb-3 pt-2 border-t border-border">
                                  <span className="text-[10px] text-muted-foreground">Move:</span>
                                  {COLS.filter(c => c.id !== col.id).map(c => (
                                    <button key={c.id}
                                      onClick={e => { e.stopPropagation(); moveCard(story.id, c.id) }}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95"
                                      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                                      {c.label}
                                    </button>
                                  ))}
                                  <button onClick={e => { e.stopPropagation(); handleDownload(story.id, e) }}
                                    className="ml-auto w-5 h-5 rounded-lg flex items-center justify-center hover:opacity-80 transition-colors"
                                    style={{ background: "#ECFDF5", color: "#10B981", border: "1px solid #A7F3D0" }}>
                                    <Download className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </SidebarInset>

      {/* ═══════ STORY PREVIEW SHEET ═══════ */}
      <Sheet open={showPreview} onOpenChange={setShowPreview}>
        <SheetContent side="right" className="w-[480px] p-0 flex flex-col gap-0 border-l border-border">
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F172A" }}>
            <SheetHeader>
              <SheetTitle className="text-white text-base font-bold flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(6,182,212,0.2)" }}>
                  <FileText className="w-3.5 h-3.5 text-cyan" />
                </div>
                {previewStory?.id}
              </SheetTitle>
              <SheetDescription className="text-sm" style={{ color: "#64748B" }}>Story Details</SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">AI-Generated Description</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#EEF2FF] text-[#4F46E5]">AI</span>
              </div>
              <div className="rounded-xl p-4 bg-white border border-border">
                <p className="text-sm text-foreground leading-relaxed">{previewStory?.description || "No description available."}</p>
              </div>
            </div>

            {previewStory?.doc_content_text && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Story Content</div>
                <div className="rounded-xl p-4 bg-white border border-border max-h-48 overflow-y-auto">
                  <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{previewStory.doc_content_text}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3.5 bg-white border border-border">
                <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">Test Cases</div>
                <div className="text-xl font-bold text-cyan">{previewStory?.test_case_count || 0}</div>
              </div>
              <div className="rounded-xl p-3.5 bg-white border border-border">
                <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">Impacted</div>
                <div className="text-xl font-bold text-warning">
                  {typeof previewStory?.impactedTestCases === "number" ? previewStory.impactedTestCases : "—"}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 flex-shrink-0 border-t border-border bg-white space-y-2.5">
            <button onClick={() => { setShowPreview(false); router.push(`/stories/${previewStory?.id}`) }}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: "#0F172A" }}>
              <ExternalLink className="w-4 h-4" />Open Story Workspace
            </button>
            <button onClick={() => { setShowPreview(false); router.push(`/test-cases/${previewStory?.id}`) }}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: "#06B6D4" }}>
              <FileText className="w-4 h-4" />View Test Cases
            </button>
            {typeof previewStory?.impactedTestCases === "number" && (
              <button onClick={() => { setShowPreview(false); router.push(`/story-details/${previewStory?.id}?project_id=${previewStory?.project_id}`) }}
                className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-[#FDE68A]"
                style={{ background: "#FFFBEB", color: "#F59E0B" }}>
                <Brain className="w-4 h-4" />View Impact Analysis
              </button>
            )}
            <button onClick={() => { if (previewStory) handleDownload(previewStory.id) }}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-border bg-white text-foreground hover:bg-muted">
              <Download className="w-4 h-4" />Download Excel
            </button>
            <button onClick={() => { if (previewStory) openExportForStory(previewStory) }}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-border bg-white text-foreground hover:bg-muted">
              <Code2 className="w-4 h-4" />{exportLoading ? "Loading…" : "Export as Test Script"}
            </button>
            <button onClick={() => { if (previewStory) { setCompareStoryId(previewStory.id); setShowPreview(false); setShowCompare(true) } }}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-border bg-white text-muted-foreground hover:bg-muted">
              <ArrowLeftRight className="w-4 h-4" />Compare with Another Story
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════ UPLOAD STORY SHEET ═══════ */}
      <Sheet open={showUpload} onOpenChange={setShowUpload}>
        <SheetContent side="right" className="w-[480px] p-0 flex flex-col gap-0 border-l border-border">
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F172A" }}>
            <SheetHeader>
              <SheetTitle className="text-white text-base font-bold flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(6,182,212,0.2)" }}>
                  <FileText className="w-3.5 h-3.5 text-cyan" />
                </div>
                New Story
              </SheetTitle>
              <SheetDescription className="text-sm" style={{ color: "#64748B" }}>
                Upload a requirement to auto-generate test cases
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-background">
            <div>
              <label className={labelCls}>Project *</label>
              <select value={uploadForm.projectId} onChange={e => setUploadForm(p => ({ ...p, projectId: e.target.value }))}
                className="w-full h-9 rounded-lg px-3 text-sm border border-border bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-cyan">
                <option value="">Select a project</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="new">+ Create New Project</option>
              </select>
              {uploadForm.projectId === "new" && (
                <Input placeholder="New project name" value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="mt-2 h-9 rounded-lg text-sm" />
              )}
            </div>

            <div>
              <label className={labelCls}>Story ID *</label>
              <Input placeholder="e.g. AUTH-001" value={uploadForm.storyId}
                onChange={e => setUploadForm(p => ({ ...p, storyId: e.target.value }))}
                className="h-9 rounded-lg text-sm" />
            </div>

            <div>
              <label className={labelCls}>Story Content *</label>
              <Textarea placeholder="As a user, I want to… So that…" rows={6} value={uploadForm.content}
                onChange={e => setUploadForm(p => ({ ...p, content: e.target.value }))}
                className="rounded-lg text-sm resize-none" />
            </div>

            <div>
              <label className={labelCls}>Or Upload File</label>
              <label htmlFor="file-upload"
                className="flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed border-border bg-white cursor-pointer hover:border-cyan hover:bg-[#ECFEFF] transition-colors">
                <FileText className="w-4 h-4 text-cyan" />
                <span className="text-sm text-muted-foreground">
                  {uploadForm.file ? uploadForm.file.name : "PDF, DOCX or TXT"}
                </span>
                {uploadForm.file && (
                  <button onClick={e => { e.preventDefault(); setUploadForm(p => ({ ...p, file: null })) }}
                    className="ml-auto text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </label>
              <input id="file-upload" type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={e => setUploadForm(p => ({ ...p, file: e.target.files?.[0] || null }))} />
            </div>

            {uploadStatus && (
              <div className="flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium"
                style={{
                  background: uploadStatus.type === "success" ? "#ECFDF5" : uploadStatus.type === "error" ? "#FEF2F2" : "#ECFEFF",
                  border: `1px solid ${uploadStatus.type === "success" ? "#A7F3D0" : uploadStatus.type === "error" ? "#FCA5A5" : "#A5F3FC"}`,
                  color: uploadStatus.type === "success" ? "#065F46" : uploadStatus.type === "error" ? "#991B1B" : "#0E7490",
                }}>
                {uploadStatus.message}
                <button onClick={() => setUploadStatus(null)} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>

          <div className="p-5 flex-shrink-0 border-t border-border bg-white">
            <button onClick={handleUploadStory}
              disabled={isUploading || (uploadForm.projectId === "new" ? !newProjectName : !uploadForm.projectId) || !uploadForm.storyId || (!uploadForm.content && !uploadForm.file)}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#06B6D4" }}>
              {isUploading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
                : <><Zap className="w-4 h-4" />Generate Test Cases</>}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <Chatbot onSendMessage={handleSendMessage} chatMessages={chatMessages} isGenerating={isGenerating}
        selectedModel={selectedModel} onModelChange={m => setSelectedModel(m)} />

      <ExportScriptDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        storyId={previewStory?.id || ""}
        testCases={exportTestCases}
      />

      <CommandPalette
        open={showCommandPalette}
        onOpenChange={setShowCommandPalette}
        stories={stories}
        onSelectStory={s => { setPreviewStory(s); setShowPreview(true) }}
      />

      <StoryCompareDialog
        open={showCompare}
        onOpenChange={setShowCompare}
        stories={stories}
        initialStoryId={compareStoryId}
      />
    </SidebarProvider>
  )
}
