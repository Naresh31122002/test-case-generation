"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Bug, LifeBuoy } from "lucide-react";

type Priority = "Low" | "Medium" | "High" | "Urgent";

const PRIORITIES: Priority[] = ["Low", "Medium", "High", "Urgent"];

function ContactForm() {
  const params = useSearchParams();
  const isBug = params.get("type") === "bug";

  const [subject, setSubject] = useState(isBug ? "Bug report: " : "");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<Priority>(isBug ? "High" : "Medium");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const canSubmit = subject.trim().length > 0 && message.trim().length > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError("Subject and message are required.");
      return;
    }
    // Mock submit — wire to a real endpoint later.
    setSubmitted(true);
  }

  function reset() {
    setSubject(isBug ? "Bug report: " : "");
    setMessage("");
    setPriority(isBug ? "High" : "Medium");
    setSubmitted(false);
    setError("");
  }

  return (
    <>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="w-7 h-7 rounded-full bg-surface-pink text-pink flex items-center justify-center">
            {isBug ? <Bug size={15} /> : <LifeBuoy size={15} />}
          </span>
          <h2 className="text-[18px] font-semibold text-navy">
            {isBug ? "Report a Bug" : "Contact Us"}
          </h2>
        </div>
        <p className="text-sm text-muted">
          {isBug
            ? "Tell us what went wrong and we'll look into it."
            : "Send our team a message and we'll get back to you."}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {submitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="bg-white border border-border rounded-card p-8 text-center"
          >
            <span className="w-12 h-12 rounded-full bg-[#ECFDF5] text-success flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={26} />
            </span>
            <h3 className="text-base font-semibold text-navy mb-1">Message sent</h3>
            <p className="text-sm text-muted mb-5">
              Thanks for reaching out — our team will reply by email shortly.
            </p>
            <button
              type="button"
              onClick={reset}
              className="h-9 px-5 text-sm font-medium border border-border rounded-btn text-navy hover:bg-gray-50 transition-colors"
            >
              Send another message
            </button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onSubmit={handleSubmit}
            className="bg-white border border-border rounded-card p-5 space-y-4"
          >
            {/* Subject */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">
                Subject <span className="text-pink">*</span>
              </label>
              <input
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setError(""); }}
                placeholder="How can we help?"
                className="w-full h-10 px-3 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors"
              />
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">Priority</label>
              <div className="flex flex-wrap gap-2">
                {PRIORITIES.map((p) => {
                  const on = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`h-9 px-4 rounded-btn border text-sm font-medium transition-colors ${
                        on
                          ? "bg-brand-primary-light text-brand-primary border-brand-primary"
                          : "bg-white text-muted border-border hover:text-navy hover:bg-gray-50"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-navy mb-1.5">
                Message <span className="text-pink">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => { setMessage(e.target.value); setError(""); }}
                rows={6}
                placeholder={isBug ? "Steps to reproduce, what you expected, what happened…" : "Write your message…"}
                className="w-full px-3 py-2.5 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-y"
              />
            </div>

            {error && <p className="text-xs text-error">{error}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!canSubmit}
                className="h-9 px-5 text-sm font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors disabled:opacity-40"
              >
                Submit
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </>
  );
}

export default function ContactPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading…</p>}>
      <ContactForm />
    </Suspense>
  );
}
