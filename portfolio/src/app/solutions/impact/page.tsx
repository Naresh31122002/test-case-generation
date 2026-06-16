import type { Metadata } from "next";
import { GitCompareArrows, ScanSearch, ListChecks, AlertTriangle, CheckCircle2 } from "lucide-react";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Change Impact Testing — TestSurge",
  description:
    "Automatically detect which test cases are affected when a Jira story changes. TestSurge's change impact analysis keeps your QA team ahead of regressions.",
  alternates: { canonical: `${siteUrl}/solutions/impact` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Change Impact Testing — TestSurge",
    description:
      "Automatically detect which test cases are affected when a Jira story changes. TestSurge's change impact analysis keeps your QA team ahead of regressions.",
    url: `${siteUrl}/solutions/impact`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge Change Impact Testing" }],
    type: "website",
  },
};

const STEPS = [
  { icon: ScanSearch, title: "Story changes", body: "A requirement is updated in Jira — a new field, a changed validation rule, an updated flow." },
  { icon: GitCompareArrows, title: "TestSurge compares versions", body: "AI compares the updated story against your existing test suite and prior story version." },
  { icon: AlertTriangle, title: "Impacted tests are flagged", body: "Every test case likely affected by the change is highlighted, with a reason for each flag." },
  { icon: ListChecks, title: "Team re-runs with confidence", body: "QA re-runs only what matters — and adds new tests for newly introduced behavior." },
];

const BENEFITS = [
  "Stop guessing which tests to re-run after a change",
  "Catch regressions before they reach production",
  "Reduce full regression cycles for small changes",
  "Works with your TestRail and Jira (Zephyr/Xray) test suites",
];

export default function ImpactSolutionPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-1.5 text-sm font-semibold text-secondary">
          Solutions
        </span>
        <h1 className="mt-4 font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Change Impact Testing
        </h1>
        <p className="mt-4 text-lg leading-relaxed text-text-secondary">
          Requirements change constantly — and every change can silently break
          existing functionality. TestSurge&apos;s change impact analysis
          automatically detects which test cases are affected when a Jira
          story changes, so nothing falls through the cracks before release.
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
            See change impact analysis on your stories
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
