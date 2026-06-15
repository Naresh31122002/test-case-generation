"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";

type Plan = {
  name: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  accent: string;
  badgeBg: string;
  badgeText: string;
  buttonBg: string;
  features: string[];
  note: string;
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    subtitle: "Perfect for small QA teams",
    monthlyPrice: 29,
    annualPrice: 23,
    accent: "text-accent",
    badgeBg: "bg-accent/10",
    badgeText: "text-accent",
    buttonBg: "bg-accent",
    features: [
      "3 users",
      "500 AI generations/month",
      "5 projects",
      "Jira integration",
      "Excel export",
      "Email support",
    ],
    note: "vs Qase: $90 for 3 users",
  },
  {
    name: "Pro",
    subtitle: "For growing QA teams",
    monthlyPrice: 79,
    annualPrice: 63,
    accent: "text-secondary",
    badgeBg: "bg-secondary/10",
    badgeText: "text-secondary",
    buttonBg: "bg-secondary",
    features: [
      "10 users",
      "2,000 generations/month",
      "Unlimited projects",
      "Jira + GitHub + TestRail",
      "Change-Impact Analysis ✨",
      "Story Quality Check ✨",
      "Team Style Learning ✨",
      "Priority support",
    ],
    note: "vs TestRail: $360 + no AI",
    popular: true,
  },
  {
    name: "Team",
    subtitle: "For large QA departments",
    monthlyPrice: 199,
    annualPrice: 159,
    accent: "text-primary",
    badgeBg: "bg-primary/10",
    badgeText: "text-primary",
    buttonBg: "bg-primary",
    features: [
      "30 users",
      "10,000 generations/month",
      "Everything in Pro",
      "Admin dashboard",
      "SSO / Google Workspace",
      "On-premise option",
      "Dedicated Slack support",
    ],
    note: "vs Tricentis: $3,000+/mo",
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

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
            Simple, honest pricing
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            No sales calls. No hidden fees. Unlike Testsigma, ACCELQ and
            testRigor — we show every price.
          </p>
        </motion.div>

        {/* Toggle */}
        <div className="mt-10 flex items-center justify-center gap-3">
          <span
            className={`text-sm font-medium ${
              !annual ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            Monthly
          </span>
          <button
            role="switch"
            aria-checked={annual}
            onClick={() => setAnnual((a) => !a)}
            className={`relative flex h-8 w-16 items-center rounded-full px-1 transition-colors ${
              annual ? "justify-end bg-secondary" : "justify-start bg-gray-200"
            }`}
          >
            <motion.span
              layout
              className="h-6 w-6 rounded-full bg-white shadow-sm"
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          </button>
          <span
            className={`text-sm font-medium ${
              annual ? "text-text-primary" : "text-text-secondary"
            }`}
          >
            Annual
          </span>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white">
            Save 20%
          </span>
        </div>

        {/* Cards */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3 md:items-start">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.3 }}
              variants={cardVariants}
              transition={{ delay: index * 0.15 }}
              whileHover={{ y: -4, boxShadow: "0 24px 48px -12px rgba(26, 26, 46, 0.18)" }}
              className={`relative flex flex-col rounded-2xl bg-white p-8 shadow-sm transition-shadow duration-300 ${
                plan.popular
                  ? "border-t-[3px] border-secondary shadow-xl md:scale-105"
                  : "border border-gray-100"
              }`}
            >
              {plan.popular && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-secondary px-4 py-1 text-xs font-semibold text-white">
                  ⭐ MOST POPULAR
                </span>
              )}

              <h3 className="font-heading text-2xl font-bold text-text-primary">
                {plan.name}
              </h3>
              <p className="mt-1 text-text-secondary">{plan.subtitle}</p>

              <div className="mt-6 flex items-end gap-1">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={annual ? "annual" : "monthly"}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="font-heading text-4xl font-bold text-text-primary"
                  >
                    ${annual ? plan.annualPrice : plan.monthlyPrice}
                  </motion.span>
                </AnimatePresence>
                <span className="text-text-secondary">/mo</span>
              </div>

              <ul className="mt-6 flex flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 shrink-0 ${plan.accent}`}
                      size={18}
                      strokeWidth={3}
                    />
                    <span className="text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-sm font-medium text-text-light">
                {plan.note}
              </p>

              <motion.a
                href="/trial"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`mt-8 rounded-full ${plan.buttonBg} py-3 text-center font-semibold text-white`}
              >
                Start Free Trial
              </motion.a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
