import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "About — TestSurge",
  description:
    "TestSurge's mission is to make QA intelligent, not manual. Learn about the problem we solve, our team, and the tech stack behind TestSurge.",
  alternates: { canonical: `${siteUrl}/about` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "About — TestSurge",
    description:
      "TestSurge's mission is to make QA intelligent, not manual. Learn about the problem we solve, our team, and the tech stack behind TestSurge.",
    url: `${siteUrl}/about`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

const STACK = ["Next.js", "Python", "LanceDB", "PostgreSQL", "Groq AI"];

const TEAM = [
  { name: "Founding Team", role: "Product & Engineering" },
  { name: "Founding Team", role: "AI & Infrastructure" },
  { name: "Founding Team", role: "QA & Customer Success" },
];

export default function AboutPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <span className="inline-flex items-center gap-2 rounded-full bg-secondary/10 px-4 py-1.5 text-sm font-semibold text-secondary">
          <Sparkles size={16} />
          About TestSurge
        </span>

        <h1 className="mt-4 font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Make QA intelligent, not manual
        </h1>

        <div className="mt-10 flex flex-col gap-10 text-text-secondary">
          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              Our mission
            </h2>
            <p className="mt-3 leading-relaxed">
              QA teams spend hours every week translating Jira stories into
              test cases by hand — and even more time figuring out which tests
              break when requirements change. TestSurge exists to take that
              manual, repetitive work off your plate, so QA engineers can focus
              on the judgment calls only humans can make.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              The problem we solve
            </h2>
            <p className="mt-3 leading-relaxed">
              Most testing tools help you organize test cases you&apos;ve
              already written. Few help you write them — and almost none tell
              you which existing tests are affected when a requirement changes.
              TestSurge reads your Jira stories, generates all five core types
              of test cases, critiques the story for ambiguity before bugs
              happen, and runs change-impact analysis so nothing falls through
              the cracks during a release.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              The team
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge is built by a small team of engineers and QA
              practitioners who got tired of writing the same test cases over
              and over.
            </p>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              {TEAM.map((member) => (
                <div
                  key={member.role}
                  className="rounded-2xl border border-gray-100 bg-muted p-5 text-center"
                >
                  <div className="mx-auto h-14 w-14 rounded-full bg-secondary/10" />
                  <p className="mt-3 font-heading font-bold text-text-primary">
                    {member.name}
                  </p>
                  <p className="text-sm text-text-secondary">{member.role}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              Built with
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge is built on a modern, fast, and reliable stack:
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {STACK.map((tech) => (
                <span
                  key={tech}
                  className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-text-primary"
                >
                  {tech}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              About Kynetropo
            </h2>
            <p className="mt-3 leading-relaxed">
              Kynetropo is a software company building AI-powered developer and
              QA tools. TestSurge is our flagship product — an AI test
              intelligence platform for modern QA teams.
            </p>
            <p className="mt-3 leading-relaxed">
              Website:{" "}
              <a
                href="https://kynetropo.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-secondary hover:underline"
              >
                kynetropo.com
              </a>
              <br />
              Contact:{" "}
              <a
                href="mailto:admin@kynetropo.com"
                className="font-semibold text-secondary hover:underline"
              >
                admin@kynetropo.com
              </a>
            </p>
          </section>

          <section className="rounded-2xl bg-text-primary p-8 text-center">
            <h2 className="font-heading text-2xl font-bold text-white">
              Ready to give your QA team time back?
            </h2>
            <a
              href="/signup"
              className="mt-6 inline-block rounded-full bg-secondary px-8 py-3 font-semibold text-white shadow-lg transition-transform hover:scale-105"
            >
              Start Free Trial
            </a>
          </section>
        </div>
      </article>
    </PageShell>
  );
}
