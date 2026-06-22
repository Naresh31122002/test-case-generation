"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  BookOpen, GitCompareArrows, BarChart3, Download,
  Settings, Upload, Clock, RefreshCw, Search,
} from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import { api, Story } from "@/lib/api"
import { CommandPalette } from "@/components/command-palette"

interface AppSidebarProps {
  projects?: string[]
  selectedProject?: string
  onProjectChange?: (p: string) => void
  onUploadClick?: () => void
  onCreateProject?: () => void
}

const NAV = [
  { id: "stories",  label: "Stories",  icon: BookOpen,          href: "/" },
  { id: "changes",  label: "Changes",  icon: GitCompareArrows,  href: "/changes" },
  { id: "coverage", label: "Coverage", icon: BarChart3,          href: "/coverage" },
  { id: "exports",  label: "Exports",  icon: Download,           href: "/exports" },
  { id: "settings", label: "Settings", icon: Settings,           href: "/settings" },
]

export function AppSidebar({ projects = [], selectedProject = "", onProjectChange, onUploadClick }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [nextReload, setNextReload] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [isTriggering, setIsTriggering] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [allStories, setAllStories] = useState<Story[]>([])

  useEffect(() => {
    api.getStories(1, 100).then(res => {
      if (res.stories) setAllStories(res.stories)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setShowPalette(true)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const fetchNextReload = async () => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SCHEDULER_API_URL || "http://127.0.0.1:5001"}/api/scheduler/next-reload`)
      const ct = res.headers.get("content-type") || ""
      if (ct.includes("application/json")) {
        const data = await res.json()
        const v = data?.next_reload ?? data?.nextReload ?? null
        const d = v ? new Date(String(v).trim()) : null
        if (d && !isNaN(d.getTime())) setNextReload(d)
      } else {
        const t = await res.text()
        const d = new Date(t.trim())
        if (!isNaN(d.getTime())) setNextReload(d)
      }
    } catch {}
  }

  const triggerReload = async () => {
    try {
      setIsTriggering(true)
      const res = await fetch(`${process.env.NEXT_PUBLIC_SCHEDULER_API_URL || "http://127.0.0.1:5001"}/api/scheduler/trigger`, {
        method: "POST", headers: { "Content-Type": "application/json" },
      })
      if (res.ok) { toast.success("Scheduler triggered!"); setTimeout(fetchNextReload, 2000) }
      else toast.error("Failed to trigger scheduler")
    } catch { toast.error("Failed to trigger scheduler") }
    finally { setIsTriggering(false) }
  }

  useEffect(() => {
    fetchNextReload()
    const p = setInterval(fetchNextReload, 30000)
    return () => clearInterval(p)
  }, [])

  useEffect(() => {
    if (!nextReload) return
    const tick = () => {
      const diff = Math.max(0, nextReload.getTime() - Date.now())
      if (diff <= 0) { setTimeLeft("Reloading…"); return }
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0")
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0")
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0")
      setTimeLeft(`${h}:${m}:${s}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextReload])

  const activeId = pathname === "/" || pathname.startsWith("/stories") ? "stories"
    : pathname.startsWith("/changes") ? "changes"
    : pathname.startsWith("/coverage") ? "coverage"
    : pathname.startsWith("/exports") ? "exports"
    : pathname.startsWith("/settings") ? "settings"
    : "stories"

  return (
    <>
      <Sidebar
        collapsible="icon"
        className="border-r"
        style={{ background: "#0F172A", borderColor: "#1E293B" }}
      >
        {/* ── Brand ── */}
        <SidebarHeader
          className="px-4 py-5"
          style={{ borderBottom: "1px solid #1E293B" }}
        >
          <div className="flex items-center gap-3 overflow-hidden">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "#FF4D6D" }}
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="group-data-[collapsible=icon]:hidden min-w-0">
              <div className="font-bold text-sm leading-tight truncate text-white">TestSurge AI</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: "#64748B" }}>Requirement Intelligence</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="py-3" style={{ background: "#0F172A" }}>
          {/* ── Main nav ── */}
          <SidebarGroup>
            <SidebarMenu>
              {NAV.map(item => {
                const Icon = item.icon
                const isActive = activeId === item.id
                return (
                  <SidebarMenuItem key={item.id}>
                    <button
                      onClick={() => router.push(item.href)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 text-sm font-medium transition-all relative"
                      style={isActive
                        ? {
                            background: "rgba(6,182,212,0.12)",
                            color: "#06B6D4",
                          }
                        : {
                            color: "#CBD5E1",
                          }
                      }
                      onMouseEnter={e => {
                        if (!isActive) e.currentTarget.style.background = "#1E293B"
                      }}
                      onMouseLeave={e => {
                        if (!isActive) e.currentTarget.style.background = "transparent"
                      }}
                    >
                      {isActive && (
                        <div
                          className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r"
                          style={{ background: "#06B6D4" }}
                        />
                      )}
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                    </button>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator style={{ background: "#1E293B" }} />

          {/* ── Quick actions ── */}
          <SidebarGroup className="mt-1">
            <SidebarMenu>
              {/* New Story */}
              <SidebarMenuItem>
                <button
                  onClick={onUploadClick || (() => router.push("/stories/new"))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 text-sm font-medium transition-all"
                  style={{ color: "#CBD5E1" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1E293B")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Upload className="w-4 h-4 flex-shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">New Story</span>
                </button>
              </SidebarMenuItem>

              {/* Search (Ctrl+K) */}
              <SidebarMenuItem>
                <button
                  onClick={() => setShowPalette(true)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mx-1 text-sm font-medium transition-all"
                  style={{ color: "#CBD5E1" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#1E293B")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <Search className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Search</span>
                  <kbd
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono group-data-[collapsible=icon]:hidden"
                    style={{ background: "#1E293B", color: "#64748B", border: "1px solid #334155" }}
                  >
                    ⌘K
                  </kbd>
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator style={{ background: "#1E293B" }} />

          {/* ── Project filter ── */}
          {projects.length > 0 && (
            <SidebarGroup className="group-data-[collapsible=icon]:hidden mt-1 px-3">
              <p className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "#475569" }}>
                Project
              </p>
              <select
                value={selectedProject}
                onChange={e => onProjectChange?.(e.target.value)}
                className="w-full h-8 rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#06B6D4]"
                style={{
                  background: "#1E293B",
                  color: "#CBD5E1",
                  border: "1px solid #334155",
                }}
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </SidebarGroup>
          )}
        </SidebarContent>

        {/* ── Scheduler footer ── */}
        <SidebarFooter
          className="group-data-[collapsible=icon]:hidden p-4"
          style={{ borderTop: "1px solid #1E293B", background: "#0F172A" }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#06B6D4" }} />
              <span className="text-[11px]" style={{ color: "#64748B" }}>Next sync</span>
            </div>
            <div className="font-mono text-sm font-bold" style={{ color: "#CBD5E1" }}>
              {timeLeft || "—"}
            </div>
            <button
              onClick={triggerReload}
              disabled={isTriggering}
              className="w-full h-8 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#06B6D4" }}
            >
              {isTriggering
                ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Triggering…</>
                : <><RefreshCw className="w-3 h-3" />Trigger Now</>}
            </button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <CommandPalette
        open={showPalette}
        onOpenChange={setShowPalette}
        stories={allStories}
        onSelectStory={s => router.push(`/test-cases/${s.id}`)}
      />
    </>
  )
}
