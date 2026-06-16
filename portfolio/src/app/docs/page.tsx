import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Documentation — TestSurge",
  description:
    "Getting started with TestSurge: connect Jira, generate test cases, run change-impact analysis, and find answers to common questions.",
  alternates: { canonical: `${siteUrl}/docs` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Documentation — TestSurge",
    description:
      "Getting started with TestSurge: connect Jira, generate test cases, run change-impact analysis, and find answers to common questions.",
    url: `${siteUrl}/docs`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

const NAV = [
  { id: "getting-started", label: "Getting Started" },
  { id: "connect-jira", label: "Connect Jira" },
  { id: "generate-test-cases", label: "Generate Test Cases" },
  { id: "impact-analysis", label: "Impact Analysis" },
  { id: "faq", label: "FAQ" },
  { id: "api-reference", label: "API Reference" },
];

const FAQS = [
  {
    q: "Do I need to install anything?",
    a: "No. TestSurge runs entirely in your browser and connects to Jira via OAuth — there's nothing to install.",
  },
  {
    q: "Which Jira plans are supported?",
    a: "TestSurge works with Jira Cloud on any plan. Jira Server / Data Center support is available on the Team and Enterprise plans.",
  },
  {
    q: "Can I edit generated test cases?",
    a: "Yes. Every generated test case is fully editable before export, and you can regenerate individual cases without re-running the whole story.",
  },
  {
    q: "What formats can I export to?",
    a: "Excel (.xlsx), CSV, and direct push to TestRail or Jira (Zephyr/Xray) on supported plans.",
  },
];

export default function DocsPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-6xl gap-12 px-6 pb-24">
        {/* Sidebar */}
        <aside className="sticky top-28 hidden h-fit w-56 shrink-0 lg:block">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-light">
            On this page
          </p>
          <nav className="mt-3 flex flex-col gap-2">
            {NAV.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="text-sm text-text-secondary transition-colors hover:text-secondary"
              >
                {item.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="min-w-0 flex-1">
          <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
            Documentation
          </h1>
          <p className="mt-4 text-lg text-text-secondary">
            Everything you need to get up and running with TestSurge.
          </p>

          <div className="mt-10 flex flex-col gap-12 text-text-secondary">
            <section id="getting-started" className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                Getting Started
              </h2>
              <ol className="mt-4 flex flex-col gap-3 pl-5">
                <li className="list-decimal leading-relaxed">
                  <span className="font-semibold text-text-primary">Create an account</span> —
                  sign up for a free TestSurge account, no credit card
                  required.
                </li>
                <li className="list-decimal leading-relaxed">
                  <span className="font-semibold text-text-primary">Connect Jira</span> —
                  authorize TestSurge to read your project&apos;s stories.
                </li>
                <li className="list-decimal leading-relaxed">
                  <span className="font-semibold text-text-primary">Pick a story</span> —
                  select a Jira story and generate your first set of test
                  cases in seconds.
                </li>
              </ol>
            </section>

            <section id="connect-jira" className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                How to connect Jira
              </h2>
              <p className="mt-3 leading-relaxed">
                From your TestSurge dashboard, go to{" "}
                <span className="font-semibold text-text-primary">Settings → Integrations → Jira</span>{" "}
                and click <span className="font-semibold text-text-primary">Connect</span>.
                You&apos;ll be redirected to Atlassian to authorize access.
                TestSurge only requests read access to issues and write access
                to comments/attachments (for pushing generated test cases
                back to Jira) — we never modify your story descriptions.
              </p>
              <p className="mt-3 leading-relaxed">
                Once connected, choose which projects TestSurge can see. You
                can revoke access at any time from the same settings page.
              </p>
            </section>

            <section id="generate-test-cases" className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                How to generate test cases
              </h2>
              <p className="mt-3 leading-relaxed">
                Open any connected story and click{" "}
                <span className="font-semibold text-text-primary">Generate Tests</span>.
                TestSurge analyzes the story&apos;s description and acceptance
                criteria, then produces all five test types: functional,
                negative, edge case, regression, and integration. Review,
                edit, and export the results — or push them directly to
                TestRail or Jira.
              </p>
            </section>

            <section id="impact-analysis" className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                How to use Impact Analysis
              </h2>
              <p className="mt-3 leading-relaxed">
                When a story changes, open the story in TestSurge and click{" "}
                <span className="font-semibold text-text-primary">Analyze Impact</span>.
                TestSurge compares the updated requirements against your
                existing test suite and flags which test cases are likely
                affected, so your team knows exactly what to re-run before
                release.
              </p>
            </section>

            <section id="faq" className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                FAQ
              </h2>
              <div className="mt-4 flex flex-col gap-4">
                {FAQS.map((item) => (
                  <div key={item.q} className="rounded-2xl border border-gray-100 bg-muted p-5">
                    <p className="font-semibold text-text-primary">{item.q}</p>
                    <p className="mt-2 leading-relaxed">{item.a}</p>
                  </div>
                ))}
              </div>
            </section>

            <section id="api-reference" className="scroll-mt-28">
              <h2 className="font-heading text-2xl font-bold text-text-primary">
                API Reference
              </h2>
              <p className="mt-3 leading-relaxed">
                A public REST API for programmatic test generation and CI/CD
                integration is coming soon. Join the waitlist to be notified
                when API access opens up, and to help shape the spec.
              </p>
              <a
                href="/signup"
                className="mt-4 inline-block rounded-full bg-secondary px-6 py-3 font-semibold text-white shadow-sm transition-transform hover:scale-105"
              >
                Join the waitlist
              </a>
            </section>
          </div>
        </article>
      </div>
    </PageShell>
  );
}
