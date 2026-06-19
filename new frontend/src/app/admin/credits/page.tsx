"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2, Zap } from "lucide-react";

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
        </>
      )}
    </div>
  );
}
