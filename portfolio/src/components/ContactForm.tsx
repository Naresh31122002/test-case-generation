"use client";

import { useState } from "react";
import { Send, CheckCircle2 } from "lucide-react";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // In production this posts to a backend / email service.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-secondary/20 bg-secondary/5 px-6 py-10 text-center">
        <CheckCircle2 className="text-secondary" size={36} />
        <h3 className="font-heading text-xl font-bold text-text-primary">
          Message sent
        </h3>
        <p className="max-w-sm text-text-secondary">
          Thanks for reaching out. Our team will get back to you within 24
          hours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="name" className="text-sm font-semibold text-text-primary">
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          placeholder="Your name"
          className="rounded-lg border border-text-primary/15 bg-white px-4 py-3 text-text-primary outline-none transition-colors focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="email" className="text-sm font-semibold text-text-primary">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          placeholder="you@company.com"
          className="rounded-lg border border-text-primary/15 bg-white px-4 py-3 text-text-primary outline-none transition-colors focus:border-secondary"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm font-semibold text-text-primary">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          placeholder="How can we help?"
          className="resize-y rounded-lg border border-text-primary/15 bg-white px-4 py-3 text-text-primary outline-none transition-colors focus:border-secondary"
        />
      </div>

      <button
        type="submit"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-secondary px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
      >
        <Send size={18} />
        Send message
      </button>
    </form>
  );
}
