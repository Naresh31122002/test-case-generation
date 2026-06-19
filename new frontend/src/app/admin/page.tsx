"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { TrendingUp, Users, Building2, Zap, XCircle, Loader2 } from "lucide-react";

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
