"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarSeparator,
} from "@/components/ui/sidebar"
import { LayoutDashboard, Upload, Clock, RefreshCw, FlaskConical } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"

interface AppSidebarProps {
  projects?: string[]
  selectedProject?: string
  onProjectChange?: (p: string) => void
  onUploadClick?: () => void
}

export function AppSidebar({ projects = [], selectedProject = '', onProjectChange, onUploadClick }: AppSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [nextReload, setNextReload] = useState<Date | null>(null)
  const [timeLeft, setTimeLeft] = useState<string>("")
  const [isTriggering, setIsTriggering] = useState(false)

  const fetchNextReload = async () => {
    try {
      const res = await fetch("http://127.0.0.1:5001/api/scheduler/next-reload")
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
      const res = await fetch("http://127.0.0.1:5001/api/scheduler/trigger", {
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
    <Sidebar collapsible="icon">
      {/* Brand */}
      <SidebarHeader className="px-4 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#377ACF" }}
          >
            <FlaskConical className="w-4 h-4 text-white" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden min-w-0">
            <div className="font-bold text-sm text-white leading-tight truncate">Test Forge AI</div>
            <div className="text-[11px] leading-tight truncate" style={{ color: "#A2D2E9" }}>Powered by Gen AI</div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-3">
        {/* Nav */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest px-3 mb-1" style={{ color: "rgba(162,210,233,0.5)" }}>
            Navigation
          </SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={isDashboard}
                onClick={() => router.push("/")}
                tooltip="Dashboard"
                className="gap-3"
              >
                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                <span>Dashboard</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={onUploadClick}
                tooltip="Upload Story"
                className="gap-3"
              >
                <Upload className="w-4 h-4 flex-shrink-0" />
                <span>Upload Story</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Project filter */}
        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest px-3 mb-2" style={{ color: "rgba(162,210,233,0.5)" }}>
            Project
          </SidebarGroupLabel>
          <div className="px-3">
            <select
              value={selectedProject}
              onChange={e => onProjectChange?.(e.target.value)}
              className="w-full h-8 rounded-lg px-2.5 text-xs font-medium border-0 focus:outline-none focus:ring-2 focus:ring-[#377ACF]/40"
              style={{ background: "rgba(255,255,255,0.07)", color: "#A2D2E9" }}
            >
              <option value="" style={{ background: "#1a2540", color: "#fff" }}>All Projects</option>
              {projects.map(p => (
                <option key={p} value={p} style={{ background: "#1a2540", color: "#fff" }}>{p}</option>
              ))}
            </select>
          </div>
        </SidebarGroup>
      </SidebarContent>

      {/* Scheduler footer */}
      <SidebarFooter className="group-data-[collapsible=icon]:hidden p-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "#A2D2E9" }} />
            <span className="text-[11px]" style={{ color: "rgba(162,210,233,0.7)" }}>Next scheduler run</span>
          </div>
          <div className="font-mono text-sm font-bold text-white">{timeLeft || "—"}</div>
          <button
            onClick={triggerReload}
            disabled={isTriggering}
            className="w-full h-8 rounded-lg text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-all hover:opacity-90 disabled:opacity-40"
            style={{ background: "#377ACF" }}
          >
            {isTriggering
              ? <><div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />Triggering…</>
              : <><RefreshCw className="w-3 h-3" />Trigger Now</>}
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
