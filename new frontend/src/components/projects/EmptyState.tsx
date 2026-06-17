"use client";

import { useState } from "react";
import { FolderPlus, Sparkles } from "lucide-react";
import { useProject } from "@/contexts/ProjectContext";
import { CreateProjectModal } from "./CreateProjectModal";

/** Shown when the user has no projects yet. */
export function NoProjects() {
  const { importSampleProjects } = useProject();
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-6">
      <div className="w-16 h-16 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-5">
        <FolderPlus size={28} />
      </div>
      <h2 className="text-xl font-semibold text-navy">No Projects Yet</h2>
      <p className="text-sm text-muted mt-1.5 max-w-sm">
        Projects organize your stories, tests, coverage and changes. Create one to
        get started, or import sample projects to explore.
      </p>
      <div className="flex items-center gap-3 mt-6">
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="h-10 px-5 rounded-btn bg-pink text-white text-sm font-medium hover:opacity-90 transition-opacity flex items-center gap-2"
        >
          <FolderPlus size={16} />
          Create Project
        </button>
        <button
          type="button"
          onClick={importSampleProjects}
          className="h-10 px-5 rounded-btn border border-border bg-white text-sm font-medium text-navy hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <Sparkles size={16} className="text-pink" />
          Import Sample Project
        </button>
      </div>

      <CreateProjectModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  );
}
