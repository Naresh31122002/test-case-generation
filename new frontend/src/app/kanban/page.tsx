"use client";

import { useState, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { useStoriesStore } from "@/lib/storiesStore";
import { PageLayout, PageHeader, PageActions, PageBody } from "@/components/layout/PageLayout";
import { StoryKanban } from "@/components/StoryKanban";
import { TestCaseKanban } from "@/components/TestCaseKanban";
import { NoProjects } from "@/components/projects/EmptyState";

/**
 * Sprint 1 Phase 7 — dedicated Kanban page at /kanban.
 *
 * Reuses the exact same board components as the Stories page kanban view
 * (StoryKanban + TestCaseKanban) with the Stories / Test Cases sub-mode toggle.
 * No kanban logic is duplicated here — this is purely a routing + layout shell.
 */
export default function KanbanPage() {
  const { selectedProject, hasProjects, ready } = useProject();
  const [subMode, setSubMode] = useState<"story" | "testcase">("story");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const activeProjectId = useMemo(() => {
    if (!ready) return null;
    // Return the selected project ID if one is selected, undefined to load all
    return selectedProject?.id ?? undefined;
  }, [selectedProject?.id, ready]);

  const { stories, loading } = useStoriesStore(
    activeProjectId === null ? undefined : activeProjectId,
    activeProjectId === null ? false : true,
  );

  const filteredStories = useMemo(() => {
    return stories.filter(s => {
      if (statusFilter && (s as any).status !== statusFilter) return false;
      if (priorityFilter) {
        const hasPriority = (s as any).testCases?.some((tc: any) => tc.priority === priorityFilter);
        if (!hasPriority) return false;
      }
      return true;
    });
  }, [stories, statusFilter, priorityFilter]);

  return (
    <PageLayout>
      <PageHeader
        title="Kanban"
        subtitle="Drag cards between columns to update status."
        actions={<PageActions />}
      />
      <PageBody className="overflow-x-auto">
        {!ready || loading ? (
          <div className="flex h-full items-center justify-center py-20">
            <Loader2 size={28} className="animate-spin text-muted" />
          </div>
        ) : ready && !hasProjects ? (
          <NoProjects />
        ) : (
          <>
            {/* Filter bar */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="h-8 px-3 text-xs border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan">
                <option value="">All Status</option>
                <option value="in_review">In Review</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
                className="h-8 px-3 text-xs border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan">
                <option value="">All Priority</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
              {(statusFilter || priorityFilter) && (
                <button onClick={() => { setStatusFilter(""); setPriorityFilter(""); }}
                  className="text-xs text-pink hover:underline">Clear filters</button>
              )}
            </div>

            {/* Stories / Test Cases sub-mode toggle (same as Stories page). */}
            <div className="flex items-center gap-2 mb-6">
              <button
                onClick={() => setSubMode("story")}
                className={`h-7 px-3 rounded-btn border text-xs font-medium transition-colors ${
                  subMode === "story"
                    ? "bg-brand-primary-light text-brand-primary border-brand-primary"
                    : "bg-white text-muted border-border hover:text-navy"
                }`}
              >
                Stories
              </button>
              <button
                onClick={() => setSubMode("testcase")}
                className={`h-7 px-3 rounded-btn border text-xs font-medium transition-colors ${
                  subMode === "testcase"
                    ? "bg-brand-primary-light text-brand-primary border-brand-primary"
                    : "bg-white text-muted border-border hover:text-navy"
                }`}
              >
                Test Cases
              </button>
            </div>

            {loading ? (
              <div className="h-[50vh] flex items-center justify-center text-sm text-muted gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading board…
              </div>
            ) : subMode === "story" ? (
              <StoryKanban stories={filteredStories} />
            ) : (
              <TestCaseKanban stories={filteredStories} />
            )}
          </>
        )}
      </PageBody>
    </PageLayout>
  );
}
