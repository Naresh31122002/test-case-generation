"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

const initialMembers = [
  { id: "1", name: "Jane Doe",    email: "jane@acme.com",   role: "Admin",  avatar: "JD" },
  { id: "2", name: "Alex Smith",  email: "alex@acme.com",   role: "Member", avatar: "AS" },
  { id: "3", name: "Sam Rivera",  email: "sam@acme.com",    role: "Member", avatar: "SR" },
];

export default function TeamSettings() {
  const [members, setMembers] = useState(initialMembers);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Admin" | "Member">("Member");

  const invite = () => {
    if (!inviteEmail.trim()) return;
    setMembers([...members, {
      id: Date.now().toString(),
      name: inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole,
      avatar: inviteEmail.slice(0, 2).toUpperCase(),
    }]);
    setInviteEmail("");
  };

  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Team</h2>
        <p className="text-sm text-muted">Manage workspace members and roles.</p>
      </div>

      {/* Invite */}
      <div className="bg-white border border-border rounded-card p-5">
        <p className="text-sm font-semibold text-navy mb-3">Invite a member</p>
        <div className="flex gap-3">
          <input
            type="email"
            placeholder="colleague@acme.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as "Admin" | "Member")}
            className="h-9 px-3 text-sm border border-border rounded-btn text-navy bg-white focus:outline-none focus:border-cyan transition-colors"
          >
            <option>Member</option>
            <option>Admin</option>
          </select>
          <button onClick={invite} className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2">
            <Plus size={14} /> Invite
          </button>
        </div>
      </div>

      {/* Member list */}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        {members.map((m, idx) => (
          <div key={m.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx < members.length - 1 ? "border-b border-border" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-pink flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {m.avatar}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy">{m.name}</p>
              <p className="text-xs text-muted">{m.email}</p>
            </div>
            <select
              defaultValue={m.role}
              className="h-8 px-2 text-xs border border-border rounded-btn text-navy bg-white focus:outline-none cursor-pointer"
            >
              <option>Admin</option>
              <option>Member</option>
            </select>
            <button
              onClick={() => setMembers(members.filter((x) => x.id !== m.id))}
              className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-error hover:bg-[#FEF2F2] transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
