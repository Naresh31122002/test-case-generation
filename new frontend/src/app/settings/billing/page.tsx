"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
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

  useEffect(() => {
    Promise.all([
      fetch('/api/workspaces/current/credits', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/workspaces/current', { credentials: 'include' }).then(r => r.json()),
    ]).then(([c, w]) => {
      setCredits(c.credits);
      setWorkspace(w.workspace ?? w);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const currentPlan = workspace?.plan ?? 'free';
  const usedPct = credits ? Math.round((credits.used / credits.limit) * 100) : 0;

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
    </>
  );
}
