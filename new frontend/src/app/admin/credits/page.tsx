"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2, Zap, TrendingUp, Building2, User } from "lucide-react";

export default function AdminCreditsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.credits()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Credits</h1>
      <p className="text-sm text-gray-400 mb-6">Per-workspace AI credit consumption</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={16}/>Loading…</div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Credits Used</p>
              <p className="text-3xl font-bold text-white">{Number(data.totals?.total ?? 0).toLocaleString()}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Capacity</p>
              <p className="text-3xl font-bold text-white">{Number(data.totals?.total_limit ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Per-workspace table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Workspace</th>
                  <th className="text-left px-5 py-3">Plan</th>
                  <th className="text-left px-5 py-3">Used</th>
                  <th className="text-left px-5 py-3">Limit</th>
                  <th className="text-left px-5 py-3">Usage</th>
                  <th className="text-left px-5 py-3">Resets</th>
                </tr>
              </thead>
              <tbody>
                {(data.credits ?? []).map((c: any, i: number) => {
                  const pct = Number(c.usage_pct ?? 0);
                  const barColor = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500";
                  return (
                    <tr key={c.workspace_id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                      <td className="px-5 py-3 text-white font-medium">{c.workspace_name}</td>
                      <td className="px-5 py-3 text-gray-400 capitalize">{c.plan}</td>
                      <td className="px-5 py-3 text-white">{c.credits_used}</td>
                      <td className="px-5 py-3 text-gray-400">{c.monthly_limit}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-400">{pct}%</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-gray-400">{c.reset_date ? new Date(c.reset_date).toLocaleDateString() : "—"}</td>
                    </tr>
                  );
                })}
                {(data.credits ?? []).length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-gray-500">No credit data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Consumption trend (last 30 days) */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <TrendingUp size={15} className="text-gray-400" /> Credit Consumption Trend (Last 30 Days)
            </h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              {(data.consumption_trend ?? []).length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No transactions in the last 30 days</p>
              ) : (
                <div className="flex items-end gap-1 h-32">
                  {(() => {
                    const trend = data.consumption_trend ?? [];
                    const max = Math.max(...trend.map((t: any) => Number(t.credits_used)), 1);
                    return trend.map((t: any) => (
                      <div key={t.day} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div
                          className="w-full bg-yellow-500/60 hover:bg-yellow-500 rounded-t transition-colors"
                          style={{ height: `${Math.max((Number(t.credits_used) / max) * 100, 2)}%` }}
                          title={`${new Date(t.day).toLocaleDateString()}: ${t.credits_used} credits`}
                        />
                      </div>
                    ));
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Top consumers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div>
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Building2 size={15} className="text-gray-400" /> Top Workspaces (Last 30 Days)
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {(data.top_workspaces ?? []).map((w: any, i: number) => (
                      <tr key={w.workspace_id} className={`border-b border-gray-800/50 ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                        <td className="px-4 py-2.5 text-white">{w.workspace_name}</td>
                        <td className="px-4 py-2.5 text-gray-400 capitalize">{w.plan}</td>
                        <td className="px-4 py-2.5 text-right text-yellow-400 font-medium">{w.total_consumed}</td>
                      </tr>
                    ))}
                    {(data.top_workspaces ?? []).length === 0 && (
                      <tr><td className="px-4 py-6 text-center text-gray-500">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <User size={15} className="text-gray-400" /> Top Users (Last 30 Days)
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    {(data.top_users ?? []).map((u: any, i: number) => (
                      <tr key={u.user_id} className={`border-b border-gray-800/50 ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                        <td className="px-4 py-2.5 text-white">{u.user_email ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right text-yellow-400 font-medium">{u.total_consumed}</td>
                      </tr>
                    ))}
                    {(data.top_users ?? []).length === 0 && (
                      <tr><td className="px-4 py-6 text-center text-gray-500">No data</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Recent activity */}
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-white mb-3">Recent Credit Activity</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Workspace</th>
                    <th className="text-left px-5 py-3">User</th>
                    <th className="text-left px-5 py-3">Action</th>
                    <th className="text-left px-5 py-3">Amount</th>
                    <th className="text-left px-5 py-3">When</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.recent_activity ?? []).map((a: any, i: number) => (
                    <tr key={a.id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                      <td className="px-5 py-3 text-white">{a.workspace_name}</td>
                      <td className="px-5 py-3 text-gray-400">{a.user_email ?? "—"}</td>
                      <td className="px-5 py-3 text-gray-400">{a.action}</td>
                      <td className="px-5 py-3 text-yellow-400 font-medium">{a.amount}</td>
                      <td className="px-5 py-3 text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleString() : "—"}</td>
                    </tr>
                  ))}
                  {(data.recent_activity ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No recent activity</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
