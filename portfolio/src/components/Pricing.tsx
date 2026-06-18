"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { SIGNUP_URL } from "@/lib/app";

type Plan = {
  name: string;
  subtitle: string;
  monthlyPrice: number;
  annualPrice: number;
  custom?: boolean;
  accent: string;
  buttonBg: string;
  buttonLabel: string;
  features: string[];
  popular?: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    subtitle: "Perfect for small QA teams",
    monthlyPrice: 19,
    annualPrice: 15,
    accent: "text-accent",
    buttonBg: "bg-accent",
    buttonLabel: "Start Free Trial",
    features: [
      "3 users",
      "300 generations/month",
      "Basic test generation",
      "Jira integration",
      "Excel export",
      "Email support",
    ],
  },
  {
    name: "Pro",
    subtitle: "For growing QA teams",
    monthlyPrice: 49,
    annualPrice: 39,
    accent: "text-secondary",
    buttonBg: "bg-secondary",
    buttonLabel: "Start Free Trial",
    features: [
      "10 users",
      "1,500 generations/month",
      "Change Impact Analysis (FULL)",
      "Story Quality Critique",
      "RAG Team Learning",
      "TestRail + GitHub integration",
      "Priority support <4h",
    ],
    popular: true,
  },
  {
    name: "Team",
    subtitle: "For large QA departments",
    monthlyPrice: 129,
    annualPrice: 103,
    accent: "text-primary",
    buttonBg: "bg-primary",
    buttonLabel: "Start Free Trial",
    features: [
      "25 users, unlimited generations",
      "Everything in Pro",
      "SSO / Google Workspace",
      "Admin dashboard + audit logs",
      "On-prem option",
      "Dedicated Slack support",
    ],
  },
  {
    name: "Enterprise",
    subtitle: "For organizations at scale",
    monthlyPrice: 0,
    annualPrice: 0,
    custom: true,
    accent: "text-primary",
    buttonBg: "bg-primary",
    buttonLabel: "Contact Sales",
    features: [
      "Custom user limits",
      "Everything in Team",
      "Custom integrations",
      "Security & compliance review",
      "Dedicated success manager",
      "SLA & onboarding",
    ],
  },
];

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

export default function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="bg-white px-6 py-24">
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
        <div className="mt-16 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {PLANS.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.3 }}
              variants={cardVariants}
              transition={{ delay: index * 0.15 }}
              whileHover={{ y: -4, boxShadow: "0 24px 48px -12px rgba(26, 26, 46, 0.18)" }}
              className={`relative flex flex-col rounded-2xl bg-white p-7 shadow-sm transition-shadow duration-300 ${
                plan.popular
                  ? "border-t-[3px] border-secondary shadow-xl lg:scale-105"
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
              <p className="mt-1 text-sm text-text-secondary">{plan.subtitle}</p>

              <div className="mt-6 flex items-end gap-1">
                {plan.custom ? (
                  <span className="font-heading text-4xl font-bold text-text-primary">
                    Custom
                  </span>
                ) : (
                  <>
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
                  </>
                )}
              </div>

              <ul className="mt-6 flex flex-1 flex-col gap-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 shrink-0 ${plan.accent}`}
                      size={18}
                      strokeWidth={3}
                    />
                    <span className="text-sm text-text-secondary">{feature}</span>
                  </li>
                ))}
              </ul>

              <motion.a
                href={SIGNUP_URL}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className={`mt-8 rounded-full ${plan.buttonBg} py-3 text-center font-semibold text-white`}
              >
                {plan.buttonLabel}
              </motion.a>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
