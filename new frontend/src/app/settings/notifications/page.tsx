"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

const notifGroups = [
  {
    label: "Impact & Changes",
    items: [
      { id: "n1", label: "New change request created",       sub: "When AI detects cross-story impact",             defaultOn: true },
      { id: "n2", label: "Change request approved/rejected", sub: "When a reviewer acts on a change request",       defaultOn: true },
    ],
  },
  {
    label: "Coverage",
    items: [
      { id: "n3", label: "Coverage drops below threshold",   sub: "Alert when story coverage falls under 70%",      defaultOn: true },
      { id: "n4", label: "Coverage gaps detected",           sub: "When AI finds new untested areas",               defaultOn: false },
    ],
  },
  {
    label: "Tests",
    items: [
      { id: "n5", label: "Test generation complete",         sub: "When a story's test suite finishes generating",  defaultOn: false },
      { id: "n6", label: "Tests awaiting review",            sub: "Daily digest of pending test approvals",         defaultOn: true },
    ],
  },
];

const ALL_IDS = notifGroups.flatMap((g) => g.items).map((i) => i.id);

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(notifGroups.flatMap((g) => g.items).map((i) => [i.id, i.defaultOn]))
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.prefs && Object.keys(d.prefs).length > 0) {
          setPrefs(p => ({ ...p, ...d.prefs }));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

  async function save() {
    setSaving(true); setSaved(false);
    try {
      await fetch('/api/auth/me/notifications', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { }
    finally { setSaving(false); }
  }

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Notifications</h2>
        <p className="text-sm text-muted">Control which email alerts you receive.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-muted text-sm py-4">
          <Loader2 size={15} className="animate-spin" /> Loading preferences…
        </div>
      ) : notifGroups.map((group) => (
        <div key={group.label} className="bg-white border border-border rounded-card overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-gray-50">
            <p className="text-[13px] font-semibold text-navy">{group.label}</p>
          </div>
          {group.items.map((item, idx) => (
            <div key={item.id} className={`flex items-center justify-between px-5 py-4 ${idx < group.items.length - 1 ? "border-b border-border" : ""}`}>
              <div>
                <p className="text-sm font-medium text-navy">{item.label}</p>
                <p className="text-xs text-muted mt-0.5">{item.sub}</p>
              </div>
              <button
                onClick={() => toggle(item.id)}
                className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${prefs[item.id] ? "bg-pink" : "bg-border"}`}
                style={{ height: "22px" }}
              >
                <span
                  className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform"
                  style={{ transform: `translateX(${prefs[item.id] ? "22px" : "2px"})` }}
                />
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-60 flex items-center gap-2">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <span className="text-sm text-success font-medium">Saved ✓</span>}
      </div>
    </>
  );
}
