"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { ConfirmModal, type ConfirmState } from "@/components/ui/ConfirmModal";

interface Member { user_id: string; email: string; role: string; }

export default function TeamSettings() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("member");
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [toastVariant, setToastVariant] = useState<'success' | 'error'>('success');
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);

  function showToast(msg: string, variant: 'success' | 'error' = 'success') {
    setToast(msg);
    setToastVariant(variant);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    fetch('/api/workspaces/members', { credentials: 'include' })
      .then(r => r.json())
      .then(d => setMembers(d.members ?? []))
      .catch(() => setError('Could not load team members. Please refresh to try again.'))
      .finally(() => setLoading(false));
  }, []);

  async function invite() {
    if (!inviteEmail.trim()) return;
    setInviting(true); setError(null);
    try {
      const r = await fetch('/api/workspaces/invites', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? 'Invite failed');
      setInviteEmail("");
      showToast('Invite sent ✓');
    } catch (e: any) { setError(e.message); }
    finally { setInviting(false); }
  }

  async function changeRole(userId: string, role: string) {
    const prev = members.find(m => m.user_id === userId)?.role;
    setMembers(p => p.map(m => m.user_id === userId ? { ...m, role } : m));
    try {
      const r = await fetch(`/api/workspaces/members/${userId}`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!r.ok) throw new Error(`Server error ${r.status}`);
      showToast('Role updated ✓');
    } catch {
      // Rollback on failure
      if (prev) setMembers(p => p.map(m => m.user_id === userId ? { ...m, role: prev } : m));
      showToast('Failed to update role', 'error');
    }
  }

  function removeMember(userId: string) {
    setConfirmState({
      title: "Remove member",
      message: "This member will lose access to the workspace immediately.",
      confirmLabel: "Remove",
      onConfirm: async () => {
        try {
          const r = await fetch(`/api/workspaces/members/${userId}`, { method: 'DELETE', credentials: 'include' });
          if (!r.ok) throw new Error(`Server error ${r.status}`);
          setMembers(prev => prev.filter(m => m.user_id !== userId));
          showToast('Member removed');
        } catch { showToast('Failed to remove member', 'error'); }
      },
    });
  }

  return (
    <>
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 text-white text-sm rounded-xl shadow-lg ${toastVariant === 'error' ? 'bg-error' : 'bg-success'}`}>{toast}</div>
      )}

      <div>
        <h2 className="text-[18px] font-semibold text-navy mb-1">Team</h2>
        <p className="text-sm text-muted">Manage workspace members and roles.</p>
      </div>

      {/* Invite */}
      <div className="bg-white border border-border rounded-card p-5">
        <p className="text-sm font-semibold text-navy mb-3">Invite a member</p>
        <div className="flex gap-3">
          <input
            type="email" placeholder="colleague@company.com" value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && invite()}
            className="flex-1 h-9 px-3 text-sm border border-border rounded-btn text-navy placeholder:text-muted focus:outline-none focus:border-cyan transition-colors"
          />
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-btn text-navy bg-white focus:outline-none">
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={invite} disabled={inviting || !inviteEmail.trim()}
            className="h-9 px-4 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors flex items-center gap-2 disabled:opacity-60">
            {inviting ? <Loader2 size={13} className="animate-spin" /> : <Plus size={14} />} Invite
          </button>
        </div>
        {error && <p className="text-xs text-error mt-2">{error}</p>}
      </div>

      {/* Member list */}
      <div className="bg-white border border-border rounded-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted text-sm">
            <Loader2 size={16} className="animate-spin" /> Loading members…
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">No members yet</p>
        ) : members.map((m, idx) => (
          <div key={m.user_id} className={`flex items-center gap-4 px-5 py-3.5 ${idx < members.length - 1 ? "border-b border-border" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-pink flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {m.email.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-navy truncate">{m.email}</p>
            </div>
            <select value={m.role} onChange={(e) => changeRole(m.user_id, e.target.value)}
              className="h-8 px-2 text-xs border border-border rounded-btn text-navy bg-white focus:outline-none cursor-pointer">
              <option value="owner">Owner</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
            <button onClick={() => removeMember(m.user_id)}
              className="w-7 h-7 flex items-center justify-center rounded text-muted hover:text-error hover:bg-[#FEF2F2] transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>
      <ConfirmModal state={confirmState} onClose={() => setConfirmState(null)} />
    </>
  );
}
