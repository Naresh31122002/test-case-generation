"use client";

import { motion } from "framer-motion";
import { Clock, AlertTriangle, Bot, type LucideIcon } from "lucide-react";

const PAIN_CARDS: {
  icon: LucideIcon;
  title: string;
  description: string;
}[] = [
  {
    icon: Clock,
    title: "QA teams spend hours writing repetitive tests every sprint",
    description:
      "Writing test cases for one Jira story takes 2-4 hours. Multiply that by 50 stories per sprint — your QA team never catches up.",
  },
  {
    icon: AlertTriangle,
    title: "Nobody knows which tests break after story changes",
    description:
      "Requirements change daily. Nobody knows which existing tests are affected. Bugs slip through because coverage is invisible.",
  },
  {
    icon: Bot,
    title: "Generic AI ignores your team's QA standards and history",
    description:
      "Other AI generators produce cookie-cutter tests that don't match your team's standards or existing test case patterns.",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

export default function Problem() {
  return (
    <section className="bg-muted px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            Your team ships fast.
          </h2>
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            Your test suite can&apos;t keep up.
          </h2>
        </motion.div>

        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PAIN_CARDS.map((card, index) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.3 }}
                variants={cardVariants}
                transition={{ delay: index * 0.15 }}
                whileHover={{ y: -8, boxShadow: "0 20px 40px -10px rgba(26, 26, 46, 0.15)" }}
                className="rounded-2xl border-l-4 border-secondary bg-white p-8 shadow-sm"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/10">
                  <Icon size={28} className="text-secondary" />
                </div>
                <h3 className="mt-4 font-heading text-xl font-bold text-text-primary">
                  {card.title}
                </h3>
                <p className="mt-3 text-text-secondary">{card.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
