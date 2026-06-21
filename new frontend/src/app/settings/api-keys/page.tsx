"use client";

import { useState, useEffect } from "react";
import { Copy, Trash2, Plus, Loader2, Check } from "lucide-react";

interface ApiKey { id: string; name: string; key_prefix: string; created_at: string; last_used_at: string | null; }

export default function ApiKeysSettings() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);  // shown once after creation
  const [copied, setCopied] = useState(false);

  function loadKeys() {
    fetch('/api/auth/api-keys', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setKeys(d.keys ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadKeys(); }, []);

  async function create() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const r = await fetch('/api/auth/api-keys', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setNewKey(d.key);
      setNewName(""); setShowNew(false);
      loadKeys();
    } catch { }
    finally { setCreating(false); }
  }

  async function revoke(id: string) {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      await fetch(`/api/auth/api-keys/${id}`, { method: 'DELETE', credentials: 'include' });
      setKeys(k => k.filter(x => x.id !== id));
    } catch { }
  }

  function copyKey() {
    if (!newKey) return;
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-navy mb-1">API Keys</h2>
          <p className="text-sm text-muted">Create and revoke API keys for programmatic access.</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2">
          <Plus size={14} /> Create Key
        </button>
      </div>

      {/* New key just created — show once */}
      {newKey && (
        <div className="bg-success/10 border border-success/30 rounded-card p-4 space-y-2">
          <p className="text-sm font-semibold text-success">Key created — copy it now, it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white border border-border rounded px-3 py-2 font-mono truncate">{newKey}</code>
            <button onClick={copyKey}
              className="h-9 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 flex items-center gap-1.5">
              {copied ? <Check size={13} className="text-success" /> : <Copy size={13} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button onClick={() => setNewKey(null)} className="text-muted hover:text-navy text-xs underline">Dismiss</button>
          </div>
        </div>
      )}

      {showNew && (
        <div className="bg-surface-cyan border border-cyan/30 rounded-card p-4 flex items-center gap-3">
          <input type="text" placeholder="Key name (e.g. CI Pipeline)" value={newName}
            onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} autoFocus
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
          />
          <button onClick={create} disabled={creating || !newName.trim()}
            className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-1.5 disabled:opacity-60">
            {creating && <Loader2 size={12} className="animate-spin" />} Generate
          </button>
          <button onClick={() => setShowNew(false)} className="h-9 px-3 text-sm text-muted hover:text-navy transition-colors">Cancel</button>
        </div>
      )}

      <div className="bg-white border border-border rounded-card overflow-hidden">
        <div className="grid grid-cols-[1fr_160px_120px_60px] px-5 py-2.5 bg-gray-50 border-b border-border">
          {["Name / Prefix", "Created", "Last Used", ""].map((h, i) => (
            <span key={i} className={`text-[11px] font-semibold text-muted uppercase tracking-wide ${i === 3 ? "text-right" : ""}`}>{h}</span>
          ))}
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted text-sm"><Loader2 size={15} className="animate-spin" />Loading…</div>
        ) : keys.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted text-center">No API keys yet.</p>
        ) : keys.map((k, idx) => (
          <div key={k.id} className={`grid grid-cols-[1fr_160px_120px_60px] px-5 py-3.5 items-center ${idx < keys.length - 1 ? "border-b border-border" : ""}`}>
            <div>
              <p className="text-sm font-semibold text-navy">{k.name}</p>
              <p className="text-xs text-muted font-mono mt-0.5">{k.key_prefix}</p>
            </div>
            <span className="text-xs text-muted">{new Date(k.created_at).toLocaleDateString()}</span>
            <span className="text-xs text-muted">{k.last_used_at ? new Date(k.last_used_at).toLocaleDateString() : 'Never'}</span>
            <div className="flex justify-end">
              <button onClick={() => revoke(k.id)}
                className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-error hover:bg-[#FEF2F2] transition-colors" title="Revoke key">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
