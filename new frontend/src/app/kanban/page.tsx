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

  const activeProjectId = useMemo(() => {
    if (!ready) return null;
    // Return the selected project ID if one is selected, undefined to load all
    return selectedProject?.id ?? undefined;
  }, [selectedProject?.id, ready]);

  const { stories, loading } = useStoriesStore(
    activeProjectId === null ? undefined : activeProjectId,
    activeProjectId === null ? false : true,
  );

  return (
    <PageLayout>
      <PageHeader
        title="Kanban"
        subtitle="Drag cards between columns to update status."
        actions={<PageActions />}
      />
      <PageBody className="overflow-x-auto">
        {ready && !hasProjects ? (
          <NoProjects />
        ) : (
          <>
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
              <StoryKanban stories={stories} />
            ) : (
              <TestCaseKanban stories={stories} />
            )}
          </>
        )}
      </PageBody>
    </PageLayout>
  );
}
