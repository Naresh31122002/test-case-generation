"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { get } from "@/lib/apiClient";

interface Integration {
  id: string;
  name: string;
  description: string;
  logo: string;
  logoBg: string;
  comingSoon?: boolean;
}

const INTEGRATIONS: Integration[] = [
  {
    id: "jira",
    name: "Jira",
    description: "Import stories and sync test coverage",
    logo: "J",
    logoBg: "#0052CC",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Link stories to pull requests and branches",
    logo: "GH",
    logoBg: "#24292F",
    comingSoon: true,
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Link stories to merge requests",
    logo: "GL",
    logoBg: "#FC6D26",
    comingSoon: true,
  },
];

interface ConnectionStatus {
  integration_type: string;
  config: Record<string, unknown>;
}

export default function IntegrationsSettings() {
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [connDetails, setConnDetails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    get<{ integrations: ConnectionStatus[] }>("/api/workspaces/integrations")
      .then((data) => {
        const ids = new Set<string>();
        const details: Record<string, string> = {};
        for (const i of data.integrations ?? []) {
          ids.add(i.integration_type);
          const cfg = i.config ?? {};
          if (i.integration_type === "jira" && cfg.base_url) {
            details["jira"] = `Connected to ${cfg.base_url}`;
          }
        }
        setConnected(ids);
        setConnDetails(details);
      })
      .catch(() => {
        // Backend integration endpoint may not exist yet — show all as disconnected
        setConnected(new Set());
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleDisconnect(id: string) {
    setActionBusy(id);
    setError(null);
    try {
      await fetch(`/api/workspaces/integrations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      setConnected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setConnDetails((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } catch {
      setError("Failed to disconnect. Please try again.");
    } finally {
      setActionBusy(null);
    }
  }

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Integrations</h2>
        <p className="text-sm text-muted">Connect external tools to import stories and sync data.</p>
      </div>

      {error && (
        <p className="text-sm text-error bg-[#FEF2F2] border border-[#FCA5A5] rounded-card px-3 py-2">{error}</p>
      )}

      <div className="space-y-3">
        {INTEGRATIONS.map((intg) => {
          const isConnected = connected.has(intg.id);
          const detail = connDetails[intg.id];
          const busy = actionBusy === intg.id;

          return (
            <div key={intg.id} className="bg-white border border-border rounded-card p-5 flex items-center gap-4">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ backgroundColor: intg.logoBg }}
              >
                {intg.logo}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy">{intg.name}</p>
                <p className="text-xs text-muted">{intg.description}</p>
              </div>
              {loading ? (
                <Loader2 size={14} className="animate-spin text-muted" />
              ) : (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    isConnected
                      ? "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]"
                      : "bg-[#F8FAFC] text-[#64748B] border-[#CBD5E1]"
                  }`}>
                    {isConnected ? (detail ?? "Connected") : "Not connected"}
                  </span>
                  {intg.comingSoon ? (
                    <span className="text-[11px] text-muted bg-gray-50 border border-border px-2 py-1 rounded-btn">
                      Coming soon
                    </span>
                  ) : isConnected ? (
                    <button
                      onClick={() => handleDisconnect(intg.id)}
                      disabled={busy}
                      className="h-8 px-3 text-xs font-medium border border-error/30 rounded-btn text-error bg-error/5 hover:bg-error/10 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {busy && <Loader2 size={11} className="animate-spin" />}
                      Disconnect
                    </button>
                  ) : (
                    <button
                      title="OAuth setup coming soon"
                      className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-muted bg-gray-50 cursor-not-allowed"
                    >
                      Connect
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted mt-2">
        GitHub and GitLab integrations are in development. Jira OAuth setup coming in the next release.
      </p>
    </>
  );
}
