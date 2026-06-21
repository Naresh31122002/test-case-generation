"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

export default function ProfileSettings() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Seed form from real user on mount
  useEffect(() => {
    if (user) {
      setName((user as any).display_name || user.email.split("@")[0] || "");
    }
  }, [user]);

  const initials = name
    ? name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)
    : (user?.email?.[0] ?? "?").toUpperCase();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateProfile({ display_name: name.trim() });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err?.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Profile</h2>
        <p className="text-sm text-muted">Manage your personal account details.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        <div className="bg-white border border-border rounded-card p-5 space-y-5">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-pink flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-navy">{user?.email}</p>
              <p className="text-xs text-muted mt-0.5">Avatar is auto-generated from your initials</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Display name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy focus:outline-none focus:border-pink transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
            <input
              type="email"
              value={user?.email ?? ""}
              readOnly
              className="w-full h-10 px-3 rounded-btn border border-border text-sm text-muted bg-gray-50 cursor-not-allowed"
            />
            <p className="text-xs text-muted mt-1">Email cannot be changed here.</p>
          </div>
        </div>

        {error && <p className="text-sm text-error">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
          {saved && <span className="text-sm text-success font-medium">Saved ✓</span>}
        </div>
      </form>
    </>
  );
}
