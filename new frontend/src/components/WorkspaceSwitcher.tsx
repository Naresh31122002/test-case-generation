"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check, Building2, Plus } from "lucide-react";
import {
  listWorkspaces,
  switchWorkspace,
  getActiveWorkspaceId,
  getActiveWorkspaceName,
  setActiveWorkspaceId,
  setActiveWorkspaceName,
  type Workspace,
} from "@/lib/workspaces";

/**
 * Minimal workspace switcher. Lists the user's workspaces and switches the active
 * tenant. Switching re-issues the access cookie (server) + updates the
 * X-Workspace-Id header (client), then refreshes the route so all data reloads
 * scoped to the new workspace.
 */
export function WorkspaceSwitcher({ collapsed = false }: { collapsed?: boolean }) {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    listWorkspaces()
      .then((ws) => {
        if (cancelled) return;
        setWorkspaces(ws);
        const stored = getActiveWorkspaceId();
        const resolvedId = (stored && ws.find((w) => w.id === stored))
          ? stored
          : ws[0]?.id ?? null;
        if (resolvedId && resolvedId !== stored) {
          // Active workspace changed (e.g. first load with no stored ID) —
          // update localStorage, server cookie, and reload. switchWorkspace now
          // performs a full page reload so no separate router.refresh() needed.
          const resolvedWs = ws.find((w) => w.id === resolvedId);
          setActiveWorkspaceId(resolvedId);
          if (resolvedWs) setActiveWorkspaceName(resolvedWs.name);
          switchWorkspace(resolvedId, resolvedWs?.name).catch(() => {});
        } else if (resolvedId) {
          // Refresh cached name in case it changed (e.g. after onboarding rename)
          const resolvedWs = ws.find((w) => w.id === resolvedId);
          if (resolvedWs) setActiveWorkspaceName(resolvedWs.name);
        }
        setActiveId(resolvedId);
      })
      .catch(() => { if (!cancelled) setWorkspaces([]); });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  // Use cached name from localStorage as a fallback while workspaces haven't
  // loaded yet (e.g. right after onboarding workspace rename) so the switcher
  // shows the correct name immediately instead of the old stale value.
  const displayName = active?.name ?? getActiveWorkspaceName() ?? "Workspace";

  async function choose(ws: Workspace) {
    setOpen(false);
    if (ws.id === activeId || busy) return;
    setBusy(true);
    try {
      await switchWorkspace(ws.id, ws.name);
      // switchWorkspace does window.location.href — code below this line
      // will not execute. setBusy(false) in finally runs before the reload.
    } catch {
      /* keep current workspace on failure */
    } finally {
      setBusy(false);
    }
  }

  // Phase 6: when the user has no workspace yet, surface a Create Workspace
  // action instead of nothing (the Team menu stays hidden until one exists).
  if (workspaces.length === 0) {
    return (
      <button
        type="button"
        onClick={() => router.push("/onboarding/workspace")}
        title="Create your first workspace"
        className="w-full flex items-center gap-2 px-2 h-9 rounded-lg border border-dashed border-border bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="w-6 h-6 rounded bg-pink/10 text-pink flex items-center justify-center flex-shrink-0">
          <Building2 size={14} />
        </span>
        {!collapsed && (
          <span className="flex-1 min-w-0 truncate text-sm font-medium text-pink">Create Workspace</span>
        )}
      </button>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={displayName}
        className="w-full flex items-center gap-2 px-2 h-9 rounded-lg border border-border bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="w-6 h-6 rounded bg-pink/10 text-pink flex items-center justify-center flex-shrink-0">
          <Building2 size={14} />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-navy">
              {displayName}
            </span>
            <ChevronsUpDown size={14} className="text-muted flex-shrink-0" />
          </>
        )}
      </button>

      {open && !collapsed && (
        <div className="absolute bottom-11 left-0 right-0 z-50 bg-white border border-border rounded-lg shadow-card py-1 max-h-64 overflow-y-auto">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => choose(ws)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors"
            >
              <span className="flex-1 min-w-0 truncate text-navy">{ws.name}</span>
              {ws.id === activeId && <Check size={14} className="text-pink flex-shrink-0" />}
            </button>
          ))}
          <div className="border-t border-border mt-1 pt-1">
            <button
              type="button"
              onClick={() => { setOpen(false); router.push("/onboarding/workspace"); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-pink hover:bg-pink/5 transition-colors"
            >
              <Plus size={14} className="flex-shrink-0" />
              <span>New workspace</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
