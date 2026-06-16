"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus } from "lucide-react";

const FAQS = [
  {
    q: "How accurate are generated tests?",
    a: "TestSurge generates structured, reviewable test cases grounded in your actual story content and your team's historical patterns via RAG. Every test is editable before export, and the Story Quality Critique step catches weak requirements first so generation starts from solid input.",
  },
  {
    q: "Does TestSurge integrate with Jira?",
    a: "Yes. Connect Jira to pull stories directly, or paste a story and upload PDF/DOCX. Generated tests can be pushed back into your workflow alongside GitHub, TestRail and Xray.",
  },
  {
    q: "What makes it different from Qase?",
    a: "Qase is a test management system. TestSurge adds AI test intelligence on top: Change Impact Analysis that shows which existing tests break when requirements change, Story Quality Critique, and RAG-based learning of your team's style — none of which traditional test managers provide.",
  },
  {
    q: "How does change impact analysis work?",
    a: "When a requirement changes, TestSurge compares the updated story against your existing test suite and ranks every affected test by severity — so you know exactly what to re-run or rewrite instead of guessing.",
  },
  {
    q: "Does it support TestRail export?",
    a: "Yes. One-click export sends generated test cases to TestRail, as well as Excel, Jira and Xray, keeping your QA workflow in sync without copy-paste.",
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="bg-white px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            Everything you need to know about TestSurge.
          </p>
        </motion.div>

        <div className="mt-12 flex flex-col gap-3">
          {FAQS.map((faq, index) => {
            const isOpen = open === index;
            return (
              <div
                key={faq.q}
                className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
              >
                <button
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                >
                  <span className="font-heading text-lg font-semibold text-text-primary">
                    {faq.q}
                  </span>
                  <motion.span
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.2 }}
                    className="shrink-0 text-secondary"
                  >
                    <Plus size={22} />
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <p className="px-6 pb-5 text-text-secondary">{faq.a}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
