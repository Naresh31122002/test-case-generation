"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { login, loginWithGoogle, resendVerification, AuthApiError } from "@/lib/auth";
import { useAuth } from "@/contexts/AuthContext";
import {
  AuthShell,
  AuthField,
  AuthInput,
  AuthButton,
  AuthError,
  AuthDivider,
} from "@/components/auth/AuthShell";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { setUser } = useAuth();
  const nextPath = params.get("next") || "/stories";

  // In production Next.js adds a /app basePath. window.location.href bypasses
  // the Next router so we must add the prefix ourselves when navigating.
  // process.env.NEXT_PUBLIC_BASE_PATH is set to "/app" in production builds.
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  function navigate(path: string) {
    // path may already include the basePath (e.g. when coming from ?next=)
    const prefixed = path.startsWith(basePath) ? path : `${basePath}${path}`;
    window.location.href = prefixed;
  }

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Hard email-verification gate: an unverified account is rejected at login
  // with a distinct error, so we can offer to resend the link right here.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setNeedsVerification(false);
    setResent(false);
    try {
      const { user, hasWorkspace } = await login(email, password);
      setUser(user);
      // Full reload so middleware re-runs with the new cookie and lets the user through.
      const isFirstLogin = !user.onboardingCompleted;
      navigate(isFirstLogin ? "/onboarding/workspace" : (hasWorkspace ? nextPath : "/onboarding/workspace"));
    } catch (err: any) {
      if (err instanceof AuthApiError && err.code === "EMAIL_NOT_VERIFIED") {
        setNeedsVerification(true);
        setError("Please verify your email before signing in.");
      } else {
        setError(err?.message ?? "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const { devVerificationLink } = await resendVerification(email);
      setDevLink(devVerificationLink ?? null);
      setResent(true);
    } catch {
      /* best-effort — resend always returns 200 server-side */
      setResent(true);
    } finally {
      setResending(false);
    }
  }

  async function handleGoogle(credential: string) {
    setLoading(true);
    setError(null);
    try {
      const { user, hasWorkspace } = await loginWithGoogle(credential);
      setUser(user);
      const isFirstLogin = !user.onboardingCompleted;
      navigate(isFirstLogin ? "/onboarding/workspace" : (hasWorkspace ? nextPath : "/onboarding/workspace"));
    } catch (err: any) {
      setError(err?.message ?? "Could not sign in with Google");
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
          <Link href="/signup" className="font-semibold hover:underline" style={{ color: "var(--color-brand-primary)" }}>
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
            placeholder="you@example.com"
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

        {needsVerification && (
          <div className="text-center space-y-2">
            {resent ? (
              <>
                <p className="text-sm text-green-600">Verification email sent — check your inbox.</p>
                {devLink && (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-left">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      Dev mode — no SMTP configured
                    </p>
                    <a
                      href={devLink}
                      className="mt-1 block text-sm font-medium hover:underline break-all"
                      style={{ color: "var(--color-brand-primary)" }}
                    >
                      {devLink}
                    </a>
                  </div>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-sm font-semibold hover:underline disabled:opacity-50"
                style={{ color: "var(--color-brand-primary)" }}
              >
                {resending ? "Sending…" : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        <AuthButton type="submit" loading={loading}>
          Sign in
        </AuthButton>
      </form>

      <AuthDivider />
      <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />
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
