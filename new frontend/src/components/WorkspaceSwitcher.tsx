"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronsUpDown, Check, Building2 } from "lucide-react";
import {
  listWorkspaces,
  switchWorkspace,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
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
        // Always persist so X-Workspace-Id header is sent on every request
        if (resolvedId && resolvedId !== stored) {
          setActiveWorkspaceId(resolvedId);
          // Reload all data so it is scoped to the reconciled workspace
          router.refresh();
        }
        setActiveId(resolvedId);
      })
      .catch(() => setWorkspaces([]));
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

  async function choose(ws: Workspace) {
    setOpen(false);
    if (ws.id === activeId || busy) return;
    setBusy(true);
    try {
      await switchWorkspace(ws.id);
      setActiveId(ws.id);
      router.refresh(); // reload all server/client data for the new tenant
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
        title={active?.name ?? "Workspace"}
        className="w-full flex items-center gap-2 px-2 h-9 rounded-lg border border-border bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <span className="w-6 h-6 rounded bg-pink/10 text-pink flex items-center justify-center flex-shrink-0">
          <Building2 size={14} />
        </span>
        {!collapsed && (
          <>
            <span className="flex-1 min-w-0 truncate text-sm font-medium text-navy">
              {active?.name ?? "Workspace"}
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
        </div>
      )}
    </div>
  );
}
