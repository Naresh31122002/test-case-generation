"use client";

import { useState } from "react";

export default function ProfileSettings() {
  const [name, setName] = useState("Jane Doe");
  const [email, setEmail] = useState("jane@acme.com");
  const [role, setRole] = useState("QA Lead");

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Profile</h2>
        <p className="text-sm text-muted">Manage your personal account details.</p>
      </div>

      <div className="bg-white border border-border rounded-card p-5 space-y-5">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-pink flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
            JD
          </div>
          <button className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors">
            Change Avatar
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Full name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy focus:outline-none focus:border-pink transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy focus:outline-none focus:border-pink transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-navy mb-1.5">Role</label>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy focus:outline-none focus:border-pink transition-colors"
          />
        </div>
      </div>

      <div>
        <button className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">
          Save Changes
        </button>
      </div>
    </>
  );
}
