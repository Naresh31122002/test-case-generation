"use client";

import { motion } from "framer-motion";
import { Upload, Sparkles, Send } from "lucide-react";

const STEPS = [
  {
    icon: Upload,
    step: "01",
    title: "Upload Jira Story",
    description:
      "Connect Jira or paste a story directly. PDF and DOCX uploads work too.",
  },
  {
    icon: Sparkles,
    step: "02",
    title: "AI Critiques & Generates",
    description:
      "TestSurge flags weak requirements, then generates all 5 test types in seconds.",
  },
  {
    icon: Send,
    step: "03",
    title: "Export + Manage Impact",
    description:
      "Export to your tools and track which tests break when requirements change.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

export default function HowItWorks() {
  return (
    <section className="bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            How it works
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            From Jira story to managed coverage in three steps.
          </p>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.3 }}
                variants={cardVariants}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -6, boxShadow: "0 20px 40px -12px rgba(13, 27, 42, 0.15)" }}
                className="relative rounded-2xl border border-gray-100 bg-white p-8 shadow-sm transition-shadow"
              >
                <span className="absolute right-6 top-6 font-heading text-4xl font-bold text-text-primary/10">
                  {step.step}
                </span>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10">
                  <Icon size={28} className="text-secondary" />
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold text-text-primary">
                  {step.title}
                </h3>
                <p className="mt-3 text-text-secondary">{step.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
