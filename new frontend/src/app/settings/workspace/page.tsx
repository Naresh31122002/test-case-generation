"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { get, patch } from "@/lib/apiClient";

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
    </>
  );
}
