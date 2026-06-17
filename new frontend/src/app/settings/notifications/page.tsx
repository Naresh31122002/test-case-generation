"use client";

import { useState } from "react";

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

export default function NotificationsSettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(notifGroups.flatMap((g) => g.items).map((i) => [i.id, i.defaultOn]))
  );

  const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Notifications</h2>
        <p className="text-sm text-muted">Control which email alerts you receive.</p>
      </div>

      {notifGroups.map((group) => (
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
                className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${
                  prefs[item.id] ? "bg-pink" : "bg-border"
                }`}
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

      <div>
        <button className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
          Save Preferences
        </button>
      </div>
    </>
  );
}
