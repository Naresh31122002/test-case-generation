"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarSeparator,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Upload, Clock, RefreshCw, Search } from "lucide-react"
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

export function AppSidebar({ projects = [], selectedProject = '', onProjectChange, onUploadClick, onCreateProject }: AppSidebarProps) {
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

  const isDashboard = pathname === "/"

  return (
    <>
      <Sidebar collapsible="icon" className="border-r border-[#EBEBEB] bg-white">
        {/* Brand */}
        <SidebarHeader className="px-4 py-4 bg-white" style={{ borderBottom: "1px solid #EBEBEB" }}>
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
              <div className="font-bold text-sm leading-tight truncate" style={{ color: "#1A1A2E" }}>Test Forge AI</div>
              <div className="text-[11px] leading-tight truncate" style={{ color: "#9CA3AF" }}>Powered by Gen AI</div>
            </div>
          </div>
        </SidebarHeader>

        <SidebarContent className="py-2 bg-white">
          <SidebarGroup>
            <SidebarGroupLabel
              className="text-[10px] uppercase tracking-widest px-3 mb-1"
              style={{ color: "#9CA3AF" }}
            >
              Navigation
            </SidebarGroupLabel>
            <SidebarMenu>
              {/* Dashboard — custom active style without shadcn ring */}
              <SidebarMenuItem>
                <button
                  onClick={() => router.push("/")}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg mx-1 text-sm font-medium transition-colors relative"
                  style={isDashboard
                    ? { background: "#FFF8FA", color: "#FF4D6D" }
                    : { color: "#1A1A2E" }
                  }
                >
                  {isDashboard && (
                    <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full" style={{ background: "#FF4D6D" }} />
                  )}
                  <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Dashboard</span>
                </button>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <button
                  onClick={onUploadClick}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg mx-1 text-sm font-medium transition-colors hover:bg-[#FFF8FA]"
                  style={{ color: "#1A1A2E" }}
                >
                  <Upload className="w-4 h-4 flex-shrink-0" />
                  <span className="group-data-[collapsible=icon]:hidden">Upload Story</span>
                </button>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <button
                  onClick={() => setShowPalette(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg mx-1 text-sm font-medium transition-colors hover:bg-[#FFF8FA]"
                  style={{ color: "#1A1A2E" }}
                >
                  <Search className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left group-data-[collapsible=icon]:hidden">Search Stories</span>
                  <kbd
                    className="text-[10px] px-1.5 py-0.5 rounded font-mono group-data-[collapsible=icon]:hidden"
                    style={{ background: "#F5F5F5", color: "#9CA3AF", border: "1px solid #E5E7EB" }}
                  >
                    ⌘K
                  </kbd>
                </button>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>

          <SidebarSeparator style={{ background: "#EBEBEB" }} />

          {/* Project filter */}
          <SidebarGroup className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel
              className="text-[10px] uppercase tracking-widest px-3 mb-2"
              style={{ color: "#9CA3AF" }}
            >
              Project
            </SidebarGroupLabel>
            <div className="px-3">
              <select
                value={selectedProject}
                onChange={e => onProjectChange?.(e.target.value)}
                className="w-full h-8 rounded-lg px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#FF4D6D]/20 border"
                style={{ background: "#FAFAFA", color: "#1A1A2E", border: "1px solid #F3E8ED" }}
              >
                <option value="">All Projects</option>
                {projects.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </SidebarGroup>
        </SidebarContent>

        {/* Scheduler footer */}
        <SidebarFooter
          className="group-data-[collapsible=icon]:hidden p-4 bg-white"
          style={{ borderTop: "1px solid #F3E8ED" }}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#FF4D6D" }} />
              <span className="text-[11px]" style={{ color: "#9CA3AF" }}>Next scheduler run</span>
            </div>
            <div className="font-mono text-sm font-bold" style={{ color: "#1A1A2E" }}>{timeLeft || "—"}</div>
            <button
              onClick={triggerReload}
              disabled={isTriggering}
              className="w-full h-8 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#FF4D6D" }}
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
