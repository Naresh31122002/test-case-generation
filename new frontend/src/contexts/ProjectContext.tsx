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

  // Hydrate from localStorage once.
  useEffect(() => {
    try {
      const rawProjects = localStorage.getItem(LS_PROJECTS);
      const rawSelected = localStorage.getItem(LS_SELECTED);
      const rawRecent = localStorage.getItem(LS_RECENT);
      if (rawProjects) {
        const parsed = JSON.parse(rawProjects) as Project[];
        if (parsed.length > 0) {
          setAllProjects(parsed);
        } else {
          setAllProjects(sampleProjects);
          setSelectedId(sampleProjects[0]?.id ?? null);
        }
      } else {
        // First visit — seed with sample projects, default selected = "default"
        setAllProjects(sampleProjects);
        setSelectedId("default");
      }
      // If saved selection is a sample that no longer makes sense, prefer "default"
      if (rawSelected) {
        setSelectedId(rawSelected);
      } else {
        setSelectedId("default");
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  // Persist whenever state changes (after hydration).
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(LS_PROJECTS, JSON.stringify(allProjects));
      localStorage.setItem(LS_RECENT, JSON.stringify(recentIds));
      if (selectedId) localStorage.setItem(LS_SELECTED, selectedId);
      else localStorage.removeItem(LS_SELECTED);
    } catch {
      /* ignore */
    }
  }, [allProjects, selectedId, recentIds, ready]);

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
