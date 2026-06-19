"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { FolderPlus, Plus, List, LayoutGrid, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import type { Story } from "@/types/domain";
import { staggerContainer, fadeInUp, duration, easeStandard } from "@/lib/motion";

// ─── Project accent colors — deterministic hash of project_id ─────────────────

const ACCENT_COLORS = [
  "var(--color-brand-primary)", // pink (brand)
  "#06B6D4", // cyan
  "#8B5CF6", // violet
  "#F59E0B", // amber
  "#10B981", // emerald
  "#3B82F6", // blue
];

function accentColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = projectId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ACCENT_COLORS[Math.abs(hash) % ACCENT_COLORS.length];
}

// ─── Relative time helper ─────────────────────────────────────────────────────

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Per-project metadata ─────────────────────────────────────────────────────

interface ProjectMeta {
  id: string;
  storyCount: number;
  lastUpdated: string | null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type ViewMode = "board" | "list";

export default function ProjectsPage() {
  const router = useRouter();

  const [projects, setProjects] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, ProjectMeta>>({});
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("board");

  // Inline create state
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [createLoading, setCreateLoading] = useState(false);

  // Selecting — brief fade before navigate
  const [selecting, setSelecting] = useState(false);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getProjects();
      const ids = res.projects.filter(Boolean);
      setProjects(ids);

      // Fetch story counts + last updated per project in parallel
      const metaEntries = await Promise.all(
        ids.map(async (pid) => {
          try {
            const r = await api.getStories(1, 200, undefined, undefined, pid);
            const stories: Story[] = r.data;
            const count = stories.length;
            const latest = stories.reduce<string | null>((best, s) => {
              if (!s.testCaseCreatedTime) return best;
              if (!best) return s.testCaseCreatedTime;
              return s.testCaseCreatedTime > best ? s.testCaseCreatedTime : best;
            }, null);
            return [pid, { id: pid, storyCount: count, lastUpdated: latest }] as const;
          } catch {
            return [pid, { id: pid, storyCount: 0, lastUpdated: null }] as const;
          }
        })
      );
      setMeta(Object.fromEntries(metaEntries));
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  function storeActiveProject(projectId: string) {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeProject", projectId);
    }
  }

