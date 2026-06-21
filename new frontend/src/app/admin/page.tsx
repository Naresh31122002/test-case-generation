"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { TrendingUp, Users, Building2, Zap, XCircle, Loader2, PieChart, UserPlus } from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-500/20 text-blue-400",
  pro: "bg-purple-500/20 text-purple-400",
  team: "bg-yellow-500/20 text-yellow-400",
  enterprise: "bg-pink-500/20 text-pink-400",
};

function GrowthChart({ title, data, color }: { title: string; data: any[]; color: string }) {
  const max = Math.max(...data.map((d) => Number(d.count)), 1);
  return (
    <div>
      <h2 className="text-sm font-semibold text-white mb-3">{title}</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        {data.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No data in the last 30 days</p>
        ) : (
          <div className="flex items-end gap-1 h-28">
            {data.map((d) => (
              <div key={d.day} className="flex-1 flex flex-col items-center justify-end h-full">
                <div
                  className={`w-full rounded-t transition-colors ${color}`}
                  style={{ height: `${Math.max((Number(d.count) / max) * 100, 2)}%` }}
                  title={`${new Date(d.day).toLocaleDateString()}: ${d.count}`}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</span>
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

export default function AdminOverviewPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.metrics()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-full text-gray-400"><Loader2 className="animate-spin mr-2" size={18}/>Loading…</div>;
  if (error) return <div className="p-8 text-red-400">{error}</div>;

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n}`;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Overview</h1>
      <p className="text-sm text-gray-400 mb-8">Platform metrics at a glance</p>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-10">
        <MetricCard label="MRR" value={fmt(data.mrr)} sub="Monthly recurring revenue" icon={TrendingUp} color="bg-green-500/10 text-green-400" />
        <MetricCard label="ARR" value={fmt(data.arr)} sub="Annual run rate" icon={TrendingUp} color="bg-emerald-500/10 text-emerald-400" />
        <MetricCard label="Active Users" value={data.active_users} sub="Total registered" icon={Users} color="bg-blue-500/10 text-blue-400" />
        <MetricCard label="Churn" value={data.churn} sub="Canceled subscriptions" icon={XCircle} color="bg-red-500/10 text-red-400" />
        <MetricCard label="Credits Used" value={data.credits_consumed?.toLocaleString()} sub="Total across all workspaces" icon={Zap} color="bg-yellow-500/10 text-yellow-400" />
      </div>

      {/* Growth charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <GrowthChart title="User Growth (Last 30 Days)" data={data.user_growth ?? []} color="bg-blue-500/60 hover:bg-blue-500" />
        <GrowthChart title="Workspace Growth (Last 30 Days)" data={data.workspace_growth ?? []} color="bg-emerald-500/60 hover:bg-emerald-500" />
      </div>

      {/* Plan distribution + Trial vs Paid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <PieChart size={15} className="text-gray-400" /> Plan Distribution
          </h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-2">
            {(data.plan_distribution ?? []).map((p: any) => (
              <div key={p.plan} className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[p.plan] ?? PLAN_COLORS.free}`}>
                  {p.plan}
                </span>
                <span className="text-sm text-white font-medium">{p.count}</span>
              </div>
            ))}
            {(data.plan_distribution ?? []).length === 0 && (
              <p className="text-sm text-gray-500 text-center py-2">No workspaces</p>
            )}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-white mb-3">Trial vs Paid Workspaces</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Trial (Free)</p>
                <p className="text-2xl font-bold text-white">{data.trial_vs_paid?.trial_count ?? 0}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Paid</p>
                <p className="text-2xl font-bold text-white">{data.trial_vs_paid?.paid_count ?? 0}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent signups */}
      <div className="mb-10">
        <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <UserPlus size={15} className="text-gray-400" /> Recent Signups
        </h2>
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Organization</th>
                <th className="text-left px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {(data.recent_signups ?? []).map((u: any, i: number) => (
                <tr key={u.user_id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                  <td className="px-5 py-3 text-white">{u.email}</td>
                  <td className="px-5 py-3 text-gray-400">{u.org_name ?? "—"}</td>
                  <td className="px-5 py-3 text-gray-400">{u.created_on ? new Date(u.created_on).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {(data.recent_signups ?? []).length === 0 && (
                <tr><td colSpan={3} className="px-5 py-8 text-center text-gray-500">No signups yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-white mb-4">Quick links</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Manage Users", href: "/admin/users", icon: Users },
            { label: "Workspaces", href: "/admin/workspaces", icon: Building2 },
            { label: "Subscriptions", href: "/admin/subscriptions", icon: TrendingUp },
            { label: "Credits", href: "/admin/credits", icon: Zap },
          ].map(({ label, href, icon: Icon }) => (
            <a key={href} href={href}
              className="flex items-center gap-2 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 hover:text-white transition-colors">
              <Icon size={15} />
              {label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
