import type { Metadata } from "next";
import { CheckCircle2 } from "lucide-react";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Changelog — TestSurge",
  description:
    "See what's new in TestSurge, including AI test case generation, change impact analysis, story quality critique, and Jira integration.",
  alternates: { canonical: `${siteUrl}/changelog` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Changelog — TestSurge",
    description:
      "See what's new in TestSurge, including AI test case generation, change impact analysis, story quality critique, and Jira integration.",
    url: `${siteUrl}/changelog`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

const RELEASES = [
  {
    version: "v1.0",
    date: "June 2026",
    title: "Initial Launch",
    items: [
      "AI test case generation from Jira stories",
      "Change impact analysis",
      "Story quality critique",
      "Jira integration",
      "Excel export",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Changelog
        </h1>
        <p className="mt-4 text-lg text-text-secondary">
          What&apos;s new in TestSurge.
        </p>

        <div className="mt-12 flex flex-col gap-10">
          {RELEASES.map((release) => (
            <section
              key={release.version}
              className="rounded-2xl border border-gray-100 bg-muted p-6 md:p-8"
            >
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-white">
                  {release.version}
                </span>
                <span className="text-sm text-text-light">{release.date}</span>
              </div>
              <h2 className="mt-3 font-heading text-2xl font-bold text-text-primary">
                {release.title}
              </h2>
              <ul className="mt-4 flex flex-col gap-2">
                {release.items.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-text-secondary">
                    <CheckCircle2 className="mt-0.5 shrink-0 text-accent" size={18} />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </article>
    </PageShell>
  );
}
