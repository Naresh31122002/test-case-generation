// lib/workspaces.ts
// Workspace management helpers — list, create, switch, and track the active
// workspace. The active workspace ID is mirrored in localStorage so the
// X-Workspace-Id header can be set client-side on every request.

import { get, post } from './apiClient'

export interface Workspace {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
  plan: string
}

const ACTIVE_KEY = 'activeWorkspaceId'
const ACTIVE_NAME_KEY = 'activeWorkspaceName'

export function getActiveWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_KEY)
}

export function getActiveWorkspaceName(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_NAME_KEY)
}

export function setActiveWorkspaceId(id: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, id)
}

export function setActiveWorkspaceName(name: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_NAME_KEY, name)
}

function normalizeWorkspace(raw: any): Workspace {
  return {
    id: String(raw?.id ?? raw?.workspace_id ?? ''),
    name: String(raw?.name ?? ''),
    slug: String(raw?.slug ?? ''),
    role: (raw?.role ?? 'member') as Workspace['role'],
    plan: String(raw?.plan ?? 'free'),
  }
}

export async function listWorkspaces(): Promise<Workspace[]> {
  try {
    const data = await get<any>('/api/workspaces')
    const items: any[] = Array.isArray(data) ? data : (data?.workspaces ?? [])
    return items.map(normalizeWorkspace)
  } catch {
    return []
  }
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const data = await post<any>('/api/workspaces', { name })
  return normalizeWorkspace(data?.workspace ?? data)
}

export async function switchWorkspace(workspaceId: string, workspaceName?: string): Promise<void> {
  await post('/api/workspaces/switch', { workspace_id: workspaceId })
  setActiveWorkspaceId(workspaceId)
  if (workspaceName) {
    setActiveWorkspaceName(workspaceName)
  }
  // Full page reload resets all React context (ProjectContext, storiesStore)
  // so the new workspace's data loads fresh without stale state.
  window.location.href = '/stories';
}
