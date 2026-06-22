"use client";

import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Search,
  LayoutGrid,
  List,
  Kanban,
  TestTube2,
  Zap,
  Plus,
  MoreHorizontal,
  GitCompare,
  Download,
  ExternalLink,
  Trash2,
  Sparkles,
  X,
} from "lucide-react";
import { type Story } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { StatusChip } from "@/components/ui/StatusChip";
import { ConfirmModal, type ConfirmState } from "@/components/ui/ConfirmModal";
import { useFloatingPanel } from "@/components/ui/useFloatingPanel";
import { useAIAction, AI_ACTION_COSTS } from "@/contexts/AIActionContext";
import { staggerContainer, fadeInUp } from "@/lib/motion";
import { useProject } from "@/contexts/ProjectContext";
import { NoProjects } from "@/components/projects/EmptyState";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import { Loader2, AlertCircle } from "lucide-react";
import { useStoriesStore, invalidateStories } from "@/lib/storiesStore";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";
import { NewStoryButton } from "@/components/HeaderActions";
import { NewStoryModal } from "@/components/stories/NewStoryModal";
import { StoryKanban } from "@/components/StoryKanban";
import { TestCaseKanban } from "@/components/TestCaseKanban";

type ViewMode = "board" | "list" | "kanban";
type SortKey = "lastUpdated" | "name" | "coverageAsc" | "coverageDesc" | "impactDesc";

/* ---------------- Story Health Score ---------------- */

interface HealthResult {
  score: number;
  factors: {
    coverage: number;
    testCount: number;
    acceptanceCriteria: number;
    risk: number;
  };
}

/** Weighted health score (0-100) from Coverage, Test Count, Acceptance Criteria, Risk. */
function computeHealth(story: Story): HealthResult {
  // Coverage (0-100) → 40%
  const coverage = story.coverage;
  // Test count → 20% (12+ tests considered healthy)
  const testCount = Math.min(100, (story.testCount / 12) * 100);
  // Acceptance criteria → 20% (5+ criteria considered complete)
  const acceptanceCriteria = Math.min(
    100,
    (story.acceptanceCriteria.length / 5) * 100
  );
  // Risk → 20% (penalize High/Medium risk areas)
  const riskPenalty = story.riskAreas.reduce((sum, r) => {
    if (r.severity === "High") return sum + 30;
    if (r.severity === "Medium") return sum + 15;
    return sum + 5;
  }, 0);
  const risk = Math.max(0, 100 - riskPenalty);

  const score = Math.round(
    coverage * 0.4 + testCount * 0.2 + acceptanceCriteria * 0.2 + risk * 0.2
  );

  return { score, factors: { coverage, testCount, acceptanceCriteria, risk } };
}

function healthColor(score: number): string {
  if (score >= 80) return "#10B981"; // success
  if (score >= 60) return "#F59E0B"; // warning
  return "#EF4444"; // error
}

/* ---------------- Story Tags ---------------- */

/** Derive tags from existing story fields (type + content). */
function deriveTags(story: Story): string[] {
  const tags = new Set<string>();
  const text = `${story.title} ${story.content} ${story.id}`.toLowerCase();

  if (story.type === "OAuth" || text.includes("oauth")) tags.add("OAuth");
  if (story.type === "Security" || text.includes("security")) tags.add("Security");
  if (
    text.includes("login") ||
    text.includes("auth") ||
    text.includes("password") ||
    text.includes("registration")
  )
    tags.add("Authentication");
  if (
    text.includes("payment") ||
    text.includes("checkout") ||
    text.includes("billing")
  )
    tags.add("Payment");

  return Array.from(tags);
}

const tagStyles: Record<string, string> = {
  Security: "bg-[#FEF2F2] text-[#991B1B] border-[#FCA5A5]",
  Payment: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  Authentication: "bg-[#EFF6FF] text-[#1E40AF] border-[#93C5FD]",
  OAuth: "bg-brand-primary-light text-brand-primary border-brand-primary",
};

