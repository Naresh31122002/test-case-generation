"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-3 rounded-2xl bg-accent/10 p-8 text-center"
      >
        <CheckCircle2 className="text-accent" size={40} />
        <p className="font-heading text-xl font-bold text-text-primary">
          You&apos;re on the list!
        </p>
        <p className="text-text-secondary">
          We&apos;ll email <span className="font-semibold text-text-primary">{email}</span>{" "}
          as soon as your spot is ready.
        </p>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label htmlFor="email" className="text-sm font-medium text-text-primary">
          Work email
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
      <motion.button
        type="submit"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="rounded-full bg-secondary py-3 font-semibold text-white shadow-sm"
      >
        Join Waitlist
      </motion.button>
      <p className="text-center text-xs text-text-light">
        No credit card required. Cancel anytime.
      </p>
    </form>
  );
}
