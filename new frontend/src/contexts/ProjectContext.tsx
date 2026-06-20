"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  type Project,
  sampleProjects,
  createProject as makeProject,
} from "@/lib/projects";
import { get as apiGet } from "@/lib/apiClient";

interface ProjectContextValue {
  selectedProject: Project | null;
  /** Active (non-archived) projects. */
  projectList: Project[];
  /** Archived projects. */
  archivedProjects: Project[];
  recentProjects: Project[];
  hasProjects: boolean;
  /** True until localStorage has been read (avoids hydration flash). */
  ready: boolean;
  selectProject: (id: string) => void;
  createProject: (name: string, description: string, domain?: string) => Project;
  importSampleProjects: () => void;
  renameProject: (id: string, newName: string) => void;
  archiveProject: (id: string) => void;
  unarchiveProject: (id: string) => void;
  deleteProject: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

const LS_PROJECTS = "testsurge:projects";
const LS_SELECTED = "testsurge:selected-project";
const LS_RECENT = "testsurge:recent-projects";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  // Always fetch real projects from backend on mount — never use cached project list.
  // Only persist the selected project ID and recent IDs.
  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      // Restore selected project immediately from localStorage
      try {
        const rawSelected = localStorage.getItem(LS_SELECTED);
        const rawRecent = localStorage.getItem(LS_RECENT);
        if (rawSelected) {
          setSelectedId(rawSelected);
          localStorage.setItem("activeProject", rawSelected);
        }
        if (rawRecent) setRecentIds(JSON.parse(rawRecent));
      } catch {}

      // Fetch real projects from backend (via apiClient: workspace header + 401-refresh-retry)
      try {
        const [projectsData, storiesData] = await Promise.all([
          apiGet<{ projects?: string[] }>("/stories/projects"),
          apiGet<{ stories?: any[] }>("/stories/?page=1&per_page=200&sort_order=desc"),
        ]);

        if (!cancelled) {
          const projectIds: string[] = projectsData.projects ?? [];
          const stories = storiesData.stories ?? [];

          if (projectIds.length > 0) {
            const realProjects: Project[] = projectIds.map((pid) => {
              const projectStories = stories.filter((s: any) => s.project_id === pid);
              const testCount = projectStories.reduce((sum: number, s: any) => sum + (Number(s.test_case_count) || 0), 0);
              const name = pid
                .split(/[-_\s]+/)
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ");
              return {
                id: pid,
                name,
                description: `${projectStories.length} ${projectStories.length === 1 ? "story" : "stories"}`,
                domain: "",
                createdAt: new Date().toISOString().slice(0, 10),
                updatedAt: new Date().toISOString().slice(0, 10),
                storyCount: projectStories.length,
                testCount,
                storyIds: projectStories.map((s: any) => s.id),
              } as Project;
            });

            setAllProjects(realProjects);

            // If saved selection doesn't match any real project, auto-select first
            const saved = localStorage.getItem(LS_SELECTED);
            if (!saved || !realProjects.find((p) => p.id === saved)) {
              const firstId = realProjects[0].id;
              setSelectedId(firstId);
              localStorage.setItem(LS_SELECTED, firstId);
              localStorage.setItem("activeProject", firstId);
            }
            return;
          }
        }
      } catch { /* backend unreachable */ }

      // Fallback to sample projects if backend is down
      if (!cancelled) {
        setAllProjects(sampleProjects);
      }
    }

    loadProjects().finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  // Only persist selected project ID and recents — never the project list (always fetched from DB)
  useEffect(() => {
    if (!ready) return;
    try {
      if (selectedId) localStorage.setItem(LS_SELECTED, selectedId);
      else localStorage.removeItem(LS_SELECTED);
      localStorage.setItem(LS_RECENT, JSON.stringify(recentIds));
    } catch {}
  }, [selectedId, recentIds, ready]);

  // Derived: active vs archived
  const projectList = useMemo(
    () => allProjects.filter((p) => !p.archived),
    [allProjects]
  );
  const archivedProjects = useMemo(
    () => allProjects.filter((p) => p.archived),
    [allProjects]
  );

  const selectedProject = useMemo(
    () => projectList.find((p) => p.id === selectedId) ?? null,
    [projectList, selectedId]
  );

  const recentProjects = useMemo(
    () =>
      recentIds
        .map((id) => projectList.find((p) => p.id === id))
        .filter((p): p is Project => Boolean(p)),
    [recentIds, projectList]
  );

  const pushRecent = useCallback((id: string) => {
    setRecentIds((prev) => [id, ...prev.filter((x) => x !== id)].slice(0, 5));
  }, []);

  const selectProject = useCallback(
    (id: string) => {
      setSelectedId(id);
      pushRecent(id);
      // Sync to localStorage.activeProject so the backend filter stays in sync
      try { localStorage.setItem("activeProject", id); } catch {}
    },
    [pushRecent]
  );

  const createProject = useCallback(
    (name: string, description: string, domain?: string) => {
      const project = makeProject(name, description, domain);
      setAllProjects((prev) => [project, ...prev]);
      setSelectedId(project.id);
      pushRecent(project.id);
      return project;
    },
    [pushRecent]
  );

  const importSampleProjects = useCallback(() => {
    setAllProjects((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const merged = [...prev, ...sampleProjects.filter((s) => !existing.has(s.id))];
      return merged;
    });
    const first = sampleProjects[0];
    if (first) {
      setSelectedId(first.id);
      pushRecent(first.id);
    }
  }, [pushRecent]);

  /* ---- Management actions ---- */

  const renameProject = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setAllProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, name: trimmed, updatedAt: new Date().toISOString().slice(0, 10) }
          : p
      )
    );
  }, []);

  const archiveProject = useCallback(
    (id: string) => {
      setAllProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, archived: true } : p))
      );
      // If archiving the selected project, switch to another active one.
      if (selectedId === id) {
        const nextActive = allProjects.find((p) => !p.archived && p.id !== id);
        if (nextActive) {
          setSelectedId(nextActive.id);
          pushRecent(nextActive.id);
        } else {
          setSelectedId(null);
        }
      }
    },
    [selectedId, allProjects, pushRecent]
  );

  const unarchiveProject = useCallback((id: string) => {
    setAllProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, archived: false } : p))
    );
  }, []);

  const deleteProject = useCallback(
    (id: string) => {
      setAllProjects((prev) => {
        const remaining = prev.filter((p) => p.id !== id);
        // If deleting the selected project, switch to next active.
        if (selectedId === id) {
          const nextActive = remaining.find((p) => !p.archived);
          setSelectedId(nextActive?.id ?? null);
          if (nextActive) pushRecent(nextActive.id);
        }
        return remaining;
      });
      // Clean from recents
      setRecentIds((prev) => prev.filter((x) => x !== id));
    },
    [selectedId, pushRecent]
  );

  // Memoize the context value so consumers don't re-render unless data changes.
  const value = useMemo<ProjectContextValue>(
    () => ({
      selectedProject,
      projectList,
      archivedProjects,
      recentProjects,
      hasProjects: projectList.length > 0,
      ready,
      selectProject,
      createProject,
      importSampleProjects,
      renameProject,
      archiveProject,
      unarchiveProject,
      deleteProject,
    }),
    [
      selectedProject,
      projectList,
      archivedProjects,
      recentProjects,
      ready,
      selectProject,
      createProject,
      importSampleProjects,
      renameProject,
      archiveProject,
      unarchiveProject,
      deleteProject,
    ]
  );

  return (
    <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProject must be used within ProjectProvider");
  return ctx;
}
