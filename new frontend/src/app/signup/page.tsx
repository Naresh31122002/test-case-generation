"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { register, loginWithGoogle } from "@/lib/auth";
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
import { TERMS_URL, PRIVACY_URL } from "@/lib/marketing";

function SignupForm() {
  const params = useSearchParams();
  const { setUser } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Hard email-verification gate: after registering, no session exists yet —
  // show a "check your inbox" view instead of continuing into the app.
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  // Local-dev-only: present when SMTP isn't configured, so you can click
  // straight through instead of digging through backend console output.
  const [devLink, setDevLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { devVerificationLink } = await register(email, password);
      setSubmittedEmail(email);
      setDevLink(devVerificationLink ?? null);
    } catch (err: any) {
      setError(err?.message ?? "Could not create your account");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(credential: string) {
    setLoading(true);
    setError(null);
    try {
      // Google already verifies the email address, so this still logs in
      // immediately — the hard gate only applies to password signups.
      const { user, hasWorkspace } = await loginWithGoogle(credential);
      setUser(user);
      const next = params.get("next");
      window.location.href = hasWorkspace ? (next ?? "/stories") : "/onboarding/workspace";
    } catch (err: any) {
      setError(err?.message ?? "Could not sign up with Google");
      setLoading(false);
    }
  }

  if (submittedEmail) {
    return (
      <AuthShell title="Check your email">
        <div className="flex flex-col items-center text-center gap-3 py-2">
          <span className="w-12 h-12 rounded-xl bg-brand-primary-light text-brand-primary flex items-center justify-center">
            <Mail size={22} />
          </span>
          <p className="text-sm text-gray-500">
            We sent a verification link to <strong className="text-navy">{submittedEmail}</strong>.
            Click it to activate your account and sign in for the first time.
          </p>
          {devLink && (
            <div className="w-full rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3 text-left">
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
          <Link
            href="/login"
            className="font-semibold hover:underline text-sm mt-2"
            style={{ color: "var(--color-brand-primary)" }}
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start generating tests in minutes — no credit card."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-pink hover:underline" style={{ color: "var(--color-brand-primary)" }}>
            Sign in
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
            minLength={8}
            autoComplete="new-password"
            placeholder="Min. 8 characters"
          />
        </AuthField>
        <AuthField label="Confirm password">
          <AuthInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Re-enter your password"
          />
        </AuthField>

        <AuthError message={error} />

        <AuthButton type="submit" loading={loading}>
          Create account
        </AuthButton>

        <p className="text-[11px] text-gray-400 text-center">
          By signing up you agree to our{" "}
          <a
            href={TERMS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: "var(--color-brand-primary)" }}
          >
            Terms
          </a>{" "}
          and{" "}
          <a
            href={PRIVACY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ color: "var(--color-brand-primary)" }}
          >
            Privacy Policy
          </a>
          .
        </p>
      </form>

      <AuthDivider />
      <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />
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
