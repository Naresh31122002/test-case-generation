"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2 } from "lucide-react";

export default function AdminApiUsagePage() {
  const [usage, setUsage] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.apiUsage()
      .then(d => setUsage(d.usage ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Generation Activity</h1>
      <p className="text-sm text-gray-400 mb-6">Recent test case generation events (not request-level API metrics)</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={16}/>Loading…</div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                <th className="text-left px-5 py-3">Project</th>
                <th className="text-left px-5 py-3">Triggered By</th>
                <th className="text-left px-5 py-3">Generation Succeeded</th>
                <th className="text-left px-5 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((u, i) => (
                <tr key={i} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                  <td className="px-5 py-3 text-white font-mono text-xs">{u.project_id}</td>
                  <td className="px-5 py-3 text-gray-400">{u.source}</td>
                  <td className="px-5 py-3">
                    {u.test_case_generated
                      ? <span className="text-green-400 text-xs font-medium">Yes</span>
                      : <span className="text-gray-500 text-xs">No</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{u.created_on ? new Date(u.created_on).toLocaleString() : "—"}</td>
                </tr>
              ))}
              {usage.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">No usage data</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
