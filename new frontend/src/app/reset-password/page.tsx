"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/auth";
import {
  AuthShell,
  AuthField,
  AuthInput,
  AuthButton,
  AuthError,
} from "@/components/auth/AuthShell";

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await resetPassword(token, password);
      router.push("/login?reset=1");
    } catch (err: any) {
      setError(err?.message ?? "Invalid or expired reset link");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthShell
        title="Invalid reset link"
        footer={
          <Link href="/forgot-password" className="font-semibold hover:underline" style={{ color: "var(--color-brand-primary)" }}>
            Request a new link
          </Link>
        }
      >
        <AuthError message="This reset link is missing its token. Request a new one." />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choose a new password" subtitle="Enter a new password for your account.">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="New password">
          <AuthInput
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
          />
        </AuthField>
        <AuthField label="Confirm password">
          <AuthInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Re-enter password"
          />
        </AuthField>

        <AuthError message={error} />

        <AuthButton type="submit" loading={loading}>
          Update password
        </AuthButton>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A]" />}>
      <ResetPasswordForm />
    </Suspense>
  );
}
