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
import { get as apiGet, ApiError } from "@/lib/apiClient";

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
  /** Set when the backend project fetch failed (after the 403 retry, if any). Null when load succeeded. */
  loadError: string | null;
  /** Re-runs the backend project fetch (e.g. from an error-state "Retry" button). */
  reloadProjects: () => void;
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
// Locally-created projects that have no stories yet (not yet in backend).
// Merged with real projects on load; dropped once a story exists in the project.
const LS_LOCAL_PROJECTS = "testsurge:local-projects";

function describeLoadError(err: unknown): string {
  if (err instanceof ApiError) {
    return err.message || `Failed to load projects (HTTP ${err.status}).`;
  }
  return "Could not reach the server. Check your connection and try again.";
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reloadProjects = useCallback(() => setReloadToken((n) => n + 1), []);

  // Always fetch real projects from backend on mount — never use cached project list.
  // Only persist the selected project ID and recent IDs.
  useEffect(() => {
    let cancelled = false;

    async function fetchProjects() {
      const [projectsData, storiesData] = await Promise.all([
        apiGet<{ projects?: string[] }>("/api/stories/projects"),
        apiGet<{ stories?: any[] }>("/api/stories/?page=1&per_page=200&sort_order=desc"),
      ]);
      const projectIds: string[] = projectsData.projects ?? [];
      const stories = storiesData.stories ?? [];

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

      return realProjects;
    }

    async function loadProjects() {
      setLoadError(null);

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
        const realProjects = await fetchProjects();
        if (cancelled) return;

        // Merge locally-created projects that don't yet have stories.
        // Once a project has real stories it will appear in realProjects; drop the local copy then.
        const localRaw = (() => { try { return JSON.parse(localStorage.getItem(LS_LOCAL_PROJECTS) ?? "[]"); } catch { return []; } })();
        const realIds = new Set(realProjects.map((p: Project) => p.id));
        const localOnly = (localRaw as Project[]).filter((p) => !realIds.has(p.id));
        // Prune local projects that now have real backing so localStorage doesn't grow unboundedly
        if (localOnly.length !== localRaw.length) {
          try { localStorage.setItem(LS_LOCAL_PROJECTS, JSON.stringify(localOnly)); } catch {}
        }
        const merged = [...realProjects, ...localOnly];
        setAllProjects(merged);

        if (merged.length > 0) {
          // If saved selection doesn't match any merged project, auto-select first
          const saved = localStorage.getItem(LS_SELECTED);
          if (!saved || !merged.find((p) => p.id === saved)) {
            const firstId = merged[0].id;
            setSelectedId(firstId);
            localStorage.setItem(LS_SELECTED, firstId);
            localStorage.setItem("activeProject", firstId);
          }
        }
        // If backend was reachable but returned no projects, show empty state (new user) —
        // never substitute fake demo projects.
      } catch (err) {
        // A stale/cross-tenant X-Workspace-Id (e.g. left over from a previous user on a
        // shared browser) is rejected by the backend with 403. Clear it and retry once
        // with no workspace header — the backend then falls back to the JWT claim / the
        // user's own default workspace. Never show fake projects on this path.
        if (err instanceof ApiError && err.status === 403) {
          try { localStorage.removeItem("activeWorkspaceId"); } catch {}
          try {
            const retried = await fetchProjects();
            if (cancelled) return;
            setAllProjects(retried);
            if (retried.length > 0) {
              const saved = localStorage.getItem(LS_SELECTED);
              if (!saved || !retried.find((p) => p.id === saved)) {
                const firstId = retried[0].id;
                setSelectedId(firstId);
                localStorage.setItem(LS_SELECTED, firstId);
                localStorage.setItem("activeProject", firstId);
              }
            }
            return;
          } catch (retryErr) {
            if (cancelled) return;
            setAllProjects([]);
            setLoadError(describeLoadError(retryErr));
            return;
          }
        }

        if (cancelled) return;
        setAllProjects([]);
        setLoadError(describeLoadError(err));
      }
    }

    loadProjects().finally(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, [reloadToken]);

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
      try { localStorage.setItem("activeProject", project.id); } catch {}
      // Persist locally so the project survives a reload before any story is uploaded to it.
      try {
        const existing: Project[] = JSON.parse(localStorage.getItem(LS_LOCAL_PROJECTS) ?? "[]");
        existing.unshift(project);
        localStorage.setItem(LS_LOCAL_PROJECTS, JSON.stringify(existing.slice(0, 20)));
      } catch {}
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
      try { localStorage.setItem("activeProject", first.id); } catch {}
    }
  }, [pushRecent]);

  /* ---- Management actions ---- */

  const renameProject = useCallback((id: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const newId = trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    // Optimistic UI update
    setAllProjects((prev) =>
      prev.map((p) => p.id === id ? { ...p, id: newId, name: trimmed, updatedAt: new Date().toISOString().slice(0, 10) } : p)
    );
    if (selectedId === id) { setSelectedId(newId); try { localStorage.setItem(LS_SELECTED, newId); } catch {} }
    // Persist to backend (fire-and-forget)
    apiGet(`/api/stories/projects/${id}`).catch(() => {});
    import('@/lib/apiClient').then(({ request }) =>
      request(`/api/stories/projects/${id}`, { method: 'PATCH', body: JSON.stringify({ new_id: newId }) })
    ).catch(() => {});
  }, [selectedId]);

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
        if (selectedId === id) {
          const nextActive = remaining.find((p) => !p.archived);
          setSelectedId(nextActive?.id ?? null);
          if (nextActive) pushRecent(nextActive.id);
        }
        return remaining;
      });
      setRecentIds((prev) => prev.filter((x) => x !== id));
      // Delete all stories in this project on the backend
      import('@/lib/apiClient').then(({ request }) =>
        request(`/api/stories/projects/${id}`, { method: 'DELETE' })
      ).catch(() => {});
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
      loadError,
      reloadProjects,
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
      loadError,
      reloadProjects,
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
