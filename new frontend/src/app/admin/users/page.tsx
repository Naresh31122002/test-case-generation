"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    adminApi.users()
      .then(d => setUsers(d.users ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Users</h1>
      <p className="text-sm text-gray-400 mb-6">{users.length} total registered users</p>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by email…"
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
                <th className="text-left px-5 py-3">Email</th>
                <th className="text-left px-5 py-3">Verified</th>
                <th className="text-left px-5 py-3">Last Login</th>
                <th className="text-left px-5 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr key={u.user_id} className={`border-b border-gray-800/50 hover:bg-gray-800/40 transition-colors ${i % 2 === 0 ? "" : "bg-gray-900/50"}`}>
                  <td className="px-5 py-3 text-white font-medium">{u.email}</td>
                  <td className="px-5 py-3">
                    {u.email_verified
                      ? <CheckCircle2 size={15} className="text-green-400" />
                      : <XCircle size={15} className="text-gray-600" />}
                  </td>
                  <td className="px-5 py-3 text-gray-400">{u.last_login ? new Date(u.last_login).toLocaleDateString() : "—"}</td>
                  <td className="px-5 py-3 text-gray-400">{u.created_on ? new Date(u.created_on).toLocaleDateString() : "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={4} className="px-5 py-8 text-center text-gray-500">No users found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
