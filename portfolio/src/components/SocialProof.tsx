"use client";

import { motion } from "framer-motion";

const INTEGRATIONS = [
  "Jira",
  "GitHub",
  "TestRail",
  "Slack",
  "Azure DevOps",
  "Confluence",
  "Playwright",
  "Jenkins",
];

export default function SocialProof() {
  return (
    <section id="integrations" className="overflow-x-hidden border-y border-gray-200 bg-white py-6">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 lg:flex-row lg:px-8">
        {/* Left side */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="flex flex-col items-center gap-4 lg:flex-row"
        >
          <span className="text-sm font-medium text-text-secondary">
            Works with tools your QA team already uses
          </span>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {INTEGRATIONS.map((name) => (
              <span
                key={name}
                className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-medium text-text-primary"
              >
                {name}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Right side */}
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="flex items-center gap-2 text-sm"
        >
          <span className="text-secondary">★★★★★</span>
          <span className="text-text-secondary">5.0 on G2</span>
        </motion.div>
      </div>
    </section>
  );
}