  async function selectProject(projectId: string) {
    storeActiveProject(projectId);
    setSelecting(true);
    await new Promise((r) => setTimeout(r, 150));
    router.push(`/stories?project_id=${encodeURIComponent(projectId)}`);
  }

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    setCreateLoading(true);
    // The project is created implicitly when the first story is uploaded with this project_id.
    // We just store it as active and navigate to the empty stories page.
    storeActiveProject(name);
    setCreateLoading(false);
    setCreating(false);
    setNewName("");
    setSelecting(true);
    await new Promise((r) => setTimeout(r, 150));
    router.push(`/stories?project_id=${encodeURIComponent(name)}`);
  }

  // ─── Full-screen spinner while loading (prevents flash before auto-redirect) ─
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFC]">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
            style={{ background: "var(--color-brand-primary)" }}
          >
            T
          </div>
          <div className="w-5 h-5 border-2 border-border border-t-pink rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ─── Empty state ──────────────────────────────────────────────────────────

  if (!loading && projects.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#FAFBFC] px-6">
        <LogoBlock />
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: duration.moderate }}
          className="flex flex-col items-center gap-6 mt-10"
        >
          <FolderPlus size={48} className="text-muted" />
          <div className="text-center">
            <h2 className="text-[18px] font-semibold text-navy">No projects yet</h2>
            <p className="text-sm text-muted mt-1">
              Create a project to start uploading stories and generating tests.
            </p>
          </div>
          <CreateCard
            creating={creating}
            newName={newName}
            createLoading={createLoading}
            setCreating={setCreating}
            setNewName={setNewName}
            onCancel={() => { setCreating(false); setNewName(""); }}
            onSubmit={handleCreate}
            standalone
          />
        </motion.div>
      </div>
    );
  }

  // ─── Main render ──────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {!selecting && (
        <motion.div
          key="picker"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: duration.fast }}
          className="min-h-screen bg-[#FAFBFC]"
        >
          {/* Header block */}
          <div className="flex flex-col items-center pt-20 pb-10 px-6">
            <LogoBlock />
            <h1 className="text-[24px] font-bold text-navy mt-8 text-center">
              Choose a project to continue
            </h1>
            <p className="text-sm text-muted mt-2 text-center">
              Each project keeps its own stories, tests, and impact history.
            </p>

            {/* View toggle */}
            {projects.length > 0 && (
              <div className="flex items-center border border-border rounded-btn overflow-hidden mt-6">
                <button
                  onClick={() => setViewMode("board")}
                  className={`w-9 h-9 flex items-center justify-center transition-colors ${
                    viewMode === "board" ? "bg-surface-pink text-pink" : "bg-white text-muted hover:text-navy"
                  }`}
                  title="Grid view"
                >
                  <LayoutGrid size={16} />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`w-9 h-9 flex items-center justify-center transition-colors ${
                    viewMode === "list" ? "bg-surface-pink text-pink" : "bg-white text-muted hover:text-navy"
                  }`}
                  title="List view"
                >
                  <List size={16} />
                </button>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="max-w-[960px] mx-auto px-6 pb-20">
            {viewMode === "board" ? (
              <BoardView
                projects={projects}
                meta={meta}
                creating={creating}
                newName={newName}
                createLoading={createLoading}
                setCreating={setCreating}
                setNewName={setNewName}
                onCancel={() => { setCreating(false); setNewName(""); }}
                onSubmit={handleCreate}
                onSelect={selectProject}
              />
            ) : (
              <ListView
                projects={projects}
                meta={meta}
                creating={creating}
                newName={newName}
                createLoading={createLoading}
                setCreating={setCreating}
                setNewName={setNewName}
                onCancel={() => { setCreating(false); setNewName(""); }}
                onSubmit={handleCreate}
                onSelect={selectProject}
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Logo block ───────────────────────────────────────────────────────────────

function LogoBlock() {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
        style={{ background: "var(--color-brand-primary)" }}
      >
        T
      </div>
      <span className="text-[22px] font-bold" style={{ color: "var(--color-brand-primary)" }}>
        TestSurge
      </span>
    </div>
  );
}

// ─── Board view ───────────────────────────────────────────────────────────────

function BoardView({
  projects, meta, creating, newName, createLoading,
  setCreating, setNewName, onCancel, onSubmit, onSelect,
}: {
  projects: string[];
  meta: Record<string, ProjectMeta>;
  creating: boolean;
  newName: string;
  createLoading: boolean;
  setCreating: (v: boolean) => void;
  setNewName: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {projects.map((pid) => (
        <ProjectCard
          key={pid}
          projectId={pid}
          meta={meta[pid]}
          onSelect={onSelect}
        />
      ))}
      <CreateCard
        creating={creating}
        newName={newName}
        createLoading={createLoading}
        setCreating={setCreating}
        setNewName={setNewName}
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    </motion.div>
  );
}

// ─── Project card ─────────────────────────────────────────────────────────────

function ProjectCard({
  projectId, meta, onSelect,
}: {
  projectId: string;
  meta?: ProjectMeta;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const color = accentColor(projectId);
  const letter = projectId.charAt(0).toUpperCase();

  return (
    <motion.button
      variants={fadeInUp}
      whileHover={{ y: -2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      onClick={() => onSelect(projectId)}
      className="text-left p-5 bg-white rounded-[10px] border transition-shadow cursor-pointer"
      style={{
        borderColor: hovered ? "#06B6D4" : "#E2E8F0",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {/* Color square with letter */}
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-base font-bold mb-3 flex-shrink-0"
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>

      {/* Project name */}
      <p className="text-[16px] font-semibold text-navy truncate mb-1">{projectId}</p>

      {/* Meta */}
      <p className="text-[12px] text-muted">
        {meta ? `${meta.storyCount} ${meta.storyCount === 1 ? "story" : "stories"}` : "…"}
        {meta?.lastUpdated ? ` · Updated ${relativeTime(meta.lastUpdated)}` : ""}
      </p>
    </motion.button>
  );
}

// ─── Create card ──────────────────────────────────────────────────────────────

function CreateCard({
  creating, newName, createLoading,
  setCreating, setNewName, onCancel, onSubmit, standalone,
}: {
  creating: boolean;
  newName: string;
  createLoading: boolean;
  setCreating: (v: boolean) => void;
  setNewName: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  standalone?: boolean;
}) {
  const base = standalone
    ? "w-[360px] p-6 rounded-[10px] border-2 border-dashed cursor-pointer transition-colors"
    : "p-5 rounded-[10px] border-2 border-dashed cursor-pointer transition-colors";

  return (
    <motion.div variants={standalone ? undefined : fadeInUp} className={base} style={{ borderColor: "#E2E8F0" }}>
      <AnimatePresence mode="wait">
        {!creating ? (
          <motion.button
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            onClick={() => setCreating(true)}
            className="w-full flex flex-col items-center justify-center gap-2 py-4 hover:opacity-80 transition-opacity"
          >
            <Plus size={28} className="text-muted" />
            <span className="text-[14px] font-semibold text-navy">New Project</span>
          </motion.button>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast }}
            className="flex flex-col gap-3"
          >
            <label className="text-[13px] font-semibold text-muted uppercase tracking-wide">
              Project name
            </label>
            <input
              autoFocus
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="e.g. Auth, Payments, Mobile"
              className="h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={onSubmit}
                disabled={!newName.trim() || createLoading}
                className="h-8 px-4 text-xs font-semibold bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40"
              >
                {createLoading ? "Creating…" : "Create"}
              </button>
              <button
                onClick={onCancel}
                className="h-8 px-3 text-xs font-medium text-muted hover:text-navy transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── List view ────────────────────────────────────────────────────────────────

function ListView({
  projects, meta, creating, newName, createLoading,
  setCreating, setNewName, onCancel, onSubmit, onSelect,
}: {
  projects: string[];
  meta: Record<string, ProjectMeta>;
  creating: boolean;
  newName: string;
  createLoading: boolean;
  setCreating: (v: boolean) => void;
  setNewName: (v: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="bg-white border border-border rounded-card overflow-hidden"
    >
      {projects.map((pid, idx) => {
        const color = accentColor(pid);
        const letter = pid.charAt(0).toUpperCase();
        const m = meta[pid];
        return (
          <motion.button
            key={pid}
            variants={fadeInUp}
            onClick={() => onSelect(pid)}
            className={`w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors ${
              idx < projects.length - 1 ? "border-b border-border" : ""
            }`}
          >
            <div
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: color }}
            >
              {letter}
            </div>
            <span className="flex-1 text-sm font-semibold text-navy">{pid}</span>
            <span className="text-xs text-muted">
              {m ? `${m.storyCount} ${m.storyCount === 1 ? "story" : "stories"}` : "…"}
            </span>
            <span className="text-xs text-muted w-28 text-right">
              {m?.lastUpdated ? relativeTime(m.lastUpdated) : ""}
            </span>
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </motion.button>
        );
      })}

      {/* New project row */}
      <div className="border-t-2 border-dashed border-border">
        <AnimatePresence mode="wait">
          {!creating ? (
            <motion.button
              key="trigger"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast }}
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div className="w-6 h-6 rounded border-2 border-dashed border-muted flex items-center justify-center flex-shrink-0">
                <Plus size={12} className="text-muted" />
              </div>
              <span className="text-sm font-semibold text-muted">New Project</span>
            </motion.button>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration.fast }}
              className="px-5 py-4 flex items-center gap-3"
            >
              <input
                autoFocus
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSubmit();
                  if (e.key === "Escape") onCancel();
                }}
                placeholder="Project name"
                className="flex-1 h-8 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
              />
              <button
                onClick={onSubmit}
                disabled={!newName.trim() || createLoading}
                className="h-8 px-3 text-xs font-semibold bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40"
              >
                {createLoading ? "Creating…" : "Create"}
              </button>
              <button
                onClick={onCancel}
                className="h-8 px-3 text-xs font-medium text-muted hover:text-navy transition-colors"
              >
                Cancel
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-5 bg-white rounded-[10px] border border-border animate-pulse">
          <div className="w-8 h-8 rounded-lg bg-gray-200 mb-3" />
          <div className="h-4 bg-gray-200 rounded w-2/3 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-1/2" />
        </div>
      ))}
    </div>
  );
}
