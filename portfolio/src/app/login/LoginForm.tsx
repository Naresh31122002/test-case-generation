"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium text-text-primary">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-text-primary outline-none transition-colors focus:border-secondary"
        />
      </div>
      <div>
        <label htmlFor="password" className="text-sm font-medium text-text-primary">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="mt-2 w-full rounded-xl border border-gray-200 px-4 py-3 text-text-primary outline-none transition-colors focus:border-secondary"
        />
      </div>
      <motion.button
        type="submit"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="rounded-full bg-secondary py-3 font-semibold text-white shadow-sm"
      >
        Sign In
      </motion.button>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-gray-200" />
        <span className="text-xs text-text-light">or</span>
        <span className="h-px flex-1 bg-gray-200" />
      </div>

      <motion.button
        type="button"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center justify-center gap-3 rounded-full border border-gray-200 py-3 font-semibold text-text-primary"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.85 2.09-1.81 2.73v2.27h2.92c1.71-1.57 2.69-3.88 2.69-6.64z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.81 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.34C2.44 15.98 5.48 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.96 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.96H.96A8.99 8.99 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
          />
        </svg>
        Continue with Google
      </motion.button>
    </form>
  );
}
