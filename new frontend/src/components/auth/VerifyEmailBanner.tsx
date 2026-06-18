"use client";

import { useState } from "react";
import { Mail, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { resendVerification } from "@/lib/auth";

/**
 * Soft email-verification gate. Shown across the app while the logged-in user's
 * email is unverified. Lets them re-send the verification email. Dismissible per
 * session (reappears on next load until verified).
 */
export function VerifyEmailBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.emailVerified || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      await resendVerification();
      setSent(true);
    } catch {
      /* best-effort */
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 sm:px-6 py-2.5 bg-[#FFFBEB] border-b border-[#FCD34D] text-[#92400E]">
      <Mail size={16} className="flex-shrink-0" />
      <p className="text-sm flex-1 min-w-0">
        {sent
          ? "Verification email sent — check your inbox."
          : `Please verify your email (${user.email}) to secure your account.`}
      </p>
      {!sent && (
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          className="text-sm font-semibold underline hover:no-underline disabled:opacity-50 flex-shrink-0"
        >
          {sending ? "Sending…" : "Resend email"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="text-[#92400E]/70 hover:text-[#92400E] flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={16} />
      </button>
    </div>
  );
}
