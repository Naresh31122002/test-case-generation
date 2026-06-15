"use client";

import { motion } from "framer-motion";
import { Check, Clock, AlertTriangle, ShieldAlert } from "lucide-react";

type Feature = {
  tag: string;
  tagClass: string;
  title: string;
  description: string;
  visual: React.ReactNode;
  highlight?: string;
};

const TEST_CASES = [
  { id: "TC-001", label: "Valid login test", severity: "High", status: "done" },
  { id: "TC-002", label: "Invalid password test", severity: "High", status: "done" },
  { id: "TC-003", label: "Boundary input test", severity: "Medium", status: "done" },
  { id: "TC-004", label: "SQL injection test", severity: "High", status: "pending" },
  { id: "TC-005", label: "Load test", severity: "Medium", status: "pending" },
] as const;

function GenerationCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
      <p className="font-heading text-sm font-semibold text-text-primary">
        Generating test cases...
      </p>
      <ul className="mt-4 flex flex-col gap-3">
        {TEST_CASES.map((tc, index) => (
          <motion.li
            key={tc.id}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.4, delay: index * 0.25 }}
            className="flex items-center gap-2 text-sm"
          >
            {tc.status === "done" ? (
              <Check className="shrink-0 text-secondary" size={16} strokeWidth={3} />
            ) : (
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="shrink-0"
              >
                <Clock className="text-text-light" size={16} />
              </motion.span>
            )}
            <span className="font-medium text-text-primary">{tc.id}:</span>
            <span className="text-text-secondary">{tc.label}</span>
            <span className="ml-auto text-xs font-semibold text-text-light">
              {tc.severity}
            </span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

const IMPACT_NODES = [
  { label: "TC-014", note: "⚠️ High Impact", color: "text-secondary" },
  { label: "TC-023", note: "⚠️ Medium Impact", color: "text-primary" },
  { label: "TC-031", note: "✅ Low Impact", color: "text-accent" },
] as const;

function ImpactAnalysisCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
      <div className="flex flex-col items-center">
        <motion.div
          animate={{ scale: [1, 1.08, 1], boxShadow: ["0 0 0 0 rgba(255,77,109,0.4)", "0 0 0 12px rgba(255,77,109,0)", "0 0 0 0 rgba(255,77,109,0)"] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
          className="rounded-full bg-secondary px-4 py-2 text-sm font-semibold text-white"
        >
          Story Updated
        </motion.div>

        <svg className="h-16 w-full" viewBox="0 0 200 60" preserveAspectRatio="none">
          <line x1="100" y1="0" x2="30" y2="60" stroke="#E5E7EB" strokeWidth="2" />
          <line x1="100" y1="0" x2="100" y2="60" stroke="#E5E7EB" strokeWidth="2" />
          <line x1="100" y1="0" x2="170" y2="60" stroke="#E5E7EB" strokeWidth="2" />
        </svg>

        <div className="grid w-full grid-cols-3 gap-2">
          {IMPACT_NODES.map((node, index) => (
            <motion.div
              key={node.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.4 }}
              transition={{ duration: 0.4, delay: 0.3 + index * 0.15 }}
              className="rounded-xl border border-gray-100 p-3 text-center"
            >
              <p className="text-xs font-bold text-text-primary">{node.label}</p>
              <p className={`mt-1 text-xs font-medium ${node.color}`}>{node.note}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

const STORY_WARNINGS = [
  "Missing acceptance criteria",
  "Undefined edge cases",
  "Ambiguous user role",
] as const;

function StoryQualityCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
      <ul className="flex flex-col gap-3">
        {STORY_WARNINGS.map((warning, index) => (
          <motion.li
            key={warning}
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.4, delay: index * 0.2 }}
            className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm"
          >
            <AlertTriangle className="shrink-0 text-amber-500" size={16} />
            <span className="text-amber-700">{warning}</span>
          </motion.li>
        ))}
      </ul>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.4 }}
        transition={{ duration: 0.4, delay: 0.7 }}
        className="mt-4 flex items-center gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm font-medium"
      >
        <ShieldAlert className="shrink-0 text-amber-500" size={16} />
        <span className="text-text-primary">Story quality: Needs improvement</span>
      </motion.div>
    </div>
  );
}

function TeamStyleCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl transition-shadow duration-300 hover:shadow-2xl">
      <p className="text-sm text-text-secondary">
        Your historical tests:{" "}
        <span className="font-semibold text-text-primary">127 imported</span>
      </p>

      <div className="mt-4">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-text-primary">Style match</span>
          <span className="font-semibold text-secondary">94%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: "94%" }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full bg-secondary"
          />
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.4 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="mt-4 flex items-center gap-2 rounded-xl bg-accent/10 px-3 py-2 text-sm font-medium text-accent"
      >
        <Check size={16} strokeWidth={3} />
        TestSurge now writes like your team
      </motion.div>
    </div>
  );
}

const FEATURES: Feature[] = [
  {
    tag: "Core Feature",
    tagClass: "bg-accent/10 text-accent",
    title: "Generate 5 Types of Test Cases Instantly",
    description:
      "Paste any Jira story or upload PDF/DOCX. TestSurge generates positive, negative, boundary, security and performance test cases in 30 seconds — not 3 hours.",
    visual: <GenerationCard />,
  },
  {
    tag: "🏆 Only TestSurge",
    tagClass: "bg-secondary/10 text-secondary",
    title: "Change-Impact Analysis",
    description:
      "When a requirement changes, TestSurge automatically finds every existing test case affected and ranks them by severity. No other AI testing tool does this.",
    highlight: "Competitors offer traceability. We offer impact intelligence.",
    visual: <ImpactAnalysisCard />,
  },
  {
    tag: "Story Intelligence",
    tagClass: "bg-primary/10 text-primary",
    title: "Critiques Your Story Before Generating",
    description:
      "Bad requirements = bad tests. TestSurge reviews your user story first — flags missing acceptance criteria, undefined edge cases, ambiguous language. Garbage in, garbage out? Not anymore.",
    visual: <StoryQualityCard />,
  },
  {
    tag: "Gets Smarter",
    tagClass: "bg-accent/10 text-accent",
    title: "Learns Your Team's Testing Style",
    description:
      "Our RAG engine uses your own historical test cases as context. The more you use TestSurge, the more it sounds like your team wrote it.",
    visual: <TeamStyleCard />,
  },
];

export default function Features() {
  return (
    <section className="overflow-x-hidden bg-white px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="text-center"
        >
          <h2 className="font-heading text-3xl font-bold text-text-primary md:text-5xl">
            Everything your QA team needs
          </h2>
          <p className="mt-4 text-lg text-text-secondary">
            And one thing no competitor has.
          </p>
        </motion.div>

        <div className="mt-20 flex flex-col gap-24">
          {FEATURES.map((feature, index) => {
            const imageLeft = index % 2 === 0;
            return (
              <div
                key={feature.title}
                className="flex flex-col items-center gap-12 md:flex-row"
              >
                {/* Visual */}
                <motion.div
                  initial={{ opacity: 0, x: imageLeft ? -60 : 60 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  whileHover={{ y: -4 }}
                  className={`flex w-full items-center justify-center p-4 md:w-1/2 ${
                    imageLeft ? "md:order-1" : "md:order-2"
                  }`}
                >
                  {feature.visual}
                </motion.div>

                {/* Text */}
                <motion.div
                  initial={{ opacity: 0, x: imageLeft ? 60 : -60 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: false, amount: 0.3 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                  className={`w-full md:w-1/2 ${
                    imageLeft ? "md:order-2" : "md:order-1"
                  }`}
                >
                  <span
                    className={`inline-block rounded-full px-4 py-1 text-sm font-medium ${feature.tagClass}`}
                  >
                    {feature.tag}
                  </span>
                  <h3 className="mt-4 font-heading text-2xl font-bold text-text-primary md:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="mt-4 text-text-secondary">{feature.description}</p>
                  {feature.highlight && (
                    <div className="mt-6 rounded-xl bg-secondary/10 p-4 font-medium text-text-primary">
                      {feature.highlight}
                    </div>
                  )}
                </motion.div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
