"use client";

import { motion } from "framer-motion";
import { Play } from "lucide-react";

const LINE1_WORDS = ["Generate", "Test", "Cases"];
const LINE2_WORDS = ["Know", "Every", "Impact"];

const STATS = [
  "50 Free Generations",
  "7-Day Trial",
  "No Credit Card",
  "Cancel Anytime",
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.1,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" } },
} as const;

const wordVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
} as const;

export default function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 pt-28 pb-16">
      {/* Background blobs */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-[500px] w-[500px] rounded-full bg-secondary opacity-[0.05] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-primary opacity-[0.05] blur-3xl"
      />

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        {/* Headline */}
        <h1 className="font-heading font-bold leading-tight text-text-primary text-[40px] md:text-[72px]">
          <motion.span className="flex flex-wrap justify-center gap-x-4">
            {LINE1_WORDS.map((word) => (
              <motion.span key={word} variants={wordVariants} className="inline-block">
                {word}
              </motion.span>
            ))}
          </motion.span>
          <motion.span className="flex flex-wrap justify-center gap-x-4">
            {LINE2_WORDS.map((word) => (
              <motion.span
                key={word}
                variants={wordVariants}
                className={`inline-block ${word === "Impact" ? "text-secondary" : ""}`}
              >
                {word}
              </motion.span>
            ))}
          </motion.span>
        </h1>

        {/* Subheadline */}
        <motion.p
          variants={itemVariants}
          className="mx-auto mt-6 max-w-[600px] text-[20px] text-text-secondary"
        >
          TestSurge generates all 5 types of test cases from Jira stories in 30
          seconds — and tells you exactly which existing tests are affected when
          requirements change. The only AI testing tool with change-impact
          analysis.
        </motion.p>

        {/* Buttons */}
        <motion.div
          variants={itemVariants}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
        >
          <motion.a
            href="/trial"
            whileHover={{
              scale: 1.05,
              boxShadow: "0 0 0 8px rgba(255, 77, 109, 0.15)",
            }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.3 }}
            className="rounded-full bg-secondary px-8 py-4 text-lg font-semibold text-white shadow-lg"
          >
            Start Free — No Card Needed
          </motion.a>
          <motion.a
            href="#demo"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-full border border-text-primary bg-white px-8 py-4 text-lg font-semibold text-text-primary"
          >
            Watch Demo <Play size={18} fill="currentColor" />
          </motion.a>
        </motion.div>

        {/* Stats row */}
        <motion.div
          variants={itemVariants}
          className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm text-text-secondary"
        >
          {STATS.map((stat, i) => (
            <span key={stat} className="flex items-center gap-3">
              {i > 0 && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              {stat}
            </span>
          ))}
        </motion.div>

        {/* Hero visual */}
        <motion.div
          variants={itemVariants}
          className="mt-16 w-full max-w-md"
        >
          <motion.div
            animate={{ y: [0, -14, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="rounded-2xl bg-white p-6 text-left shadow-2xl"
          >
            <div className="mb-4 flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-secondary" />
              <span className="h-3 w-3 rounded-full bg-accent" />
              <span className="h-3 w-3 rounded-full bg-primary" />
            </div>
            <p className="font-heading text-sm font-semibold text-text-primary">
              TC-014: Login with valid credentials
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Steps: Enter username, enter password, click Sign In...
            </p>
            <div className="mt-4 flex items-center gap-1 text-sm font-medium text-secondary">
              Generating test cases
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
              >
                .
              </motion.span>
              <motion.span
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
              >
                .
              </motion.span>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>
    </section>
  );
}
