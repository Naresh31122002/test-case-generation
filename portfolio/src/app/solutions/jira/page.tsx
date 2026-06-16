import type { Metadata } from "next";
import { FileText, ScanSearch, ListChecks, Download, CheckCircle2 } from "lucide-react";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "AI Jira Test Case Generator — TestSurge",
  description:
    "Generate functional, negative, edge-case, regression, and integration test cases directly from Jira user stories with AI — in seconds, not hours.",
  alternates: { canonical: `${siteUrl}/solutions/jira` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "AI Jira Test Case Generator — TestSurge",
    description:
      "Generate functional, negative, edge-case, regression, and integration test cases directly from Jira user stories with AI — in seconds, not hours.",
    url: `${siteUrl}/solutions/jira`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge Jira Test Case Generator" }],
    type: "website",
  },
};

const STEPS = [
  { icon: FileText, title: "Connect a Jira story", body: "TestSurge reads the story description, acceptance criteria, and linked issues." },
  { icon: ScanSearch, title: "AI critiques the story", body: "Ambiguous or incomplete requirements are flagged before test generation starts." },
  { icon: ListChecks, title: "Generate 5 test types", body: "Functional, negative, edge case, regression, and integration tests are generated automatically." },
  { icon: Download, title: "Export or push to Jira", body: "Review, edit, and export to Excel/CSV — or push directly into Jira (Zephyr/Xray) or TestRail." },
];

const BENEFITS = [
  "Cut test-writing time by up to 85%",
  "Consistent coverage across every story",
  "Catches ambiguous requirements before they become bugs",
  "Works with your existing Jira workflow — no migration needed",
];

export default function JiraSolutionPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-1.5 text-sm font-semibold text-secondary">
          Solutions
        </span>
        <h1 className="mt-4 font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Jira Test Case Generator
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">
          Turn any Jira user story into a complete set of test cases — automatically.
          TestSurge reads your story&apos;s description and acceptance criteria, then
          generates functional, negative, edge-case, regression, and integration
          tests in seconds.
        </p>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold text-text-primary">How it works</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="rounded-2xl border border-gray-100 bg-muted p-5">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                      <Icon className="text-secondary" size={20} />
                    </span>
                    <p className="font-heading font-bold text-text-primary">
                      {i + 1}. {step.title}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-text-secondary">{step.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-heading text-2xl font-bold text-text-primary">Benefits</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-2 text-text-secondary">
                <CheckCircle2 className="mt-0.5 shrink-0 text-accent" size={18} />
                {b}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12 rounded-2xl bg-text-primary p-8 text-center">
          <h2 className="font-heading text-2xl font-bold text-white">
            Try it on your own Jira stories
          </h2>
          <a
            href="/signup"
            className="mt-6 inline-block rounded-full bg-secondary px-8 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105"
          >
            Start Free Trial
          </a>
        </section>
      </article>
    </PageShell>
  );
}
