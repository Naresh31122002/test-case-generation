"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { get, ApiError } from "@/lib/apiClient";

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer" | null;

export interface WorkspacePermissions {
  role: WorkspaceRole;
  can_create_stories: boolean;
  can_generate_tests: boolean;
  can_edit_tests: boolean;
  can_delete_stories: boolean;
  can_manage_members: boolean;
}

const DEFAULT_PERMS: WorkspacePermissions = {
  role: null,
  can_create_stories: true,
  can_generate_tests: true,
  can_edit_tests: true,
  can_delete_stories: false,
  can_manage_members: false,
};

interface RBACContextValue {
  permissions: WorkspacePermissions;
  loading: boolean;
  refresh: () => void;
}

const RBACContext = createContext<RBACContextValue>({
  permissions: DEFAULT_PERMS,
  loading: true,
  refresh: () => {},
});

export function RBACProvider({ children }: { children: React.ReactNode }) {
  const [permissions, setPermissions] = useState<WorkspacePermissions>(DEFAULT_PERMS);
  const [loading, setLoading] = useState(true);

  const fetchRole = useCallback(async () => {
    setLoading(true);
    try {
      // Use apiClient.get() so the X-Workspace-Id header is automatically injected
      // from localStorage; without it @workspace_required on the backend would
      // fail to scope the role check to the correct tenant.
      const data = await get<{ role: WorkspaceRole; permissions?: Record<string, boolean> }>(
        "/api/workspaces/my-role"
      );
      const role = data.role as WorkspaceRole;
      // Role-based defaults (also use server-returned permissions if available)
      const p = data.permissions || {};
      setPermissions({
        role,
        can_create_stories: p.can_create_stories ?? (role !== "viewer"),
        can_generate_tests: p.can_generate_tests ?? (role !== "viewer"),
        can_edit_tests:     p.can_edit_tests     ?? (role !== "viewer"),
        can_delete_stories: p.can_delete_stories ?? (role === "owner" || role === "admin"),
        can_manage_members: p.can_manage_members ?? (role === "owner" || role === "admin"),
      });
    } catch (err) {
      // On 401 the apiClient will redirect to login; on other errors fall back
      // to default (no permissions) so the UI degrades gracefully.
      if (!(err instanceof ApiError && err.status === 401)) {
        console.error("[RBAC] fetchRole failed:", err);
      }
      setPermissions(DEFAULT_PERMS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRole(); }, [fetchRole]);

  return (
    <RBACContext.Provider value={{ permissions, loading, refresh: fetchRole }}>
      {children}
    </RBACContext.Provider>
  );
}

export function useRBAC() { return useContext(RBACContext); }

/** Convenience: returns true if user can perform the action.
 *  Returns true while loading (optimistic) — hides only once role is confirmed. */
export function useCanDo(permission: keyof Omit<WorkspacePermissions, "role">): boolean {
  const { permissions, loading } = useRBAC();
  if (loading) return true; // show buttons while role is being fetched
  return permissions[permission] ?? false;
}
