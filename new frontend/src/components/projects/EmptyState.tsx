"use client";

import { FolderOpen, Plus } from "lucide-react";

/** Shown when the user has no projects yet. */
export function NoProjects() {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-20 max-w-lg mx-auto">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pink/10 to-cyan/10 border border-border flex items-center justify-center mb-6">
        <FolderOpen size={32} className="text-pink" />
      </div>
      <h2 className="text-xl font-bold text-navy mb-2">Welcome to TestSurge</h2>
      <p className="text-sm text-muted leading-relaxed mb-8 max-w-sm">
        TestSurge turns your user stories and requirements into comprehensive test cases in seconds — using AI. Start by creating your first project.
      </p>
      <div className="w-full space-y-3 mb-8">
        {[
          { step: "1", title: "Create a project", desc: "Organise your stories by product area, team, or release" },
          { step: "2", title: "Upload a user story", desc: "Paste text or upload PDF, Word, or TXT files" },
          { step: "3", title: "Generate test cases", desc: "AI creates functional, security, boundary, and edge case tests" },
          { step: "4", title: "Review & export", desc: "Approve, edit, and export to TestRail, Jira, or automation scripts" },
        ].map(item => (
          <div key={item.step} className="flex items-start gap-3 p-3 rounded-xl bg-white border border-border text-left">
            <span className="w-7 h-7 rounded-full bg-pink text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{item.step}</span>
            <div>
              <p className="text-sm font-semibold text-navy">{item.title}</p>
              <p className="text-xs text-muted">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <a href="/stories/new" data-tour="create-first-story-btn" className="inline-flex items-center gap-2 h-11 px-8 rounded-btn bg-pink text-white text-sm font-bold hover:bg-pink/90 transition-colors">
        <Plus size={16} />
        Create your first story
      </a>
    </div>
  );
}
