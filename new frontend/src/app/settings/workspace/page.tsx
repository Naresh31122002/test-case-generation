"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle, Plus, ArrowRight, Building2, Trash2 } from "lucide-react";
import { get, patch, del } from "@/lib/apiClient";
import {
  listWorkspaces,
  switchWorkspace,
  createWorkspace,
  type Workspace,
} from "@/lib/workspaces";

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];

const ANALYSIS_TYPES = ["Functional", "Negative", "Boundary", "Security", "Performance"];

export default function WorkspaceSettings() {
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("America/New_York");
  const [analysisTypes, setAnalysisTypes] = useState<Set<string>>(new Set(ANALYSIS_TYPES));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // My Workspaces state
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [wsLoading, setWsLoading] = useState(false);
  const [showCreateWs, setShowCreateWs] = useState(false);
  const [newWsName, setNewWsName] = useState("");

  // Delete workspace state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    get<{ workspace: { name: string; config?: { timezone?: string; analysis_types?: string[] } } }>(
      "/api/workspaces/current"
    )
      .then((data) => {
        if (cancelled) return;
        setName(data.workspace?.name ?? "");
        setTimezone(data.workspace?.config?.timezone ?? "America/New_York");
        const types = data.workspace?.config?.analysis_types;
        if (types?.length) setAnalysisTypes(new Set(types));
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? 'Failed to load workspace settings.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    // Load all workspaces for the My Workspaces section
    listWorkspaces().then((ws) => {
      if (cancelled) return;
      setWorkspaces(ws);
      const stored = typeof window !== "undefined" ? localStorage.getItem("activeWorkspaceId") : null;
      setActiveWsId(stored ?? ws[0]?.id ?? null);
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      await patch("/api/workspaces/current", {
        name: name.trim(),
        config: {
          timezone,
          analysis_types: Array.from(analysisTypes),
        },
      });
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function toggleType(t: string) {
    setAnalysisTypes((prev) => {
      const n = new Set(prev);
      n.has(t) ? n.delete(t) : n.add(t);
      return n;
    });
  }

  async function handleCreateWorkspace() {
    if (!newWsName.trim() || wsLoading) return;
    setWsLoading(true);
    try {
      const ws = await createWorkspace(newWsName.trim());
      await switchWorkspace(ws.id);
      setWorkspaces((prev) => [...prev, ws]);
      setActiveWsId(ws.id);
      setNewWsName("");
      setShowCreateWs(false);
      window.location.reload();
    } catch {
      /* ignore — keep form open */
    } finally {
      setWsLoading(false);
    }
  }

  async function handleDeleteWorkspace() {
    if (deleteConfirmName !== name) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await del("/api/workspaces/current");
      // Clear workspace from localStorage and redirect
      try { localStorage.removeItem("activeWorkspaceId"); } catch {}
      window.location.href = "/onboarding/workspace";
    } catch (err: any) {
      setDeleteError(err?.message ?? "Failed to delete workspace. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted py-8">
        <Loader2 size={16} className="animate-spin" /> Loading workspace settings…
      </div>
    );
  }

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Workspace</h2>
        <p className="text-sm text-muted">Manage your workspace configuration.</p>
      </div>

      {/* My Workspaces */}
      <div className="bg-white border border-border rounded-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-navy">My Workspaces</h3>
            <p className="text-xs text-muted mt-0.5">Switch between workspaces or create a new one.</p>
          </div>
          <button
            onClick={() => setShowCreateWs((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-pink hover:text-pink/80 transition-colors"
          >
            <Plus size={13} />
            New workspace
          </button>
        </div>

        {showCreateWs && (
          <div className="flex gap-2 mb-4">
            <input
              autoFocus
              value={newWsName}
              onChange={(e) => setNewWsName(e.target.value)}
              placeholder="Workspace name…"
              className="flex-1 h-9 px-3 text-sm border border-border rounded-btn focus:outline-none focus:border-pink"
              onKeyDown={async (e) => {
                if (e.key === "Enter" && newWsName.trim()) {
                  await handleCreateWorkspace();
                }
              }}
            />
            <button
              disabled={!newWsName.trim() || wsLoading}
              onClick={handleCreateWorkspace}
              className="h-9 px-4 text-sm font-semibold text-white bg-pink rounded-btn hover:bg-pink/90 transition-colors disabled:opacity-40 flex items-center justify-center"
            >
              {wsLoading ? <Loader2 size={14} className="animate-spin" /> : "Create"}
            </button>
          </div>
        )}

        <div className="space-y-2">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-gray-50 transition-colors"
            >
              <span className="w-8 h-8 rounded-lg bg-pink/10 text-pink flex items-center justify-center text-sm font-bold flex-shrink-0">
                {ws.name.charAt(0).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy truncate">{ws.name}</p>
                <p className="text-xs text-muted">
                  {ws.id === activeWsId ? "Currently active" : "Click to switch"}
                </p>
              </div>
              {ws.id === activeWsId ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-pink/10 text-pink">
                  Active
                </span>
              ) : (
                <button
                  onClick={async () => {
                    await switchWorkspace(ws.id);
                    setActiveWsId(ws.id);
                    window.location.reload();
                  }}
                  className="text-[11px] font-semibold px-3 py-1 rounded-btn border border-border text-navy hover:bg-gray-100 transition-colors flex items-center gap-1"
                >
                  Switch <ArrowRight size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-border rounded-card p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Workspace name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-border rounded-btn text-navy focus:outline-none focus:border-cyan transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Timezone</label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full h-9 px-3 text-sm border border-border rounded-btn text-navy bg-white focus:outline-none focus:border-cyan transition-colors"
          >
            {TIMEZONES.map((tz) => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">Default analysis types</label>
          <div className="space-y-2">
            {ANALYSIS_TYPES.map((t) => (
              <label key={t} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={analysisTypes.has(t)}
                  onChange={() => toggleType(t)}
                  className="w-4 h-4 accent-pink"
                />
                <span className="text-sm text-navy">{t}</span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="text-sm text-error flex items-center gap-1.5">
            <AlertCircle size={14} /> {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
          {saved && (
            <span className="text-sm text-success flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Saved
            </span>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white border border-red-200 rounded-card p-5">
        <h3 className="text-sm font-semibold text-error mb-1">Danger Zone</h3>
        <p className="text-xs text-muted mb-4">
          Permanently delete this workspace and all its stories, test cases, and data. This cannot be undone.
        </p>
        <button
          onClick={() => { setShowDeleteConfirm(true); setDeleteConfirmName(""); setDeleteError(null); }}
          className="h-9 px-4 text-sm font-semibold text-error border border-error rounded-btn hover:bg-red-50 transition-colors flex items-center gap-2"
        >
          <Trash2 size={14} />
          Delete Workspace
        </button>
      </div>

      {/* Delete Workspace Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-card shadow-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center gap-2 mb-3">
              <Trash2 size={18} className="text-error" />
              <h3 className="text-base font-semibold text-navy">Delete Workspace</h3>
            </div>
            <p className="text-sm text-muted mb-1">
              This will permanently delete <span className="font-semibold text-navy">{name}</span> and all its stories, test cases, and data.
            </p>
            <p className="text-sm text-muted mb-4">
              To confirm, type the workspace name below:
            </p>
            <input
              autoFocus
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={name}
              className="w-full h-9 px-3 text-sm border border-border rounded-btn focus:outline-none focus:border-error mb-4 transition-colors"
              onKeyDown={(e) => { if (e.key === "Enter" && deleteConfirmName === name) handleDeleteWorkspace(); }}
            />
            {deleteError && (
              <p className="text-sm text-error flex items-center gap-1.5 mb-3">
                <AlertCircle size={13} /> {deleteError}
              </p>
            )}
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmName(""); setDeleteError(null); }}
                disabled={deleting}
                className="h-9 px-4 text-sm font-medium text-navy border border-border rounded-btn hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                disabled={deleteConfirmName !== name || deleting}
                className="h-9 px-4 text-sm font-semibold text-white bg-error rounded-btn hover:bg-red-700 transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
