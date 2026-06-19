"use client";
import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Loader2, AlertTriangle } from "lucide-react";

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-red-500/20 text-red-400",
  medium: "bg-yellow-500/20 text-yellow-400",
  low: "bg-gray-700 text-gray-400",
};

export default function AdminErrorsPage() {
  const [errors, setErrors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi.errors()
      .then(d => setErrors(d.errors ?? []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">Errors</h1>
      <p className="text-sm text-gray-400 mb-6">Recent system errors and warnings</p>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-400"><Loader2 className="animate-spin" size={16}/>Loading…</div>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : (
        <div className="space-y-3">
          {errors.map((e) => (
            <div key={e.id} className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-start gap-4">
              <AlertTriangle size={16} className={e.severity === "high" ? "text-red-400 mt-0.5" : "text-yellow-400 mt-0.5"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{e.message}</p>
                <p className="text-xs text-gray-500 mt-1">{e.timestamp ? new Date(e.timestamp).toLocaleString() : "—"}</p>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${SEVERITY_COLORS[e.severity] ?? SEVERITY_COLORS.low}`}>
                {e.severity}
              </span>
            </div>
          ))}
          {errors.length === 0 && (
            <p className="text-gray-500 text-sm">No errors recorded.</p>
          )}
        </div>
      )}
    </div>
  );
}
