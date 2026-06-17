export default function WorkspaceSettings() {
  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Workspace</h2>
        <p className="text-sm text-muted">Manage your workspace configuration.</p>
      </div>

      <div className="bg-white border border-border rounded-card p-5 space-y-5">
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Workspace name</label>
          <input
            type="text"
            defaultValue="Acme Corp"
            className="w-full h-9 px-3 text-sm border border-border rounded-btn text-navy focus:outline-none focus:border-cyan transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-1.5">Timezone</label>
          <select
            defaultValue="America/New_York"
            className="w-full h-9 px-3 text-sm border border-border rounded-btn text-navy bg-white focus:outline-none focus:border-cyan transition-colors"
          >
            <option value="America/New_York">Eastern Time (ET)</option>
            <option value="America/Los_Angeles">Pacific Time (PT)</option>
            <option value="Europe/London">London (GMT)</option>
            <option value="Europe/Berlin">Berlin (CET)</option>
            <option value="Asia/Tokyo">Tokyo (JST)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-navy mb-2">Default analysis types</label>
          <div className="space-y-2">
            {["Functional", "Negative", "Boundary", "Security", "Accessibility"].map((t) => (
              <label key={t} className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4 accent-pink" />
                <span className="text-sm text-navy">{t}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="pt-2">
          <button className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
            Save Changes
          </button>
        </div>
      </div>
    </>
  );
}
