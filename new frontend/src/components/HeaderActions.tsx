"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Zap,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  GitPullRequest,
  TestTube2,
  AlertTriangle,
  Search,
  Plus,
  Upload,
  Download,
  MoreVertical,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useProject } from "@/contexts/ProjectContext";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { NewStoryModal } from "@/components/stories/NewStoryModal";
import { type Project } from "@/lib/projects";
import { useAIAction } from "@/contexts/AIActionContext";
import {
  activityService,
  groupBySection,
  timeAgo,
  type Activity,
  type ActivityType,
} from "@/lib/activity";

/** Icon mapping per activity type (kept in the component layer). */
const ACTIVITY_ICONS: Record<ActivityType, LucideIcon> = {
  story_uploaded: Upload,
  tests_generated: TestTube2,
  export_completed: Download,
  impact_detected: AlertTriangle,
  change_approved: GitPullRequest,
};


/* ---------------- Hook: close on outside click ---------------- */

function useClickOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);
  return ref;
}

/* ---------------- Project Selector ---------------- */

type ProjectAction =
  | { type: "rename"; project: Project }
  | { type: "delete"; project: Project }
  | null;

function ProjectSelector() {
  const {
    selectedProject,
    projectList,
    archivedProjects,
    selectProject,
    archiveProject,
    unarchiveProject,
  } = useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [pendingAction, setPendingAction] = useState<ProjectAction>(null);
  const ref = useClickOutside(() => setOpen(false));

  const active = selectedProject;
  const filtered = projectList.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );
  const filteredArchived = archivedProjects.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase())
  );

  function handleAction(action: "rename" | "archive" | "delete", project: Project) {
    if (action === "archive") {
      archiveProject(project.id);
    } else {
      setPendingAction({ type: action, project });
      setOpen(false);
    }
  }

  return (
    <div
      ref={ref}
      className="relative min-w-[180px] xl:min-w-[260px] max-w-[320px] flex-shrink"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 h-9 px-3 rounded-btn border border-border bg-white text-sm font-medium text-navy hover:bg-gray-50 transition-colors"
      >
        <span className="w-5 h-5 rounded bg-surface-pink text-pink flex items-center justify-center text-[10px] font-bold flex-shrink-0">
          {(active?.name ?? "?").charAt(0)}
        </span>
        <span className="flex-1 truncate text-left">
          {active?.name ?? "Select project"}
        </span>
        <ChevronDown size={14} className="text-muted flex-shrink-0" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 max-h-[70vh] flex flex-col bg-white border border-border rounded-card shadow-card overflow-hidden"
          >
            {/* Search — pinned header */}
            <div className="flex-shrink-0 p-2 border-b border-border">
              <div className="flex items-center gap-2 h-8 px-2 rounded-btn border border-border">
                <Search size={13} className="text-muted flex-shrink-0" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects…"
                  className="flex-1 text-sm text-navy placeholder:text-muted focus:outline-none bg-transparent"
                />
              </div>
            </div>

            {/* Scrollable region — Current · Recent · All · Archived */}
            <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Current project */}
            {active && !query && (
              <>
                <div className="px-3 pt-2 pb-1 text-[11px] font-semibold text-muted uppercase tracking-wide">
                  Current project
                </div>
                <div className="w-full flex items-center gap-2 px-3 py-2">
                  <span className="w-6 h-6 rounded bg-surface-pink text-pink flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {active.name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-navy truncate">{active.name}</p>
                    <p className="text-[11px] text-muted truncate">
                      {active.storyCount} stories · {active.testCount} tests
                    </p>
                  </div>
                  <Check size={15} className="text-pink flex-shrink-0" />
                </div>
              </>
            )}

            {/* All / search results */}
            <div className="border-t border-border px-3 pt-2 pb-1 text-[11px] font-semibold text-muted uppercase tracking-wide">
              {query ? "Results" : "All projects"}
            </div>
            <div>
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-xs text-muted">No projects found.</p>
              ) : (
                filtered.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    active={p.id === active?.id}
                    onSelect={() => { selectProject(p.id); setOpen(false); }}
                    onAction={(a) => handleAction(a, p)}
                  />
                ))
              )}
            </div>

            {/* Archived projects */}
            {(filteredArchived.length > 0 || (!query && archivedProjects.length > 0)) && (
              <>
                <button
                  type="button"
                  onClick={() => setShowArchived((v) => !v)}
                  className="w-full flex items-center gap-2 px-3 py-2 border-t border-border text-[11px] font-semibold text-muted uppercase tracking-wide hover:bg-gray-50 transition-colors"
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${showArchived ? "rotate-90" : ""}`}
                  />
                  Archived projects
                  <span className="ml-auto text-[10px] font-semibold bg-gray-100 text-muted px-1.5 py-0.5 rounded-full">
                    {archivedProjects.length}
                  </span>
                </button>
                {showArchived && (
                  <div className="max-h-36 overflow-y-auto bg-gray-50/40">
                    {(query ? filteredArchived : archivedProjects).map((p) => (
                      <div key={p.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-100/60 transition-colors">
                        <span className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 bg-gray-100 text-muted">
                          {p.name.charAt(0)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-muted truncate">{p.name}</p>
                          <p className="text-[11px] text-muted/70 truncate">
                            {p.storyCount} stories · {p.testCount} tests
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => unarchiveProject(p.id)}
                          className="flex items-center gap-1 text-[11px] font-medium text-cyan hover:underline flex-shrink-0"
                          title="Restore project"
                        >
                          <ArchiveRestore size={12} />
                          Restore
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
            </div>

            {/* Create — sticky footer, always visible */}
            <button
              type="button"
              onClick={() => { setShowCreate(true); setOpen(false); }}
              className="flex-shrink-0 w-full flex items-center gap-2 px-3 py-2.5 border-t border-border text-sm font-medium text-pink hover:bg-surface-pink/40 transition-colors"
            >
              <Plus size={15} />
              Create project
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />

      {/* Rename modal */}
      {pendingAction?.type === "rename" && (
        <RenameProjectModal
          project={pendingAction.project}
          onClose={() => setPendingAction(null)}
        />
      )}

      {/* Delete confirmation modal */}
      {pendingAction?.type === "delete" && (
        <DeleteProjectModal
          project={pendingAction.project}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
}

/* ---- Project Row with ⋮ context menu ---- */

function ProjectRow({
  project,
  active,
  onSelect,
  onAction,
}: {
  project: Project;
  active?: boolean;
  onSelect: () => void;
  onAction: (action: "rename" | "archive" | "delete") => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  return (
    <div className="relative group flex items-center hover:bg-gray-50 transition-colors">
      <button
        type="button"
        onClick={onSelect}
        className="flex-1 flex items-center gap-2 px-3 py-2 text-left min-w-0"
      >
        <span
          className={`w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            active ? "bg-surface-pink text-pink" : "bg-gray-100 text-muted"
          }`}
        >
          {project.name.charAt(0)}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy truncate">{project.name}</p>
          <p className="text-[11px] text-muted truncate">
            {project.storyCount} stories · {project.testCount} tests
          </p>
        </div>
        {active && <Check size={15} className="text-pink flex-shrink-0" />}
      </button>

      {/* ⋮ menu trigger */}
      <div ref={menuRef} className="relative flex-shrink-0 pr-2">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
          className="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-navy hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Project actions"
        >
          <MoreVertical size={14} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.1 }}
              className="absolute right-0 top-full mt-1 z-30 w-44 bg-white border border-border rounded-lg shadow-card py-1"
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onAction("rename"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
              >
                <Pencil size={14} className="text-muted" />
                Rename Project
              </button>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onAction("archive"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
              >
                <Archive size={14} className="text-muted" />
                Archive Project
              </button>
              <div className="my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onAction("delete"); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
              >
                <Trash2 size={14} />
                Delete Project
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---- Rename Project Modal ---- */

function RenameProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { renameProject } = useProject();
  const [name, setName] = useState(project.name);
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError("Name is required."); return; }
    if (trimmed.length < 2) { setError("Name must be at least 2 characters."); return; }
    renameProject(project.id, trimmed);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-sm bg-white border border-border rounded-card shadow-card overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-navy">Rename Project</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-navy transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">
              Project name <span className="text-pink">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => { setName(e.target.value); setError(""); }}
              className={`w-full h-10 px-3 rounded-btn border text-sm text-navy placeholder:text-muted focus:outline-none transition-colors ${
                error ? "border-[#EF4444] focus:border-[#EF4444]" : "border-border focus:border-pink"
              }`}
            />
            {error && <p className="text-xs text-[#EF4444] mt-1">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === project.name}
              className="h-9 px-4 rounded-btn bg-pink text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Rename
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

/* ---- Delete Project Confirmation Modal ---- */

function DeleteProjectModal({
  project,
  onClose,
}: {
  project: Project;
  onClose: () => void;
}) {
  const { deleteProject } = useProject();
  const hasData = project.storyCount > 0 || project.testCount > 0;
  const [confirm, setConfirm] = useState("");
  const canDelete = hasData ? confirm === project.name : true;

  function handleDelete() {
    if (!canDelete) return;
    deleteProject(project.id);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md bg-white border border-border rounded-card shadow-card overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-[#EF4444]">Delete Project</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-navy transition-colors" aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="p-3 rounded-card bg-[#FEF2F2] border border-[#FCA5A5]">
            <p className="text-sm font-medium text-[#991B1B] mb-1">
              This action cannot be undone.
            </p>
            <p className="text-xs text-[#991B1B]/80">
              This will permanently delete <strong>{project.name}</strong> and all associated data.
            </p>
          </div>

          {/* Stats */}
          <div className="flex gap-4">
            <div className="flex-1 p-3 rounded-card border border-border text-center">
              <p className="text-xl font-bold text-navy">{project.storyCount}</p>
              <p className="text-xs text-muted mt-0.5">Stories</p>
            </div>
            <div className="flex-1 p-3 rounded-card border border-border text-center">
              <p className="text-xl font-bold text-navy">{project.testCount}</p>
              <p className="text-xs text-muted mt-0.5">Tests</p>
            </div>
          </div>

          {/* Confirm by typing name */}
          {hasData && (
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">
                Type <strong className="text-[#EF4444]">{project.name}</strong> to confirm
              </label>
              <input
                autoFocus
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder={project.name}
                className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-[#EF4444] transition-colors"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!canDelete}
              className="h-9 px-4 rounded-btn bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] transition-colors disabled:opacity-40"
            >
              Delete Project
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

/* ---------------- Credits Indicator ---------------- */

function CreditsIndicator() {
  const [show, setShow] = useState(false);
  const { creditsUsed, creditsTotal, creditsRemaining } = useAIAction();
  const pct = Math.round((creditsUsed / creditsTotal) * 100);

  return (
    <div
      className="relative flex-shrink-0"
      data-tour="header-credits"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {/* Full credits (≥1200px) */}
      <div className="hidden min-[1200px]:flex items-center gap-2 h-9 px-3 rounded-btn border border-border bg-white text-sm font-medium text-navy cursor-default whitespace-nowrap">
        <Zap size={15} className="text-pink flex-shrink-0" />
        <span className="tabular-nums">
          {creditsUsed}
          <span className="text-muted">/{creditsTotal}</span>
        </span>
        <span className="text-muted text-xs">Credits</span>
      </div>
      {/* Compact badge (&lt;1200px) */}
      <div className="flex min-[1200px]:hidden items-center gap-1.5 h-9 px-2.5 rounded-btn border border-border bg-white text-sm font-medium text-navy cursor-default whitespace-nowrap">
        <Zap size={15} className="text-pink flex-shrink-0" />
        <span className="tabular-nums">{creditsUsed}</span>
      </div>

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-60 bg-white border border-border rounded-card shadow-card p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-navy">Credits</span>
              <span className="text-xs text-muted">{pct}% used</span>
            </div>
            <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden mb-3">
              <div
                className="h-full rounded-full bg-pink"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-navy font-medium">Remaining</span>
              <span className="font-semibold text-success tabular-nums">
                {creditsRemaining}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- Notification Bell ---------------- */

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Activity[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const ref = useClickOutside(() => {
    setOpen(false);
    setShowClearConfirm(false);
  });
  const unreadCount = items.filter((n) => !n.read).length;

  // Load activity from the reusable service (mock now, API-ready later).
  useEffect(() => {
    let alive = true;
    activityService.list().then((data) => {
      if (alive) setItems(data);
    });
    return () => { alive = false; };
  }, []);

  const markAllRead = async () => {
    await activityService.markAllRead();
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const toggleRead = async (id: string, current: boolean) => {
    await activityService.markRead(id, !current);
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: !current } : n))
    );
  };

  const removeItem = async (id: string) => {
    await activityService.remove(id);
    setItems((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAll = async () => {
    await activityService.clearAll();
    setItems([]);
    setShowClearConfirm(false);
  };

  const grouped = groupBySection(items);

  return (
    <div ref={ref} className="relative flex-shrink-0" data-tour="header-notifications">
      {/* Bell trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setShowClearConfirm(false); }}
        className="relative w-9 h-9 rounded-btn border border-border bg-white text-muted hover:text-navy hover:bg-gray-50 flex items-center justify-center transition-colors"
        title="Notifications"
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-pink text-white text-[10px] font-bold flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 bg-white border border-border rounded-card shadow-card overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-navy">Notifications</span>
                {unreadCount > 0 && (
                  <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-pink text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="text-xs font-medium text-pink hover:underline"
                    title="Mark all as read"
                  >
                    Mark all read
                  </button>
                )}
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowClearConfirm(true)}
                    className="text-xs font-medium text-muted hover:text-[#EF4444] transition-colors"
                    title="Clear all notifications"
                  >
                    Clear all
                  </button>
                )}
              </div>
            </div>

            {/* Clear-all confirmation inline banner */}
            <AnimatePresence>
              {showClearConfirm && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 py-3 bg-[#FEF2F2] border-b border-[#FCA5A5] flex items-center justify-between gap-3">
                    <p className="text-xs text-[#991B1B] font-medium leading-snug">
                      Remove all notifications?
                    </p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setShowClearConfirm(false)}
                        className="text-xs font-medium text-muted hover:text-navy transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={clearAll}
                        className="text-xs font-semibold text-white bg-[#EF4444] hover:bg-[#DC2626] px-2.5 py-1 rounded-btn transition-colors"
                      >
                        Remove all
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Notification list */}
            <div className="max-h-[360px] overflow-y-auto">
              {grouped.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                    <Bell size={22} className="text-muted" />
                  </div>
                  <p className="text-sm font-semibold text-navy mb-0.5">No notifications</p>
                  <p className="text-xs text-muted">You&apos;re all caught up</p>
                </div>
              ) : (
                grouped.map((group) => (
                  <div key={group.section}>
                    <p className="px-4 pt-3 pb-1 text-[11px] font-semibold text-muted uppercase tracking-wide bg-gray-50/60">
                      {group.section}
                    </p>
                    <ul>
                      {group.items.map((n) => {
                        const Icon = ACTIVITY_ICONS[n.type];

                        /* Content shared between link and div variants */
                        const content = (
                          <>
                            {/* Icon avatar */}
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity ${
                                n.read
                                  ? "bg-gray-100 text-muted"
                                  : "bg-surface-pink text-pink"
                              }`}
                            >
                              <Icon size={15} />
                            </span>

                            {/* Text */}
                            <div className={`flex-1 min-w-0 transition-opacity ${n.read ? "opacity-60" : ""}`}>
                              <p className="text-sm font-medium text-navy leading-snug">{n.title}</p>
                              <p className="text-xs text-muted mt-0.5">{n.detail}</p>
                              <p className="text-[11px] text-muted mt-0.5">{timeAgo(n.timestamp)}</p>
                            </div>

                            {/* Unread dot */}
                            <div className="flex-shrink-0 flex flex-col items-center gap-1 self-start pt-0.5">
                              {!n.read && (
                                <span className="w-2 h-2 rounded-full bg-pink" />
                              )}
                            </div>
                          </>
                        );

                        return (
                          <li
                            key={n.id}
                            className={`group relative border-b border-border last:border-0 transition-colors ${
                              !n.read ? "bg-surface-pink/40" : ""
                            } hover:bg-gray-50`}
                          >
                            {/* Main clickable area */}
                            {n.href ? (
                              <Link
                                href={n.href}
                                className="flex items-start gap-3 px-4 py-3 pr-20"
                                onClick={() => setOpen(false)}
                              >
                                {content}
                              </Link>
                            ) : (
                              <div className="flex items-start gap-3 px-4 py-3 pr-20">
                                {content}
                              </div>
                            )}

                            {/* Per-item action buttons — appear on hover */}
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={() => toggleRead(n.id, n.read)}
                                title={n.read ? "Mark as unread" : "Mark as read"}
                                className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-navy hover:bg-gray-200 transition-colors"
                              >
                                <CheckCheck size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeItem(n.id)}
                                title="Remove notification"
                                className="w-7 h-7 rounded flex items-center justify-center text-muted hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------- New Story button (route-aware) ---------------- */

