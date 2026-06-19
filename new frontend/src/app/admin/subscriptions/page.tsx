"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2 } from "lucide-react";

const PLAN_PRICES: Record<string, number> = { free: 0, starter: 15, pro: 49, team: 199, enterprise: 499 };
const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-500/20 text-blue-400",
  pro: "bg-purple-500/20 text-purple-400",
  team: "bg-yellow-500/20 text-yellow-400",
  enterprise: "bg-pink-500/20 text-pink-400",
};

export default function AdminSubscriptionsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.subscriptions()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Subscriptions & Revenue</h1>
      <p className="text-sm text-gray-400 mb-6">Plan breakdown and subscription list</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={16}/>Loading…</div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <>
          {/* Revenue breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
            {(data.revenue_breakdown ?? []).map((row: any) => (
              <div key={row.plan} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[row.plan] ?? PLAN_COLORS.free}`}>
                  {row.plan}
                </span>
                <p className="text-xl font-bold text-white mt-2">{row.count}</p>
                <p className="text-xs text-gray-500">${row.monthly_revenue}/mo</p>
              </div>
            ))}
          </div>

          {/* Subscription table */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-5 py-3">Workspace</th>
                  <th className="text-left px-5 py-3">Owner</th>
                  <th className="text-left px-5 py-3">Plan</th>
                  <th className="text-left px-5 py-3">Status</th>
                  <th className="text-left px-5 py-3">Period End</th>
                </tr>
              </thead>
              <tbody>
                {(data.subscriptions ?? []).map((s: any, i: number) => (
                  <tr key={s.id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                    <td className="px-5 py-3 text-white font-medium">{s.name}</td>
                    <td className="px-5 py-3 text-gray-400">{s.owner_email}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[s.plan] ?? PLAN_COLORS.free}`}>
                        {s.plan ?? "free"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-400">{s.subscription_status ?? "—"}</td>
                    <td className="px-5 py-3 text-gray-400">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
