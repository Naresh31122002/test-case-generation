"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2 } from "lucide-react";

const PLAN_COLORS: Record<string, string> = {
  free: "bg-gray-700 text-gray-300",
  starter: "bg-blue-500/20 text-blue-400",
  pro: "bg-purple-500/20 text-purple-400",
  team: "bg-yellow-500/20 text-yellow-400",
  enterprise: "bg-pink-500/20 text-pink-400",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400",
  canceled: "bg-red-500/20 text-red-400",
  trialing: "bg-yellow-500/20 text-yellow-400",
  past_due: "bg-orange-500/20 text-orange-400",
};

export default function AdminWorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminApi.workspaces()
      .then(d => setWorkspaces(d.workspaces ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = workspaces.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase()) ||
    w.owner_email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Workspaces</h1>
      <p className="text-sm text-gray-400 mb-6">{workspaces.length} total workspaces</p>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name or owner…"
        className="mb-5 w-full max-w-sm bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pink-500" />

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={16}/>Loading…</div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Workspace</th>
                <th className="text-left px-5 py-3">Owner</th>
                <th className="text-left px-5 py-3">Plan</th>
                <th className="text-left px-5 py-3">Status</th>
                <th className="text-left px-5 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((w, i) => (
                <tr key={w.id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                  <td className="px-5 py-3 text-white font-medium">{w.name}</td>
                  <td className="px-5 py-3 text-gray-400">{w.owner_email}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${PLAN_COLORS[w.plan] ?? PLAN_COLORS.free}`}>
                      {w.plan ?? "free"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[w.subscription_status] ?? "bg-gray-700 text-gray-400"}`}>
                      {w.subscription_status ?? "free"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-400">{w.created_at ? new Date(w.created_at).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500">No workspaces found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
