const integrations = [
  {
    id: "jira",
    name: "Jira",
    description: "Import stories and sync test coverage",
    status: "connected",
    detail: "Connected to acme.atlassian.net",
    logo: "J",
    logoBg: "#0052CC",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Link stories to pull requests and branches",
    status: "disconnected",
    detail: "Not connected",
    logo: "GH",
    logoBg: "#24292F",
  },
  {
    id: "gitlab",
    name: "GitLab",
    description: "Link stories to merge requests",
    status: "disconnected",
    detail: "Not connected",
    logo: "GL",
    logoBg: "#FC6D26",
  },
];

export default function IntegrationsSettings() {
  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Integrations</h2>
        <p className="text-sm text-muted">Connect external tools to import stories and sync data.</p>
      </div>

      <div className="space-y-3">
        {integrations.map((intg) => (
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
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                intg.status === "connected"
                  ? "bg-[#ECFDF5] text-[#065F46] border-[#6EE7B7]"
                  : "bg-[#F8FAFC] text-[#64748B] border-[#CBD5E1]"
              }`}>
                {intg.status === "connected" ? intg.detail : "Not connected"}
              </span>
              <button className="h-8 px-3 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
                {intg.status === "connected" ? "Disconnect" : "Connect"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
