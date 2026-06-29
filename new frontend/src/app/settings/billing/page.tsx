"use client";

import { useState, useEffect } from "react";
import { Loader2, Key, CheckCircle2, Trash2, Eye, EyeOff } from "lucide-react";
import { api } from "@/lib/api";

const PLANS = [
  { id: "free",       name: "Free",       price: "$0",   features: ["200 credits/mo", "1 workspace", "1 user"] },
  { id: "starter",    name: "Starter",    price: "$19",  features: ["500 credits/mo", "3 workspaces", "3 users"] },
  { id: "pro",        name: "Pro",        price: "$49",  features: ["2,000 credits/mo", "Unlimited workspaces", "5 users", "Impact analysis"] },
  { id: "team",       name: "Team",       price: "$149", features: ["10,000 credits/mo", "Unlimited everything", "25 users", "Priority support"] },
];

export default function BillingSettings() {
  const [credits, setCredits] = useState<any>(null);
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Own AI API key state
  const [ownKey, setOwnKey] = useState<{ has_key: boolean; masked_key: string | null; provider: string | null } | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [keyProvider, setKeyProvider] = useState("groq");
  const [keyVisible, setKeyVisible] = useState(false);
  const [keySaving, setKeySaving] = useState(false);
  const [keyDeleting, setKeyDeleting] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/workspaces/current/credits', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/workspaces/current', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/workspaces/ai-key', { credentials: 'include' }).then(r => r.json()),
    ]).then(([c, w, k]) => {
      setCredits(c.credits);
      setWorkspace(w.workspace ?? w);
      setOwnKey(k);
    }).catch((err: any) => {
      setActionError(err?.message ?? 'Failed to load billing information.');
    }).finally(() => setLoading(false));
  }, []);

  const currentPlan = workspace?.plan ?? 'free';
  const usedPct = credits ? Math.round((credits.used / credits.limit) * 100) : 0;

  async function handleSaveKey() {
    setKeySaving(true); setKeyError(null); setKeySuccess(null);
    try {
      const wsId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') || '' : '';
      const r = await fetch('/api/workspaces/ai-key', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-Workspace-Id': wsId },
        body: JSON.stringify({ api_key: keyInput.trim(), provider: keyProvider }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Failed to save key');
      setOwnKey({ has_key: true, masked_key: d.masked_key, provider: d.provider });
      setKeyInput('');
      setKeySuccess('API key saved! AI operations will now use your key — no credits deducted.');
      setTimeout(() => setKeySuccess(null), 5000);
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setKeySaving(false);
    }
  }

  async function handleDeleteKey() {
    setKeyDeleting(true); setKeyError(null);
    try {
      const wsId = typeof window !== 'undefined' ? localStorage.getItem('activeWorkspaceId') || '' : '';
      const r = await fetch('/api/workspaces/ai-key', {
        method: 'DELETE', credentials: 'include',
        headers: { 'X-Workspace-Id': wsId },
      });
      if (!r.ok) throw new Error('Failed to remove key');
      setOwnKey({ has_key: false, masked_key: null, provider: null });
      setKeySuccess('API key removed. System credits will be used again.');
      setTimeout(() => setKeySuccess(null), 4000);
    } catch (e: any) {
      setKeyError(e.message);
    } finally {
      setKeyDeleting(false);
    }
  }

  async function handleUpgrade(planId: string) {
    setCheckoutLoading(planId); setActionError(null);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId, success_url: window.location.href, cancel_url: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      setActionError(e?.message ?? 'Failed to start checkout. Please try again.');
    } finally {
      setCheckoutLoading(null);
    }
  }

  async function handleManageBilling() {
    setPortalLoading(true); setActionError(null);
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ return_url: window.location.href }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`);
      if (data.url) window.location.href = data.url;
    } catch (e: any) {
      setActionError(e?.message ?? 'Failed to open billing portal.');
    } finally {
      setPortalLoading(false);
    }
  }

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Billing</h2>
        <p className="text-sm text-muted">Manage your plan and billing details.</p>
      </div>

      {actionError && (
        <p className="text-sm text-error bg-[#FEF2F2] border border-[#FCA5A5] rounded-card px-3 py-2">{actionError}</p>
      )}

      {/* Credits usage */}
      <div className="bg-white border border-border rounded-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-navy">Credits this month</p>
          {loading && <Loader2 size={14} className="animate-spin text-muted" />}
        </div>
        {credits ? (
          <>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-navy">{credits.used}</span>
              <span className="text-sm text-muted mb-0.5">/ {credits.limit} used</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${usedPct > 85 ? 'bg-error' : usedPct > 60 ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${Math.min(usedPct, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted">Resets {credits.reset_date ? new Date(credits.reset_date).toLocaleDateString() : 'monthly'}</p>
          </>
        ) : !loading ? (
          <p className="text-xs text-muted">Could not load usage data</p>
        ) : null}
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          const isLoading = checkoutLoading === plan.id;
          return (
            <div key={plan.id} className={`border rounded-card p-4 ${isCurrent ? 'border-pink bg-surface-pink' : 'border-border bg-white'}`}>
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm font-semibold text-navy">{plan.name}</p>
                {isCurrent && <span className="text-[10px] font-bold text-pink bg-white px-1.5 py-0.5 rounded border border-pink">Current</span>}
              </div>
              <p className="text-2xl font-bold text-navy mb-1">{plan.price}<span className="text-sm font-normal text-muted">/mo</span></p>
              <ul className="space-y-1 mt-3 mb-4">
                {plan.features.map((f) => <li key={f} className="text-xs text-muted flex items-center gap-1.5"><span className="text-success">✓</span>{f}</li>)}
              </ul>
              {!isCurrent && (
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={!!checkoutLoading}
                  className={`w-full h-8 text-xs font-medium rounded-btn border transition-colors flex items-center justify-center gap-1 disabled:opacity-60 ${
                    plan.id === 'free' ? 'border-border text-navy hover:bg-gray-50' : 'bg-pink text-white border-pink hover:bg-[#e0005f]'
                  }`}
                >
                  {isLoading && <Loader2 size={11} className="animate-spin" />}
                  {plan.id === 'free' ? 'Downgrade' : 'Upgrade'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Manage billing */}
      <div className="bg-white border border-border rounded-card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">Billing portal</p>
          <p className="text-xs text-muted mt-0.5">Update payment method, view invoices</p>
        </div>
        <button
          onClick={handleManageBilling}
          disabled={portalLoading}
          className="h-8 px-4 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-1.5 disabled:opacity-60"
        >
          {portalLoading && <Loader2 size={11} className="animate-spin" />}
          Manage Billing
        </button>
      </div>

      {/* ── Own AI API Key ── */}
      <div className="bg-white border border-border rounded-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <span className="w-9 h-9 rounded-lg bg-cyan/10 flex items-center justify-center flex-shrink-0">
            <Key size={17} className="text-cyan" />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy">Use your own AI API key</p>
            <p className="text-xs text-muted mt-0.5 leading-relaxed">
              Bring your own Groq, OpenAI, or Anthropic key. AI operations will use your key
              instead of system credits — giving you unlimited usage.
            </p>
          </div>
        </div>

        {ownKey?.has_key ? (
          <div className="flex items-center gap-3 p-3 bg-success/5 border border-success/20 rounded-lg">
            <CheckCircle2 size={15} className="text-success flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-navy">Key active</p>
              <p className="text-xs text-muted font-mono truncate">{ownKey.masked_key} · {ownKey.provider}</p>
            </div>
            <button
              onClick={handleDeleteKey}
              disabled={keyDeleting}
              className="flex items-center gap-1.5 text-xs text-error hover:underline disabled:opacity-50"
            >
              {keyDeleting ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}
              Remove
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={keyProvider}
                onChange={e => setKeyProvider(e.target.value)}
                className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan flex-shrink-0"
              >
                <option value="groq">Groq (gsk_...)</option>
                <option value="openai">OpenAI (sk-...)</option>
                <option value="anthropic">Anthropic (sk-ant-...)</option>
              </select>
              <div className="relative flex-1">
                <input
                  type={keyVisible ? "text" : "password"}
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  placeholder="Paste your API key here"
                  className="w-full h-9 px-3 pr-9 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan font-mono"
                  onKeyDown={e => e.key === "Enter" && keyInput.trim() && handleSaveKey()}
                />
                <button
                  type="button"
                  onClick={() => setKeyVisible(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-navy"
                >
                  {keyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleSaveKey}
                disabled={keySaving || !keyInput.trim()}
                className="h-9 px-4 text-sm font-semibold bg-cyan text-white rounded-btn hover:bg-cyan/90 transition-colors disabled:opacity-40 flex items-center gap-1.5 flex-shrink-0"
              >
                {keySaving && <Loader2 size={13} className="animate-spin" />}
                Save key
              </button>
            </div>
            <p className="text-[11px] text-muted">
              Your key is stored securely and never exposed. Only used for AI operations in this workspace.
            </p>
          </div>
        )}

        {keyError && <p className="text-xs text-error">{keyError}</p>}
        {keySuccess && <p className="text-xs text-success">{keySuccess}</p>}
      </div>
    </>
  );
}
