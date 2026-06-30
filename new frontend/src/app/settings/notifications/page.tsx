"use client";

import { useState, useEffect, useRef } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  useEffect(() => {
    fetch('/api/auth/me/notifications', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.prefs && Object.keys(d.prefs).length > 0) {
          setPrefs(p => ({ ...p, ...d.prefs }));
        }
      })
      .catch(() => {}) // backend unavailable — keep defaults, no error shown
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

  async function save() {
    setSaving(true); setSaved(false); setError(null);
    try {
      const res = await fetch('/api/auth/me/notifications', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
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
                aria-checked={prefs[item.id]}
                role="switch"
                style={{ width: 44, height: 24, borderRadius: 12, padding: 0, border: 'none', cursor: 'pointer', flexShrink: 0, position: 'relative', transition: 'background-color 0.2s', backgroundColor: prefs[item.id] ? '#FF0A78' : '#D1D5DB' }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                    position: 'absolute',
                    top: 2,
                    left: prefs[item.id] ? 22 : 2,
                    transition: 'left 0.2s',
                  }}
                />
              </button>
            </div>
          ))}
        </div>
      ))}

      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={save} disabled={saving}
          className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-60 flex items-center gap-2">
          {saving && <Loader2 size={13} className="animate-spin" />}
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
        {saved && <span className="text-sm text-success font-medium">Saved ✓</span>}
        {error && <span className="text-sm text-error">{error}</span>}
      </div>
    </>
  );
}
