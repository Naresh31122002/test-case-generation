"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Search, FileText, Download, Brain, Calendar,
  RefreshCw, ChevronLeft, ChevronRight, X, Eye,
  Clock, SlidersHorizontal, LayoutDashboard,
  LayoutGrid, List, GripVertical, CheckCircle2,
  AlertCircle, Circle, Code2,
} from "lucide-react"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import { api, Story } from "@/lib/api"
import { toast } from "sonner"
import { Chatbot } from "@/components/chatbot"
import { ExportScriptDialog } from "@/components/export-script-dialog"
import { TestCase } from "@/lib/api"

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

/* ─── component ─────────────────────────────────────────────── */
export default function TestCaseGenerator() {
  const router = useRouter()

  /* search form */
  const [formData, setFormData] = useState<FormData>({ storyId: "", storyDescription: "", createdDate: "", fromDate: "", toDate: "" })
  const [dateFilter, setDateFilter] = useState({ from: "", to: "" })

  /* table */
  const [stories, setStories] = useState<Story[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalStories, setTotalStories] = useState(0)
  const [perPage, setPerPage] = useState(10)
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc")

  /* project filter */
  const [projects, setProjects] = useState<string[]>([])
  const [selectedProject, setSelectedProject] = useState("")

  /* story preview sheet */
  const [previewStory, setPreviewStory] = useState<Story | null>(null)
  const [showPreview, setShowPreview] = useState(false)

  /* export script — lazy-loaded test cases for preview story */
  const [showExportDialog, setShowExportDialog] = useState(false)
  const [exportTestCases, setExportTestCases] = useState<TestCase[]>([])
  const [exportLoading, setExportLoading] = useState(false)

  const openExportForStory = async (story: Story) => {
    setExportLoading(true)
    setShowExportDialog(true)
    try {
      const res = await api.getTestCases(story.id)
      const raw = (res as any)?.testcases
      setExportTestCases(Array.isArray(raw) ? raw : [])
    } catch {
      setExportTestCases([])
    } finally {
      setExportLoading(false)
    }
  }

  /* upload sheet */
  const [showUpload, setShowUpload] = useState(false)
  const [uploadForm, setUploadForm] = useState({ projectId: "", storyId: "", content: "", file: null as File | null })
  const [newProjectName, setNewProjectName] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null)

  /* clock */
  const [currentTime, setCurrentTime] = useState("")

  /* chatbot */
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([{
    role: "assistant",
    content: "Hello! I'm your AI Test Case Assistant.\n\n🔍 **RAG Mode**: Generate test cases from user stories.\n💬 **Gemini Mode**: Ask QA questions.\n\nWhat would you like to do?",
  }])
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedModel, setSelectedModel] = useState<"gemini" | "rag">("rag")

  /* ── view toggle ── */
  const [viewMode, setViewMode] = useState<"table" | "board">("board")

  /* ── kanban column state (persisted to localStorage) ── */
  type KanbanCol = "generated" | "review" | "approved"
  const COLS: { id: KanbanCol; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
    { id: "generated", label: "Generated",   icon: <Circle className="w-3.5 h-3.5" />,      color: "#377ACF", bg: "#f0f6ff", border: "#bfdbfe" },
    { id: "review",    label: "Under Review", icon: <AlertCircle className="w-3.5 h-3.5" />, color: "#b45309", bg: "#fffbeb", border: "#fde68a" },
    { id: "approved",  label: "Approved",     icon: <CheckCircle2 className="w-3.5 h-3.5" />,color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  ]

  const [storyColumns, setStoryColumns] = useState<Record<string, KanbanCol>>({})
  const dragStoryId = useRef<string | null>(null)
  const dragOverCol = useRef<KanbanCol | null>(null)

  /* load persisted column state */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("kanban-columns")
      if (saved) setStoryColumns(JSON.parse(saved))
    } catch {}
  }, [])

  /* when stories load, assign any new ones to "generated" */
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

  /* ── effects ── */
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000)
    setCurrentTime(new Date().toLocaleTimeString())
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (uploadStatus?.type === "success") {
      const t = setTimeout(() => setUploadStatus(null), 5000)
      return () => clearTimeout(t)
    }
  }, [uploadStatus])

  useEffect(() => { fetchStories(currentPage, perPage) }, [currentPage, dateFilter, selectedProject, sortOrder])
  useEffect(() => { fetchProjects() }, [])

  /* ── data ── */
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

  /* ── search ── */
  const handleSearch = async () => {
    setLoading(true)
    if (formData.storyId.trim()) {
      const filtered = stories.filter(s => s.id.toLowerCase() === formData.storyId.trim().toLowerCase())
      setStories(filtered)
      if (!filtered.length) toast.info("No stories found with that ID")
      setLoading(false); return
    }
    if (formData.storyDescription.trim()) {
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

  const handleDateFilter = async () => {
    setLoading(true)
    try {
      const data = await api.getStories(currentPage, perPage, dateFilter.from, dateFilter.to)
      setStories(data.stories || []); setTotalPages(data.total_pages || 1)
    } finally { setLoading(false) }
  }

  const handleClearFilters = () => {
    setDateFilter({ from: "", to: "" }); setSelectedProject("")
    setFormData(p => ({ ...p, storyId: "", storyDescription: "" }))
    fetchStories(1, perPage)
  }

  /* ── download ── */
  const handleDownload = async (storyId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      const res = await fetch(`http://127.0.0.1:5000/api/stories/testcases/download/${storyId}`)
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a"); a.href = url; a.download = `test_cases_${storyId}.xlsx`
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url)
      toast.success("Downloaded")
    } catch { toast.error("Download failed") }
  }

  /* ── upload ── */
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

  /* ── chatbot ── */
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

  /* ── pagination ── */
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
      <div className="flex items-center justify-between px-5 py-3 border-t border-[#eef2f8] bg-[#F6F8FB] rounded-b-2xl">
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#5a7ca0]">
            {((currentPage - 1) * perPage) + 1}–{Math.min(currentPage * perPage, totalStories)} of {totalStories}
          </span>
          <select value={perPage} onChange={e => changePerPage(Number(e.target.value))}
            className="h-7 rounded-lg px-2 text-xs border border-[#dde6f0] bg-white text-[#1a2540] focus:outline-none focus:ring-2 focus:ring-[#377ACF]/20">
            {[5, 10, 20, 50].map(v => <option key={v} value={v}>{v} / page</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => go(currentPage - 1)} disabled={currentPage === 1}
            className="h-7 w-7 rounded-lg flex items-center justify-center border border-[#dde6f0] bg-white text-[#377ACF] disabled:opacity-30 hover:bg-[#f0f6ff] transition-colors">
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          {start > 1 && <><button onClick={() => go(1)} className="h-7 min-w-[28px] px-1.5 rounded-lg text-xs border border-[#dde6f0] bg-white text-[#377ACF] hover:bg-[#f0f6ff]">1</button>{start > 2 && <span className="text-[#b0c4d8] text-xs px-0.5">…</span>}</>}
          {pages.map(n => (
            <button key={n} onClick={() => go(n)}
              className="h-7 min-w-[28px] px-1.5 rounded-lg text-xs font-medium transition-colors"
              style={currentPage === n ? { background: "#377ACF", color: "#fff", border: "1px solid #377ACF" } : { border: "1px solid #dde6f0", background: "#fff", color: "#377ACF" }}>
              {n}
            </button>
          ))}
          {end < totalPages && <>{end < totalPages - 1 && <span className="text-[#b0c4d8] text-xs px-0.5">…</span>}<button onClick={() => go(totalPages)} className="h-7 min-w-[28px] px-1.5 rounded-lg text-xs border border-[#dde6f0] bg-white text-[#377ACF] hover:bg-[#f0f6ff]">{totalPages}</button></>}
          <button onClick={() => go(currentPage + 1)} disabled={currentPage === totalPages}
            className="h-7 w-7 rounded-lg flex items-center justify-center border border-[#dde6f0] bg-white text-[#377ACF] disabled:opacity-30 hover:bg-[#f0f6ff] transition-colors">
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    )
  }

  /* ─── shared style helpers ──────────────────────────────────── */
  const labelCls = "block text-[11px] font-semibold uppercase tracking-wide text-[#5a7ca0] mb-1.5"
  const inputStyle = { borderColor: "#c8d8eb" }

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
        <header className="flex items-center justify-between h-14 px-5 border-b border-[#eef2f8] bg-white sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <SidebarTrigger className="text-[#5a7ca0] hover:text-[#0F162B]" />
            <Separator orientation="vertical" className="h-5" />
            <div className="flex items-center gap-2 text-sm text-[#5a7ca0]">
              <LayoutDashboard className="w-4 h-4" />
              <span className="font-semibold text-[#0F162B]">Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-sm font-bold text-[#0F162B]">
            <Clock className="w-4 h-4 text-[#377ACF]" />
            {currentTime || "—"}
          </div>
        </header>

        {/* ── Main content ────────────────────────────────────── */}
        <div className="p-6 space-y-6 min-h-[calc(100vh-56px)]" style={{ background: "#F6F8FB" }}>

          {/* ── Search panel ──────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm overflow-hidden">
            {/* panel header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#eef2f8]">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-[#377ACF]" />
                <span className="font-semibold text-sm text-[#0F162B]">Search User Stories</span>
              </div>
              <button
                onClick={() => { setFormData(p => ({ ...p, storyId: "", storyDescription: "" })); fetchStories(1, perPage) }}
                className="text-xs text-[#5a7ca0] hover:text-[#377ACF] transition-colors"
              >
                Clear
              </button>
            </div>
            <div className="p-5 grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Story ID</label>
                <Input placeholder="e.g. PROJ-123" value={formData.storyId}
                  onChange={e => setFormData(p => ({ ...p, storyId: e.target.value }))}
                  onKeyDown={e => e.key === "Enter" && handleSearch()}
                  className="h-9 rounded-xl text-sm" style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>Story Description</label>
                <Textarea placeholder="Search by description similarity…" rows={1} value={formData.storyDescription}
                  onChange={e => setFormData(p => ({ ...p, storyDescription: e.target.value }))}
                  className="rounded-xl text-sm resize-none" style={inputStyle} />
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 pb-4 pt-0">
              <button onClick={handleSearch}
                className="h-9 px-5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: "#377ACF" }}>
                <Search className="w-3.5 h-3.5" /> Search
              </button>
            </div>
          </div>

          {/* ── Filter bar ─────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm px-5 py-4">
            <div className="flex items-end flex-wrap gap-4">
              <div>
                <label className={labelCls}>From Date</label>
                <Input type="date" value={dateFilter.from}
                  onChange={e => setDateFilter(d => ({ ...d, from: e.target.value }))}
                  className="h-9 rounded-xl text-sm w-40" style={inputStyle} />
              </div>
              <div>
                <label className={labelCls}>To Date</label>
                <Input type="date" value={dateFilter.to}
                  onChange={e => setDateFilter(d => ({ ...d, to: e.target.value }))}
                  className="h-9 rounded-xl text-sm w-40" style={inputStyle} />
              </div>
              <button onClick={handleDateFilter}
                className="h-9 px-4 rounded-xl text-sm font-semibold text-white flex items-center gap-2 hover:opacity-90 transition-opacity"
                style={{ background: "#377ACF" }}>
                <Calendar className="w-3.5 h-3.5" /> Apply
              </button>

              <div className="w-px h-8 bg-[#eef2f8] self-end" />

              <div>
                <label className={labelCls}>Sort</label>
                <select value={sortOrder} onChange={e => setSortOrder(e.target.value as "desc" | "asc")}
                  className="h-9 rounded-xl px-3 text-sm border border-[#c8d8eb] bg-white text-[#1a2540] focus:outline-none focus:ring-2 focus:ring-[#377ACF]/20">
                  <option value="desc">Newest First</option>
                  <option value="asc">Oldest First</option>
                </select>
              </div>

              <button onClick={() => fetchStories(currentPage, perPage)}
                className="h-9 px-4 rounded-xl text-sm font-semibold border border-[#c8d8eb] bg-white text-[#377ACF] flex items-center gap-2 hover:bg-[#f0f6ff] transition-colors self-end">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button onClick={handleClearFilters}
                className="h-9 px-4 rounded-xl text-sm font-semibold border border-[#c8d8eb] bg-white text-[#5a7ca0] flex items-center gap-2 hover:bg-[#f0f6ff] transition-colors self-end">
                <X className="w-3.5 h-3.5" /> Clear All
              </button>
            </div>
          </div>

          {/* ── Results: view-toggle header + Table / Board ─── */}
          <div>
            {/* Header row with toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#377ACF]" />
                <span className="font-semibold text-sm text-[#0F162B]">Results</span>
                {!loading && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#f0f6ff] text-[#377ACF]">
                    {totalStories}
                  </span>
                )}
              </div>
              {/* View toggle pill */}
              <div className="flex items-center rounded-xl border border-[#dde6f0] bg-white p-0.5">
                {([
                  { mode: "board" as const, icon: <LayoutGrid className="w-3.5 h-3.5" />, label: "Board" },
                  { mode: "table" as const, icon: <List className="w-3.5 h-3.5" />, label: "Table" },
                ]).map(v => (
                  <button key={v.mode} onClick={() => setViewMode(v.mode)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-xs font-semibold transition-all"
                    style={viewMode === v.mode ? { background: "#0F162B", color: "#fff" } : { color: "#5a7ca0" }}>
                    {v.icon}{v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ── TABLE ──────────────────────────────────────── */}
            {viewMode === "table" && (
              <div className="bg-white rounded-2xl border border-[#dde6f0] shadow-sm overflow-hidden">
                {loading ? (
                  <div className="py-16 text-center">
                    <div className="inline-flex items-center gap-3 text-sm font-semibold text-[#377ACF]">
                      <div className="w-5 h-5 border-2 border-[#377ACF] border-t-transparent rounded-full animate-spin" />
                      Loading stories…
                    </div>
                  </div>
                ) : stories.length === 0 ? (
                  <div className="py-16 text-center text-sm text-[#9ca3af]">No stories found. Try adjusting your filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ background: "#0F162B" }}>
                          {[
                            { label: "Story ID", w: 120 },
                            { label: "Description", w: 200 },
                            { label: "Content", w: 200 },
                            { label: "Test Cases", w: 130, center: true },
                            { label: "Impact Analysis", w: 140, center: true },
                            { label: "Generated", w: 140, center: true },
                            { label: "Actions", w: 100, center: true },
                          ].map(col => (
                            <th key={col.label} style={{ minWidth: col.w }}
                              className={`py-3 px-4 text-[11px] font-semibold uppercase tracking-wider text-white ${col.center ? "text-center" : "text-left"}`}>
                              {col.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {stories.map((story, i) => (
                          <tr key={story.id || i}
                            onClick={() => { setPreviewStory(story); setShowPreview(true) }}
                            className="cursor-pointer border-b border-[#eef2f8] transition-colors"
                            style={{ background: i % 2 === 0 ? "#ffffff" : "#fafbfd" }}
                            onMouseEnter={e => (e.currentTarget.style.background = "#f0f6ff")}
                            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? "#ffffff" : "#fafbfd")}
                          >
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-[#377ACF] flex-shrink-0" />
                                <span className="text-sm font-semibold text-[#1a2540] truncate max-w-[100px]">{story.id}</span>
                              </div>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <p className="text-sm text-[#374151] line-clamp-2">{story.description || "—"}</p>
                            </td>
                            <td className="py-3 px-4 max-w-[200px]">
                              <p className="text-sm text-[#374151] line-clamp-2">{story.doc_content_text || "—"}</p>
                            </td>
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              <button onClick={() => router.push(`/test-cases/${story.id}`)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: "#f0f6ff", color: "#377ACF", border: "1px solid #c8d8eb" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#dceeff")}
                                onMouseLeave={e => (e.currentTarget.style.background = "#f0f6ff")}>
                                <FileText className="w-3.5 h-3.5" />{story.test_case_count || 0} Cases
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              {typeof story.impactedTestCases === "number" ? (
                                <button onClick={() => router.push(`/story-details/${story.id}?project_id=${story.project_id}`)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                  style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}
                                  onMouseEnter={e => (e.currentTarget.style.background = "#fef3c7")}
                                  onMouseLeave={e => (e.currentTarget.style.background = "#fffbeb")}>
                                  <Brain className="w-3.5 h-3.5" />{story.impactedTestCases} Impacted
                                </button>
                              ) : <span className="text-xs text-[#9ca3af] italic">—</span>}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {story.test_case_created_time ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-xs font-medium text-[#1a2540]">
                                    {new Date(story.test_case_created_time).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                  </span>
                                  <span className="text-[11px] text-[#9ca3af]">
                                    {new Date(story.test_case_created_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                  </span>
                                </div>
                              ) : <span className="text-xs text-[#9ca3af]">—</span>}
                            </td>
                            <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                              <button onClick={e => handleDownload(story.id, e)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                                style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#dcfce7")}
                                onMouseLeave={e => (e.currentTarget.style.background = "#f0fdf4")}>
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
                    <div className="inline-flex items-center gap-3 text-sm font-semibold text-[#377ACF]">
                      <div className="w-5 h-5 border-2 border-[#377ACF] border-t-transparent rounded-full animate-spin" />
                      Loading stories…
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4 items-start">
                    {COLS.map(col => {
                      const colStories = stories.filter(s => (storyColumns[s.id] || "generated") === col.id)
                      return (
                        <div key={col.id}
                          onDragOver={e => { e.preventDefault(); dragOverCol.current = col.id }}
                          onDrop={() => {
                            if (dragStoryId.current && dragOverCol.current) {
                              moveCard(dragStoryId.current, dragOverCol.current)
                              dragStoryId.current = null; dragOverCol.current = null
                            }
                          }}
                          className="rounded-2xl flex flex-col min-h-[180px]"
                          style={{ background: col.bg, border: `1.5px solid ${col.border}` }}
                        >
                          {/* Column header */}
                          <div className="flex items-center justify-between px-4 py-3 rounded-t-xl"
                            style={{ borderBottom: `1px solid ${col.border}` }}>
                            <div className="flex items-center gap-2" style={{ color: col.color }}>
                              {col.icon}
                              <span className="font-bold text-sm">{col.label}</span>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: "white", color: col.color, border: `1px solid ${col.border}` }}>
                              {colStories.length}
                            </span>
                          </div>

                          {/* Cards */}
                          <div className="flex flex-col gap-2.5 p-3 flex-1">
                            {colStories.length === 0 && (
                              <div className="flex items-center justify-center py-10 text-xs font-medium rounded-xl"
                                style={{ color: col.color, opacity: 0.5, border: `1.5px dashed ${col.border}` }}>
                                Drop stories here
                              </div>
                            )}
                            {colStories.map(story => (
                              <div key={story.id}
                                draggable
                                onDragStart={() => { dragStoryId.current = story.id }}
                                onDragEnd={() => { dragStoryId.current = null }}
                                onClick={() => { setPreviewStory(story); setShowPreview(true) }}
                                className="group rounded-xl bg-white cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-md"
                                style={{ border: "1px solid #dde6f0", boxShadow: "0 1px 3px rgba(15,22,43,0.06)" }}
                              >
                                {/* Card header: ID + project + grip */}
                                <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                                    <span className="text-xs font-bold text-[#1a2540] truncate">{story.id}</span>
                                    {story.project_id && (
                                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                                        style={{ background: "#F6F8FB", color: "#5a7ca0", border: "1px solid #eef2f8" }}>
                                        {story.project_id}
                                      </span>
                                    )}
                                  </div>
                                  <GripVertical className="w-3.5 h-3.5 text-[#d1d9e4] flex-shrink-0" />
                                </div>

                                {/* Description */}
                                <div className="px-3.5 pb-2.5">
                                  <p className="text-xs text-[#374151] line-clamp-2 leading-relaxed">
                                    {story.description || "No description."}
                                  </p>
                                </div>

                                {/* Stats */}
                                <div className="flex items-center gap-1.5 px-3.5 pb-2.5">
                                  <button onClick={e => { e.stopPropagation(); router.push(`/test-cases/${story.id}`) }}
                                    className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold hover:opacity-80 transition-opacity"
                                    style={{ background: "#f0f6ff", color: "#377ACF", border: "1px solid #c8d8eb" }}>
                                    <FileText className="w-2.5 h-2.5" />{story.test_case_count || 0}
                                  </button>
                                  {typeof story.impactedTestCases === "number" && story.impactedTestCases > 0 && (
                                    <button onClick={e => { e.stopPropagation(); router.push(`/story-details/${story.id}?project_id=${story.project_id}`) }}
                                      className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-semibold hover:opacity-80 transition-opacity"
                                      style={{ background: "#fffbeb", color: "#b45309", border: "1px solid #fde68a" }}>
                                      <Brain className="w-2.5 h-2.5" />{story.impactedTestCases}↑
                                    </button>
                                  )}
                                  {story.test_case_created_time && (
                                    <span className="text-[10px] text-[#9ca3af] ml-auto">
                                      {new Date(story.test_case_created_time).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                    </span>
                                  )}
                                </div>

                                {/* Move to + Download — revealed on hover */}
                                <div className="hidden group-hover:flex items-center gap-1.5 px-3.5 pb-3 pt-2"
                                  style={{ borderTop: "1px solid #eef2f8" }}>
                                  <span className="text-[10px] text-[#9ca3af]">Move:</span>
                                  {COLS.filter(c => c.id !== col.id).map(c => (
                                    <button key={c.id}
                                      onClick={e => { e.stopPropagation(); moveCard(story.id, c.id) }}
                                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all hover:scale-105 active:scale-95"
                                      style={{ background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                                      {c.label}
                                    </button>
                                  ))}
                                  <button onClick={e => { e.stopPropagation(); handleDownload(story.id, e) }}
                                    className="ml-auto w-5 h-5 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                                    style={{ background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0" }}>
                                    <Download className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
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
        <SheetContent side="right" className="w-[480px] p-0 flex flex-col gap-0 border-l border-[#dde6f0]">
          {/* header */}
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F162B" }}>
            <SheetHeader>
              <SheetTitle className="text-white text-base font-bold flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(162,210,233,0.18)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "#A2D2E9" }} />
                </div>
                {previewStory?.id}
              </SheetTitle>
              <SheetDescription className="text-sm" style={{ color: "#A2D2E9" }}>Story Details</SheetDescription>
            </SheetHeader>
          </div>

          {/* body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: "#F6F8FB" }}>
            {/* AI description */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wide text-[#5a7ca0]">AI-Generated Description</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "rgba(55,122,207,0.12)", color: "#377ACF" }}>AI</span>
              </div>
              <div className="rounded-xl p-4 bg-white border border-[#dde6f0]">
                <p className="text-sm text-[#374151] leading-relaxed">{previewStory?.description || "No description available."}</p>
              </div>
            </div>

            {/* Content */}
            {previewStory?.doc_content_text && (
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-[#5a7ca0] mb-2">Story Content</div>
                <div className="rounded-xl p-4 bg-white border border-[#dde6f0] max-h-48 overflow-y-auto">
                  <p className="text-sm text-[#374151] whitespace-pre-wrap leading-relaxed">{previewStory.doc_content_text}</p>
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3.5 bg-white border border-[#dde6f0]">
                <div className="text-[11px] font-semibold text-[#5a7ca0] mb-0.5">Test Cases</div>
                <div className="text-xl font-bold text-[#377ACF]">{previewStory?.test_case_count || 0}</div>
              </div>
              <div className="rounded-xl p-3.5 bg-white border border-[#dde6f0]">
                <div className="text-[11px] font-semibold text-[#5a7ca0] mb-0.5">Impacted</div>
                <div className="text-xl font-bold text-[#b45309]">
                  {typeof previewStory?.impactedTestCases === "number" ? previewStory.impactedTestCases : "—"}
                </div>
              </div>
            </div>
          </div>

          {/* footer actions */}
          <div className="p-5 flex-shrink-0 border-t border-[#dde6f0] bg-white space-y-2.5">
            <button onClick={() => { setShowPreview(false); router.push(`/test-cases/${previewStory?.id}`) }}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
              style={{ background: "#377ACF" }}>
              <FileText className="w-4 h-4" /> View Test Cases
            </button>
            {typeof previewStory?.impactedTestCases === "number" && (
              <button onClick={() => { setShowPreview(false); router.push(`/story-details/${previewStory?.id}?project_id=${previewStory?.project_id}`) }}
                className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-[#fde68a]"
                style={{ background: "#fffbeb", color: "#b45309" }}>
                <Brain className="w-4 h-4" /> View Impact Analysis
              </button>
            )}
            <button onClick={() => { if (previewStory) handleDownload(previewStory.id) }}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors border border-[#dde6f0]"
              style={{ background: "#ffffff", color: "#374151" }}>
              <Download className="w-4 h-4" /> Download Excel
            </button>
            <button
              onClick={() => { if (previewStory) openExportForStory(previewStory) }}
              className="w-full h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{ background: "#A2D2E9", color: "#0F162B" }}>
              <Code2 className="w-4 h-4" />
              {exportLoading ? "Loading test cases…" : "Export as Test Script"}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════ UPLOAD STORY SHEET ═══════ */}
      <Sheet open={showUpload} onOpenChange={setShowUpload}>
        <SheetContent side="right" className="w-[480px] p-0 flex flex-col gap-0 border-l border-[#dde6f0]">
          <div className="px-6 py-5 flex-shrink-0" style={{ background: "#0F162B" }}>
            <SheetHeader>
              <SheetTitle className="text-white text-base font-bold flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(162,210,233,0.18)" }}>
                  <FileText className="w-3.5 h-3.5" style={{ color: "#A2D2E9" }} />
                </div>
                Upload User Story
              </SheetTitle>
              <SheetDescription className="text-sm" style={{ color: "#A2D2E9" }}>
                Upload a story to auto-generate test cases via AI
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ background: "#F6F8FB" }}>
            {/* Project */}
            <div>
              <label className={labelCls}>Project *</label>
              <select value={uploadForm.projectId} onChange={e => setUploadForm(p => ({ ...p, projectId: e.target.value }))}
                className="w-full h-9 rounded-xl px-3 text-sm border border-[#c8d8eb] bg-white text-[#1a2540] focus:outline-none focus:ring-2 focus:ring-[#377ACF]/20">
                <option value="">Select a project</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
                <option value="new">+ Create New Project</option>
              </select>
              {uploadForm.projectId === "new" && (
                <Input placeholder="New project name" value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="mt-2 h-9 rounded-xl text-sm" style={inputStyle} />
              )}
            </div>

            {/* Story ID */}
            <div>
              <label className={labelCls}>Story ID *</label>
              <Input placeholder="e.g. PROJ-456" value={uploadForm.storyId}
                onChange={e => setUploadForm(p => ({ ...p, storyId: e.target.value }))}
                className="h-9 rounded-xl text-sm" style={inputStyle} />
            </div>

            {/* Content */}
            <div>
              <label className={labelCls}>Story Content *</label>
              <Textarea placeholder="Type or paste your user story here…" rows={5} value={uploadForm.content}
                onChange={e => setUploadForm(p => ({ ...p, content: e.target.value }))}
                className="rounded-xl text-sm resize-none" style={inputStyle} />
            </div>

            {/* File upload */}
            <div>
              <label className={labelCls}>Or Upload File</label>
              <label htmlFor="file-upload"
                className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-[#c8d8eb] bg-white cursor-pointer hover:border-[#377ACF] hover:bg-[#f0f6ff] transition-colors">
                <FileText className="w-4 h-4 text-[#377ACF]" />
                <span className="text-sm text-[#5a7ca0]">
                  {uploadForm.file ? uploadForm.file.name : "Click to upload PDF, DOCX or TXT"}
                </span>
                {uploadForm.file && (
                  <button onClick={e => { e.preventDefault(); setUploadForm(p => ({ ...p, file: null })) }}
                    className="ml-auto text-[#9ca3af] hover:text-[#374151]">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </label>
              <input id="file-upload" type="file" accept=".pdf,.docx,.txt" className="hidden"
                onChange={e => setUploadForm(p => ({ ...p, file: e.target.files?.[0] || null }))} />
            </div>

            {/* Status */}
            {uploadStatus && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium"
                style={{
                  background: uploadStatus.type === "success" ? "#f0fdf4" : uploadStatus.type === "error" ? "#fff1f2" : "#f0f6ff",
                  border: `1px solid ${uploadStatus.type === "success" ? "#bbf7d0" : uploadStatus.type === "error" ? "#fecdd3" : "#c8d8eb"}`,
                  color: uploadStatus.type === "success" ? "#166534" : uploadStatus.type === "error" ? "#9f1239" : "#1e4f8a",
                }}>
                {uploadStatus.message}
                <button onClick={() => setUploadStatus(null)} className="ml-2 opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>

          <div className="p-5 flex-shrink-0 border-t border-[#dde6f0] bg-white">
            <button onClick={handleUploadStory}
              disabled={isUploading || (uploadForm.projectId === "new" ? !newProjectName : !uploadForm.projectId) || !uploadForm.storyId || (!uploadForm.content && !uploadForm.file)}
              className="w-full h-10 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "#377ACF" }}>
              {isUploading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Processing…</>
                : <><FileText className="w-4 h-4" />Generate Test Cases</>}
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
    </SidebarProvider>
  )
}