function StoryTags({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="flex flex-wrap gap-1 mb-3">
      {tags.map((tag) => (
        <span
          key={tag}
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
            tagStyles[tag] ?? "bg-gray-50 text-muted border-border"
          }`}
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Saved Filters ---------------- */

type SavedFilterId = "high-risk" | "low-coverage" | "oauth";

interface SavedFilter {
  id: SavedFilterId;
  label: string;
  predicate: (s: Story) => boolean;
}

const savedFilters: SavedFilter[] = [
  {
    id: "high-risk",
    label: "High Risk",
    predicate: (s) => s.riskAreas.some((r) => r.severity === "High"),
  },
  {
    id: "low-coverage",
    label: "Low Coverage",
    predicate: (s) => s.coverage < 70,
  },
  {
    id: "oauth",
    label: "OAuth Stories",
    predicate: (s) => deriveTags(s).includes("OAuth"),
  },
];

export default function StoriesPage() {
  const { selectedProject, hasProjects, ready, reloadProjects } = useProject();
  const { notify } = useAIAction();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [kanbanSubMode, setKanbanSubMode] = useState<"story" | "testcase">("story");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<SavedFilterId | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  // Sprint 1 Phase 3: server-side story filters.
  const [storyStatus, setStoryStatus] = useState<string>("");
  const [storyPriority, setStoryPriority] = useState<string>("");
  const [storyImpact, setStoryImpact] = useState<string>("");

  // Debounce search to avoid a request on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(t);
  }, [search]);

  const serverFilters = useMemo(() => ({
    ...(storyStatus ? { status: [storyStatus] } : {}),
    ...(storyPriority ? { priority: [storyPriority] } : {}),
    ...(storyImpact ? { impact: storyImpact as 'detected' | 'none' } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  }), [storyStatus, storyPriority, storyImpact, debouncedSearch]);

  // Derive the active project ID to filter by.
  // Wait until ProjectContext is ready -- otherwise first render fetches ALL stories
  // before the selected project is known, causing a flash of unfiltered results.
  const activeProjectId = useMemo(() => {
    if (!ready) return null; // null = don't fetch yet
    if (typeof window !== "undefined") {
      const urlParam = new URLSearchParams(window.location.search).get("project_id");
      if (urlParam) return urlParam;
    }
    return selectedProject?.id ?? undefined;
  }, [selectedProject?.id, ready]);

  // Real stories from backend -- use the global store with background polling
  // Pass undefined (not null) to skip fetching while project context loads
  const { stories: projectStories, loading: storiesLoading, error: storiesError, refresh: refreshStories } = useStoriesStore(
    activeProjectId === null ? undefined : activeProjectId,
    activeProjectId === null ? false : true, // enabled flag
    serverFilters, // Phase 3: filters applied server-side
  );
  const projectStoryIds = useMemo(
    () => new Set(projectStories.map((s) => s.id)),
    [projectStories]
  );

  const filtered = useMemo(() => {
    let result = [...projectStories];
    // Search is now server-side (via debouncedSearch in serverFilters) -- no client-side filter needed.
    if (filterType !== "All Types") {
      result = result.filter((s) => s.type === filterType);
    }
    // Saved filter preset
    if (activeFilter) {
      const preset = savedFilters.find((f) => f.id === activeFilter);
      if (preset) result = result.filter(preset.predicate);
    }
    switch (sortKey) {
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "coverageAsc":
        result.sort((a, b) => a.coverage - b.coverage);
        break;
      case "coverageDesc":
        result.sort((a, b) => b.coverage - a.coverage);
        break;
      case "impactDesc":
        result.sort((a, b) => b.impactCount - a.impactCount);
        break;
    }
    return result;
  }, [projectStories, filterType, sortKey, activeFilter]);

  // Bulk selection helpers
  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());
  const selectedStories = filtered.filter((s) => selected.has(s.id));

  // Permanently delete one or more stories. Backend deletes from Postgres +
  // LanceDB (workspace-scoped); on success we drop them from local config,
  // clear any selection, refresh project counts, and toast the result.
  const deleteStories = (ids: string[]) => {
    if (ids.length === 0) return;
    const label = ids.length === 1 ? "story" : `${ids.length} stories`;
    setConfirmState({
      title: `Delete ${label}`,
      message: `This permanently removes the ${ids.length === 1 ? "story and its" : "stories and their"} test cases. This cannot be undone.`,
      confirmLabel: `Delete ${label}`,
      onConfirm: async () => {
        const results = await Promise.allSettled(ids.map((id) => api.deleteStory(id)));
        const okIds = ids.filter((_, i) => results[i].status === "fulfilled");
        const failed = ids.length - okIds.length;
        if (okIds.length > 0) {
          setSelected((prev) => { const next = new Set(prev); okIds.forEach((id) => next.delete(id)); return next; });
          setOpenMenu(null);
          reloadProjects();
          invalidateStories();
        }
        if (failed === 0) {
          notify({ variant: "success", title: okIds.length === 1 ? "Story deleted" : `${okIds.length} stories deleted` });
        } else if (okIds.length === 0) {
          notify({ variant: "error", title: "Delete failed", detail: "Could not delete. Please try again." });
        } else {
          notify({ variant: "error", title: "Some deletes failed", detail: `${okIds.length} deleted, ${failed} failed.` });
        }
      },
    });
  };

  // Empty config: no projects yet.
  if (storiesLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 size={28} className="animate-spin text-muted" />
      </div>
    );
  }

  if (ready && !hasProjects) {
    return <NoProjects />;
  }

  return (
    <PageLayout>
      <PageHeader
        title="Stories"
        actions={<PageActions primary={<NewStoryButton />} />}
      />

      {/* Page content */}
      <PageBody className={viewMode === "kanban" ? "overflow-x-auto" : ""}>
        {/* Toolbar */}
        <div className={`flex items-center gap-3 mb-6 ${viewMode === "kanban" ? "px-6" : ""}`}>
          {viewMode !== "kanban" && <div className="relative w-[280px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search stories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 text-sm border border-border rounded-btn bg-white text-navy placeholder:text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 transition-colors"
            />
          </div>}

          {viewMode !== "kanban" && <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option>All Types</option>
            <option>Functional</option>
            <option>OAuth</option>
            <option>Security</option>
          </select>}

          {/* Phase 3: server-side filters (Status · Priority · Impact). */}
          {viewMode !== "kanban" && <select
            value={storyStatus}
            onChange={(e) => setStoryStatus(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="in_review">In Review</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>}

          {viewMode !== "kanban" && <select
            value={storyPriority}
            onChange={(e) => setStoryPriority(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option value="">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>}

          {viewMode !== "kanban" && <select
            value={storyImpact}
            onChange={(e) => setStoryImpact(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option value="">All Impact</option>
            <option value="detected">Impact Detected</option>
            <option value="none">No Impact</option>
          </select>}

          {viewMode !== "kanban" && <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option value="lastUpdated">Last Updated</option>
            <option value="name">Name A-Z</option>
            <option value="coverageDesc">Coverage (High-Low)</option>
            <option value="coverageAsc">Coverage (Low-High)</option>
            <option value="impactDesc">Impact (High)</option>
          </select>}

          {viewMode !== "kanban" && (
            <div className="flex items-center gap-1.5">
              {savedFilters.map((f) => {
                const on = activeFilter === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setActiveFilter(on ? null : f.id)}
                    className={`inline-flex items-center gap-1 h-9 px-3 rounded-btn border text-xs font-medium transition-colors ${
                      on
                        ? "bg-brand-primary-light text-brand-primary border-brand-primary"
                        : "bg-white text-muted border-border hover:text-navy hover:bg-gray-50"
                    }`}
                  >
                    {f.label}
                    {on && <X size={12} />}
                  </button>
                );
              })}
            </div>
          )}

          {viewMode === "kanban" && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setKanbanSubMode("story")}
                className={`h-7 px-3 rounded-btn border text-xs font-medium transition-colors ${
                  kanbanSubMode === "story"
                    ? "bg-brand-primary-light text-brand-primary border-brand-primary"
                    : "bg-white text-muted border-border hover:text-navy"
                }`}
              >
                Stories
              </button>
              <button
                onClick={() => setKanbanSubMode("testcase")}
                className={`h-7 px-3 rounded-btn border text-xs font-medium transition-colors ${
                  kanbanSubMode === "testcase"
                    ? "bg-brand-primary-light text-brand-primary border-brand-primary"
                    : "bg-white text-muted border-border hover:text-navy"
                }`}
              >
                Test Cases
              </button>
            </div>
          )}

          <div className="ml-auto flex items-center border border-border rounded-btn overflow-hidden">
            <button
              onClick={() => setViewMode("board")}
              className={`w-9 h-9 flex items-center justify-center transition-colors ${
                viewMode === "board" ? "bg-surface-pink text-pink" : "bg-white text-muted hover:text-navy"
              }`}
              title="Card view"
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
            <button
              onClick={() => setViewMode("kanban")}
              className={`w-9 h-9 flex items-center justify-center transition-colors ${
                viewMode === "kanban" ? "bg-surface-pink text-pink" : "bg-white text-muted hover:text-navy"
              }`}
              title="Kanban view"
            >
              <Kanban size={16} />
            </button>
          </div>
        </div>

        {/* Bulk actions bar */}
        <AnimatePresence>
          {viewMode !== "kanban" && selected.size > 0 && (
            <BulkActionBar
              count={selected.size}
              stories={selectedStories}
              onClear={clearSelection}
              onDelete={() => deleteStories(selectedStories.map((s) => s.id))}
            />
          )}
        </AnimatePresence>

        {/* Content */}
        <AnimatePresence mode="wait">
          {viewMode === "kanban" ? (
            <motion.div
              key={`kanban-${kanbanSubMode}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              {kanbanSubMode === "story" ? (
                <StoryKanban stories={filtered} />
              ) : (
                <TestCaseKanban stories={filtered} />
              )}
            </motion.div>
          ) : storiesError ? (
            <div className="flex items-center gap-3 py-3 px-1 text-sm text-error">
              <AlertCircle size={16} className="flex-shrink-0" />
              Could not load stories.
              <button onClick={refreshStories} className="underline hover:no-underline ml-1">Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState key="empty" hasSearch={!!search} />
          ) : viewMode === "board" ? (
            <BoardView
              key={`board-${filterType}-${sortKey}-${activeFilter}`}
              stories={filtered}
              selected={selected}
              onToggleSelect={toggleSelect}
            />
          ) : (
            <ListView
              key={`list-${filterType}-${sortKey}-${activeFilter}`}
              stories={filtered}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
              selected={selected}
              onToggleSelect={toggleSelect}
              onDelete={(id) => deleteStories([id])}
            />
          )}
        </AnimatePresence>
      </PageBody>
    </PageLayout>
    <ConfirmModal config={confirmState} onClose={() => setConfirmState(null)} />
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  const [showPaths, setShowPaths] = useState(false);
  return (
    <motion.div
      {...fadeInUp}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <BookOpen size={48} className="text-muted mb-4" />
      <h2 className="text-h2 text-navy mb-2">
        {hasSearch ? "No stories match your search" : "No stories yet"}
      </h2>
      <p className="text-sm text-muted max-w-sm mb-6">
        {hasSearch
          ? "Try a different search term or clear filters."
          : "Upload a user story, paste requirements, or import from Jira to get started."}
      </p>
      {!hasSearch && (
        <>
          <button
            type="button"
            onClick={() => setShowPaths(true)}
            className="inline-flex items-center gap-2 bg-pink text-white text-sm font-medium px-4 h-9 rounded-btn hover:bg-[#e0005f] transition-colors"
          >
            <Plus size={16} />
            Create Your First Story
          </button>
          <NewStoryModal open={showPaths} onClose={() => setShowPaths(false)} />
        </>
      )}
    </motion.div>
  );
}

function BulkActionBar({
  count,
  stories,
  onClear,
  onDelete,
}: {
  count: number;
  stories: Story[];
  onClear: () => void;
  onDelete: () => void;
}) {
  const { runAIAction } = useAIAction();
  const ids = stories.map((s) => s.id).join(",");

  const bulkGenerate = () =>
    runAIAction({
      name: "Bulk Story Processing",
      credits: AI_ACTION_COSTS.bulkProcessing,
      description: `Generate tests for ${count} selected ${count === 1 ? "story" : "stories"} in one batch.`,
      run: async () => {
        const results = await Promise.allSettled(
          stories.map((s) => api.regenerateTests(s.id))
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed === results.length) throw new Error("All regenerations failed. Please try again.");
      },
    });
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.15 }}
      className="flex items-center gap-3 mb-5 px-4 h-12 bg-brand-primary-light border border-brand-primary rounded-card"
    >
      <span className="text-sm font-medium text-navy">
        {count} selected
      </span>
      <div className="h-5 w-px bg-brand-primary/30" />
      <button
        type="button"
        onClick={bulkGenerate}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-pink hover:opacity-80 transition-opacity"
      >
        <Sparkles size={15} />
        Generate Tests
      </button>
      <Link
        href={`/exports?story=${ids}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-navy hover:text-pink transition-colors"
      >
        <Download size={15} />
        Export
      </Link>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-error hover:opacity-80 transition-opacity"
      >
        <Trash2 size={15} />
        Delete
      </button>
      <button
        type="button"
        onClick={onClear}
        className="ml-auto text-muted hover:text-navy transition-colors"
        title="Clear selection"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

function BoardView({
  stories,
  selected,
  onToggleSelect,
}: {
  stories: Story[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {stories.map((story) => (
        <StoryCard
          key={story.id}
          story={story}
          isSelected={selected.has(story.id)}
          onToggleSelect={() => onToggleSelect(story.id)}
        />
      ))}
    </motion.div>
  );
}

function HealthBar({ health }: { health: HealthResult }) {
  const color = healthColor(health.score);
  const { factors } = health;
  // Smart floating panel -- flips up when there's no room below, never overflows.
  const { triggerRef, panelRef, position, open, setOpen, Portal } =
    useFloatingPanel<HTMLDivElement, HTMLDivElement>({ preferred: "bottom", gap: 6 });

  return (
    <div
      ref={triggerRef}
      className="relative mb-3"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium text-muted">Health Score</span>
        <span className="text-[11px] font-bold tabular-nums" style={{ color }}>
          {health.score}/100
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{ width: `${health.score}%`, backgroundColor: color }}
        />
      </div>

      <AnimatePresence>
        {open && (
          <Portal>
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: position?.placement === "top" ? 4 : -4 }}
              animate={{ opacity: position ? 1 : 0, y: 0 }}
              exit={{ opacity: 0, y: position?.placement === "top" ? 4 : -4 }}
              transition={{ duration: 0.12 }}
              className="fixed z-[70] w-56 bg-white border border-border rounded-card shadow-card p-2.5 pointer-events-none"
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                // Keep it invisible/off-screen for the measure pass (no position yet).
                visibility: position ? "visible" : "hidden",
              }}
            >
              <p className="text-[11px] font-semibold text-navy mb-1.5">Based on</p>
              {[
                { label: "Coverage", value: factors.coverage },
                { label: "Test Count", value: factors.testCount },
                { label: "Acceptance Criteria", value: factors.acceptanceCriteria },
                { label: "Risk", value: factors.risk },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between text-[11px] py-0.5">
                  <span className="text-muted">{f.label}</span>
                  <span className="font-medium text-navy tabular-nums">
                    {Math.round(f.value)}
                  </span>
                </div>
              ))}
            </motion.div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
}

function StoryCard({
  story,
  isSelected,
  onToggleSelect,
}: {
  story: Story;
  isSelected: boolean;
  onToggleSelect: () => void;
}) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);
  const health = computeHealth(story);
  const tags = deriveTags(story);

  const href = `/stories/${story.id}`;
  const openStory = () => router.push(href);

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -2 }}
      // Prefetch the story route on hover so the click feels instant.
      onHoverStart={() => { setHovered(true); router.prefetch(href); }}
      onHoverEnd={() => setHovered(false)}
      onClick={openStory}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openStory();
        }
      }}
      className="relative bg-white border rounded-card p-5 cursor-pointer overflow-hidden transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan/40"
      style={{
        borderColor: isSelected ? "var(--color-brand-primary)" : hovered ? "#06B6D4" : "#E2E8F0",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {/* Selection checkbox -- selects only, never opens the story */}
      <label
        className="absolute top-3 left-3 z-10"
        style={{ opacity: hovered || isSelected ? 1 : 0, transition: "opacity 0.15s" }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="w-4 h-4 rounded border-border accent-pink cursor-pointer"
        />
      </label>

      {/* Row 1: ID + Status */}
      <div className="flex items-center justify-between mb-2 pl-6">
        <span className="text-[11px] font-semibold text-cyan">{story.id}</span>
        <StatusChip status={story.status} />
      </div>

      {/* Row 2: Title */}
      <h3 className="text-[15px] font-semibold text-navy line-clamp-2 mb-3 leading-snug">
        {story.title}
      </h3>

      {/* Tags */}
      <StoryTags tags={tags} />

      {/* Health score */}
      <HealthBar health={health} />

      {/* Row 3: Coverage + Tests + Impact */}
      <div className="flex items-center gap-3 mb-3">
        <CoverageRing coverage={story.coverage} size={48} strokeWidth={5} showLabel />
        <div className="flex items-center gap-1 text-xs text-muted">
          <TestTube2 size={13} />
          <span>{story.testCount} Tests</span>
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            story.impactCount > 0 ? "text-pink" : "text-muted"
          }`}
        >
          <Zap size={13} />
          <span>Impact: {story.impactCount}</span>
        </div>
      </div>

      {/* Row 4: Last updated */}
      <p className="text-[11px] text-muted">Last updated {story.lastUpdated}</p>

      {/* Hover overlay */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-8"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0) 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <Link
                href={`/stories/${story.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-medium text-navy hover:text-pink transition-colors px-2 py-1 rounded hover:bg-surface-pink"
              >
                <ExternalLink size={12} />
                Open
              </Link>
              <Link
                href={`/compare?a=${story.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-medium text-muted hover:text-navy transition-colors px-2 py-1 rounded hover:bg-gray-50"
              >
                <GitCompare size={12} />
                Compare
              </Link>
              <Link
                href={`/exports?story=${story.id}`}
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1 text-xs font-medium text-muted hover:text-navy transition-colors px-2 py-1 rounded hover:bg-gray-50"
              >
                <Download size={12} />
                Export
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ListView({
  stories,
  openMenu,
  setOpenMenu,
  selected,
  onToggleSelect,
  onDelete,
}: {
  stories: Story[];
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="bg-white border border-border rounded-card overflow-hidden"
    >
      {/* Header */}
      <div className="grid grid-cols-[36px_100px_1fr_90px_80px_100px_80px_120px_80px] items-center px-4 py-2.5 border-b border-border bg-gray-50">
        {["", "Story ID", "Title", "Health", "Tests", "Coverage", "Impact", "Last Updated", ""].map(
          (col, i) => (
            <span
              key={i}
              className={`text-[11px] font-semibold text-muted uppercase tracking-wide ${
                i === 3 || i === 4 || i === 5 || i === 6 ? "text-center" : ""
              } ${i === 8 ? "text-right" : ""}`}
            >
              {col}
            </span>
          )
        )}
      </div>

      {stories.map((story, idx) => {
        const health = computeHealth(story);
        return (
        <motion.div
          key={story.id}
          variants={fadeInUp}
          className={`grid grid-cols-[36px_100px_1fr_90px_80px_100px_80px_120px_80px] items-center px-4 py-3 hover:bg-gray-50 transition-colors ${
            idx < stories.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <input
            type="checkbox"
            checked={selected.has(story.id)}
            onChange={() => onToggleSelect(story.id)}
            className="w-4 h-4 rounded border-border accent-pink cursor-pointer"
          />
          <span className="text-[11px] font-semibold text-cyan">{story.id}</span>
          <Link
            href={`/stories/${story.id}`}
            className="text-sm font-medium text-navy hover:text-pink truncate pr-4 transition-colors"
          >
            {story.title}
          </Link>
          <div className="flex items-center justify-center gap-1.5">
            <span
              className="text-xs font-bold tabular-nums"
              style={{ color: healthColor(health.score) }}
              title={`Coverage ${Math.round(health.factors.coverage)} · Tests ${Math.round(
                health.factors.testCount
              )} · Criteria ${Math.round(
                health.factors.acceptanceCriteria
              )} · Risk ${Math.round(health.factors.risk)}`}
            >
              {health.score}
            </span>
          </div>
          <span className="text-sm text-muted text-center">{story.testCount}</span>
          <div className="flex items-center justify-center gap-1.5">
            <CoverageRing coverage={story.coverage} size={28} strokeWidth={3} />
            <span className="text-xs font-semibold text-navy">{story.coverage}%</span>
          </div>
          <div className="text-center">
            {story.impactCount > 0 ? (
              <span className="inline-block text-[11px] font-semibold bg-brand-primary-light text-brand-primary border border-brand-primary rounded-full px-2 py-0.5">
                {story.impactCount}
              </span>
            ) : (
              <span className="text-sm text-muted">--</span>
            )}
          </div>
          <span className="text-xs text-muted">{story.lastUpdated}</span>
          <div className="relative flex justify-end">
            <button
              onClick={() =>
                setOpenMenu(openMenu === story.id ? null : story.id)
              }
              className="w-8 h-8 flex items-center justify-center rounded text-muted hover:text-navy hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {openMenu === story.id && (
              <div className="absolute right-0 top-9 z-20 bg-white border border-border rounded-lg shadow-card py-1 w-36">
                <Link
                  href={`/stories/${story.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  <ExternalLink size={14} />
                  Open
                </Link>
                <Link
                  href={`/compare?a=${story.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  <GitCompare size={14} />
                  Compare
                </Link>
                <Link
                  href={`/exports?story=${story.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  <Download size={14} />
                  Export
                </Link>
                <div className="my-1 border-t border-border" />
                <button
                  onClick={() => { setOpenMenu(null); onDelete(story.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-[#FEF2F2] transition-colors"
                >
                  <Trash2 size={14} />
                  Delete Story
                </button>
              </div>
            )}
          </div>
        </motion.div>
        );
      })}
    </motion.div>
  );
}
