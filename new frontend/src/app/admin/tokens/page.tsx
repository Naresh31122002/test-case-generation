"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2, ChevronDown, X } from "lucide-react";

function fmt(n: number | null) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function estimateCost(input: number, output: number) {
  const cost = (input / 1_000_000) * 0.59 + (output / 1_000_000) * 0.79;
  return cost < 0.0001 ? "<$0.0001" : `$${cost.toFixed(4)}`;
}

export default function AdminTokenUsagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function load(userId?: string) {
    setLoading(true);
    adminApi.tokenUsage(userId)
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  function selectUser(u: any) {
    setSelectedUser(u);
    setDropdownOpen(false);
    load(u.user_id);
  }

  function clearUser() {
    setSelectedUser(null);
    load();
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Token Usage</h1>
      <p className="text-sm text-gray-400 mb-6">LLM token consumption and estimated cost</p>

      {/* User selector */}
      <div className="flex items-center gap-3 mb-8">
        <span className="text-sm text-gray-400">Viewing:</span>
        <div className="relative">
          <button onClick={() => setDropdownOpen(v => !v)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg border border-gray-700 bg-gray-800 text-sm text-white hover:border-gray-600 min-w-[220px]">
            <span className="flex-1 text-left truncate">
              {selectedUser ? selectedUser.email : "All users"}
            </span>
            <ChevronDown size={14} className={`text-gray-400 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {dropdownOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-gray-800 border border-gray-700 rounded-xl shadow-xl min-w-[260px] max-h-64 overflow-y-auto py-1">
              <button onClick={clearUser}
                className="w-full px-4 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white">
                All users
              </button>
              <div className="border-t border-gray-700 my-1" />
              {(data?.per_user ?? []).map((u: any) => (
                <button key={u.user_id} onClick={() => selectUser(u)}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 transition-colors">
                  <span className="text-white truncate block">{u.email ?? u.user_id?.slice(0, 16)}</span>
                  <span className="text-xs text-gray-400">{fmt(u.total_tokens)} tokens · {u.call_count} calls</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {selectedUser && (
          <button onClick={clearUser} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={16}/>Loading…</div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Input Tokens</p>
              <p className="text-2xl font-bold text-white">{fmt(data.totals?.total_input ?? 0)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Output Tokens</p>
              <p className="text-2xl font-bold text-white">{fmt(data.totals?.total_output ?? 0)}</p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Est. Cost</p>
              <p className="text-2xl font-bold text-white">{estimateCost(data.totals?.total_input ?? 0, data.totals?.total_output ?? 0)}</p>
              <p className="text-xs text-gray-500 mt-1">{data.totals?.total_calls ?? 0} LLM calls</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Per-action */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800">
                <h2 className="text-sm font-semibold text-white">
                  {selectedUser ? `${selectedUser.email} — by action` : "All users — by action"}
                </h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                    <th className="text-left px-5 py-3">Action</th>
                    <th className="text-right px-5 py-3">Calls</th>
                    <th className="text-right px-5 py-3">Input</th>
                    <th className="text-right px-5 py-3">Output</th>
                    <th className="text-right px-5 py-3">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.per_action ?? []).map((r: any) => (
                    <tr key={r.action} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                      <td className="px-5 py-3 text-white font-mono text-xs">{r.action}</td>
                      <td className="px-5 py-3 text-gray-400 text-right">{r.call_count}</td>
                      <td className="px-5 py-3 text-gray-400 text-right">{fmt(r.total_input)}</td>
                      <td className="px-5 py-3 text-gray-400 text-right">{fmt(r.total_output)}</td>
                      <td className="px-5 py-3 text-green-400 text-right text-xs">{estimateCost(r.total_input, r.total_output)}</td>
                    </tr>
                  ))}
                  {(data.per_action ?? []).length === 0 && (
                    <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500 text-xs">No token data yet — will appear after LLM calls</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Timeline (when user selected) or per-user table (global) */}
            {selectedUser ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-white">Recent calls</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="text-left px-5 py-3">Action</th>
                      <th className="text-left px-5 py-3">Story</th>
                      <th className="text-right px-5 py-3">In</th>
                      <th className="text-right px-5 py-3">Out</th>
                      <th className="text-left px-5 py-3">When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.timeline ?? []).map((r: any, i: number) => (
                      <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/40">
                        <td className="px-5 py-2.5 text-white font-mono text-xs">{r.action}</td>
                        <td className="px-5 py-2.5 text-gray-500 text-xs truncate max-w-[80px]">{r.story_id ?? "—"}</td>
                        <td className="px-5 py-2.5 text-gray-400 text-right text-xs">{fmt(r.input_tokens)}</td>
                        <td className="px-5 py-2.5 text-gray-400 text-right text-xs">{fmt(r.output_tokens)}</td>
                        <td className="px-5 py-2.5 text-gray-500 text-xs">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                    {(data.timeline ?? []).length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-500 text-xs">No calls yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-800">
                  <h2 className="text-sm font-semibold text-white">All users</h2>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-xs text-gray-400 uppercase tracking-wide">
                      <th className="text-left px-5 py-3">User</th>
                      <th className="text-right px-5 py-3">Calls</th>
                      <th className="text-right px-5 py-3">Tokens</th>
                      <th className="text-right px-5 py-3">Est. Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data.per_user ?? []).map((r: any) => (
                      <tr key={r.user_id}
                        className="border-b border-gray-800/50 hover:bg-gray-800/40 cursor-pointer"
                        onClick={() => selectUser(r)}>
                        <td className="px-5 py-3 text-white text-xs">{r.email ?? r.user_id?.slice(0, 16)}</td>
                        <td className="px-5 py-3 text-gray-400 text-right">{r.call_count}</td>
                        <td className="px-5 py-3 text-gray-400 text-right">{fmt(r.total_tokens)}</td>
                        <td className="px-5 py-3 text-green-400 text-right text-xs">{estimateCost(r.total_input, r.total_output)}</td>
                      </tr>
                    ))}
                    {(data.per_user ?? []).length === 0 && (
                      <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500 text-xs">No data yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
