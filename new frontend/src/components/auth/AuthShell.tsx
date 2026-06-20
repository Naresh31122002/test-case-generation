"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";

/**
 * Centered card on the portfolio's signature light gradient — same
 * background, logo mark, and wordmark colors as the marketing site, so the
 * auth pages read as a continuation of testsurge.kynetropo.com rather than a
 * separate dark-themed app.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-gradient-to-b from-[#FFF5F8] via-[#F2FAFB] to-white relative overflow-hidden">
      {/* Ambient blobs — same treatment as the portfolio hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full opacity-[0.06] blur-3xl"
        style={{ background: "var(--color-brand-primary)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-cyan opacity-[0.06] blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
      >
        <div className="mb-7 text-center">
          <Link href="/" className="inline-flex items-center justify-center gap-1.5">
            <Image
              src="/icon.png"
              alt="TestSurge"
              width={32}
              height={32}
              className="rounded-lg"
            />
            <span className="text-[22px] font-bold leading-none">
              <span className="text-navy">Test</span>
              <span style={{ color: "var(--color-brand-primary)" }}>Surge</span>
            </span>
          </Link>
          <h1 className="text-lg font-semibold text-navy mt-4">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>

        {children}

        {footer && <div className="mt-6 text-center text-sm text-gray-500">{footer}</div>}
      </motion.div>
    </div>
  );
}

/** Divider with centered "or" text — sits between the password form and Google button. */
export function AuthDivider() {
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="h-px flex-1 bg-gray-200" />
      <span className="text-xs text-gray-400 uppercase tracking-wide">or</span>
      <div className="h-px flex-1 bg-gray-200" />
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-navy focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-300 transition-colors disabled:opacity-60"
    />
  );
}

export function AuthButton({
  loading,
  children,
  ...props
}: { loading?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className="w-full py-2.5 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50"
      style={{ backgroundColor: "var(--color-brand-primary)" }}
    >
      {loading ? "Please wait…" : children}
    </button>
  );
}

export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{message}</p>
  );
}

export function AuthSuccess({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{message}</p>
  );
}
