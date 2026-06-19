"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/auth";
import {
  AuthShell,
  AuthField,
  AuthInput,
  AuthButton,
  AuthError,
  AuthSuccess,
} from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email);
      setSent(true); // backend always 200 — no account enumeration
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a link to choose a new password."}
      footer={
        <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--color-brand-primary)" }}>
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <AuthSuccess message={`If an account exists for ${email}, a reset link is on its way.`} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <AuthField label="Email">
            <AuthInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="you@example.com"
            />
          </AuthField>

          <AuthError message={error} />

          <AuthButton type="submit" loading={loading}>
            Send reset link
          </AuthButton>
        </form>
      )}
    </AuthShell>
  );
}