export function NewStoryButton() {
  const { selectedProject } = useProject();
  const [showCreate, setShowCreate] = useState(false);
  const [showPaths, setShowPaths] = useState(false);

  return (
    <>
      <button
        type="button"
        data-tour="header-new-story"
        onClick={() => {
          // Validate a project is selected before creating a story.
          if (!selectedProject) {
            setShowCreate(true);
            return;
          }
          // Open the two-path chooser (Import vs Generate-from-requirements).
          setShowPaths(true);
        }}
        className="flex-shrink-0 inline-flex items-center gap-2 bg-pink text-white text-sm font-medium px-4 h-9 rounded-btn hover:bg-[#e0005f] transition-colors whitespace-nowrap max-w-[180px]"
      >
        <Plus size={16} />
        New Story
      </button>
      <NewStoryModal open={showPaths} onClose={() => setShowPaths(false)} />
      <CreateProjectModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => setShowPaths(true)}
      />
    </>
  );
}

/* ---------------- Global header actions (composable) ---------------- */

/**
 * The shared global controls (Project Selector · Credits · Notifications).
 * Rendered INSIDE each page's <PageActions> so they are constrained by the
 * page container width — never fixed/overflowing.
 */
export function HeaderActions() {
  return (
    <>
      <ProjectSelector />
      <CreditsIndicator />
      <NotificationBell />
    </>
  );
}
