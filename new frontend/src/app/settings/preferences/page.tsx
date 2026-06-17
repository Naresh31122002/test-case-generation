"use client";

import { useState } from "react";

const prefGroups = [
  {
    label: "Appearance",
    items: [
      { id: "p1", label: "Compact mode", sub: "Reduce padding across lists and cards", defaultOn: false },
      { id: "p2", label: "Show health scores", sub: "Display story health on cards", defaultOn: true },
    ],
  },
  {
    label: "Workflow",
    items: [
      { id: "p3", label: "Auto-generate tests on upload", sub: "Run generation as soon as a story is added", defaultOn: true },
      { id: "p4", label: "Confirm before deleting", sub: "Ask for confirmation on destructive actions", defaultOn: true },
    ],
  },
];

export default function PreferencesSettings() {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(prefGroups.flatMap((g) => g.items).map((i) => [i.id, i.defaultOn]))
  );

  const toggle = (id: string) => setPrefs((p) => ({ ...p, [id]: !p[id] }));

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Preferences</h2>
        <p className="text-sm text-muted">Customize how TestSurge works for you.</p>
      </div>

      {prefGroups.map((group) => (
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
                className={`relative w-10 rounded-full transition-colors flex-shrink-0 ${
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
