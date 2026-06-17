const plans = [
  { id: "free",  name: "Free",       price: "$0",   features: ["5 stories", "50 tests/mo", "1 user"] },
  { id: "pro",   name: "Pro",        price: "$49",  features: ["Unlimited stories", "Unlimited tests", "5 users", "Impact analysis"] },
  { id: "team",  name: "Team",       price: "$149", features: ["Unlimited everything", "25 users", "Priority support", "API access"] },
];

export default function BillingSettings() {
  const current = "pro";

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Billing</h2>
        <p className="text-sm text-muted">Manage your plan and billing details.</p>
      </div>

      {/* Current usage */}
      <div className="bg-white border border-border rounded-card p-5 space-y-3">
        <p className="text-sm font-semibold text-navy">Usage this month</p>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Stories", used: 4, limit: "Unlimited" },
            { label: "Tests generated", used: 93, limit: "Unlimited" },
            { label: "Active users", used: 3, limit: 5 },
          ].map((u) => (
            <div key={u.label}>
              <p className="text-2xl font-bold text-navy">{u.used}</p>
              <p className="text-xs text-muted mt-0.5">{u.label}</p>
              <p className="text-[11px] text-muted">of {u.limit}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-3 gap-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`border rounded-card p-4 ${
              plan.id === current
                ? "border-pink bg-surface-pink"
                : "border-border bg-white"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-navy">{plan.name}</p>
              {plan.id === current && (
                <span className="text-[10px] font-bold text-pink bg-white px-1.5 py-0.5 rounded border border-pink">Current</span>
              )}
            </div>
            <p className="text-2xl font-bold text-navy mb-1">{plan.price}<span className="text-sm font-normal text-muted">/mo</span></p>
            <ul className="space-y-1 mt-3 mb-4">
              {plan.features.map((f) => (
                <li key={f} className="text-xs text-muted flex items-center gap-1.5">
                  <span className="text-success">✓</span> {f}
                </li>
              ))}
            </ul>
            {plan.id !== current && (
              <button className={`w-full h-8 text-xs font-medium rounded-btn border transition-colors ${
                plan.id === "team"
                  ? "bg-pink text-white border-pink hover:bg-[#e0005f]"
                  : "border-border text-navy hover:bg-gray-50"
              }`}>
                {plan.id === "free" ? "Downgrade" : "Upgrade"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Payment method */}
      <div className="bg-white border border-border rounded-card p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-navy">Payment method</p>
          <p className="text-xs text-muted mt-0.5">Visa ending in 4242 · Expires 12/27</p>
        </div>
        <button className="h-8 px-4 text-xs font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
          Update
        </button>
      </div>
    </>
  );
}
