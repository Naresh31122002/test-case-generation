"use client";

import { useState } from "react";
import { Copy, Trash2, Plus } from "lucide-react";

const mockKeys = [
  { id: "k1", name: "CI Pipeline",       prefix: "ts_live_ci••••••••",     created: "May 1, 2025",  lastUsed: "2h ago" },
  { id: "k2", name: "Local Development", prefix: "ts_live_dev••••••••",    created: "Apr 12, 2025", lastUsed: "1d ago" },
];

export default function ApiKeysSettings() {
  const [keys, setKeys] = useState(mockKeys);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");

  const create = () => {
    if (!newName.trim()) return;
    setKeys([...keys, {
      id: Date.now().toString(),
      name: newName,
      prefix: `ts_live_${Math.random().toString(36).slice(2, 6)}••••••••`,
      created: "Just now",
      lastUsed: "Never",
    }]);
    setNewName("");
    setShowNew(false);
  };

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-navy mb-1">API Keys</h2>
          <p className="text-sm text-muted">Create and revoke API keys for programmatic access.</p>
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2"
        >
          <Plus size={14} /> Create Key
        </button>
      </div>

      {showNew && (
        <div className="bg-surface-cyan border border-cyan/30 rounded-card p-4 flex items-center gap-3">
          <input
            type="text"
            placeholder="Key name (e.g. CI Pipeline)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            autoFocus
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
          />
          <button onClick={create} className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
            Generate
          </button>
          <button onClick={() => setShowNew(false)} className="h-9 px-3 text-sm text-muted hover:text-navy transition-colors">
            Cancel
          </button>
        </div>
      )}

      <div className="bg-white border border-border rounded-card overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_120px_80px] px-5 py-2.5 bg-gray-50 border-b border-border">
          {["Name / Key", "Created", "Last Used", ""].map((h, i) => (
            <span key={i} className={`text-[11px] font-semibold text-muted uppercase tracking-wide ${i === 3 ? "text-right" : ""}`}>{h}</span>
          ))}
        </div>
        {keys.map((k, idx) => (
          <div key={k.id} className={`grid grid-cols-[1fr_160px_120px_80px] px-5 py-3.5 items-center ${idx < keys.length - 1 ? "border-b border-border" : ""}`}>
            <div>
              <p className="text-sm font-semibold text-navy">{k.name}</p>
              <p className="text-xs text-muted font-mono mt-0.5">{k.prefix}</p>
            </div>
            <span className="text-xs text-muted">{k.created}</span>
            <span className="text-xs text-muted">{k.lastUsed}</span>
            <div className="flex justify-end gap-2">
              <button className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-navy hover:bg-gray-100 transition-colors" title="Copy key">
                <Copy size={13} />
              </button>
              <button
                onClick={() => setKeys(keys.filter((x) => x.id !== k.id))}
                className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-error hover:bg-[#FEF2F2] transition-colors"
                title="Revoke key"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
        {keys.length === 0 && (
          <p className="px-5 py-8 text-sm text-muted text-center">No API keys yet.</p>
        )}
      </div>
    </>
  );
}
