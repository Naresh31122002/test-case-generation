"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthShell,
  AuthField,
  AuthInput,
  AuthButton,
  AuthError,
} from "@/components/auth/AuthShell";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const nextPath = params.get("next") || "/stories";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { user, hasWorkspace } = await login(email, password);
      setUser(user);
      // Full reload so middleware re-runs with the new cookie and lets the user through.
      window.location.href = hasWorkspace ? nextPath : "/onboarding/workspace";
    } catch (err: any) {
      setError(err?.message ?? "Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to your TestSurge workspace."
      footer={
        <>
          New to TestSurge?{" "}
          <Link href="/signup" className="font-semibold hover:underline" style={{ color: "#FF0A78" }}>
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <AuthField label="Email">
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
            autoComplete="current-password"
            placeholder="Your password"
          />
        </AuthField>

        <div className="text-right">
          <Link href="/forgot-password" className="text-xs text-gray-500 hover:text-navy">
            Forgot password?
          </Link>
        </div>

        <AuthError message={error} />

        <AuthButton type="submit" loading={loading}>
          Sign in
        </AuthButton>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0F172A]" />}>
      <LoginForm />
    </Suspense>
  );
}
