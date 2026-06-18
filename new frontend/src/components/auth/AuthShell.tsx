"use client";

import { type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

/** Centered card on the brand gradient — the shared frame for every auth page. */
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
    <div
      className="min-h-screen flex items-center justify-center px-4 py-10"
      style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8"
      >
        <div className="mb-7 text-center">
          <Link href="/" className="inline-block">
            <span className="text-2xl font-bold" style={{ color: "#FF0A78" }}>
              TestSurge
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
      style={{ backgroundColor: "#FF0A78" }}
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
