"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { register } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthShell,
  AuthField,
  AuthInput,
  AuthButton,
  AuthError,
} from "@/components/auth/AuthShell";

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user, hasWorkspace } = await register(email, password);
      setUser(user);
      const next = params.get("next");
      // Full reload so middleware sees the new cookie.
      window.location.href = next ?? "/onboarding/workspace";
    } catch (err: any) {
      setError(err?.message ?? "Could not create your account");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start generating tests in minutes — no credit card."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-pink hover:underline" style={{ color: "#FF0A78" }}>
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Work email">
          <AuthInput
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@company.com"
          />
        </AuthField>
        <AuthField label="Password">
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

        <AuthError message={error} />

        <AuthButton type="submit" loading={loading}>
          Create account
        </AuthButton>

        <p className="text-[11px] text-gray-400 text-center">
          By signing up you agree to our Terms and Privacy Policy.
        </p>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A]" />}>
      <SignupForm />
    </Suspense>
  );
}
