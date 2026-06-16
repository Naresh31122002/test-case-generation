import type { Metadata } from "next";
import ComparePage from "@/components/ComparePage";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "TestSurge vs Testsigma (2026) — Which QA Tool Should You Choose?",
  description:
    "Detailed comparison of TestSurge and Testsigma. Pricing, AI features, integrations, and which is right for your team.",
  alternates: { canonical: `${siteUrl}/compare/testsigma` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "TestSurge vs Testsigma (2026) — Which QA Tool Should You Choose?",
    description:
      "Detailed comparison of TestSurge and Testsigma. Pricing, AI features, integrations, and which is right for your team.",
    url: `${siteUrl}/compare/testsigma`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge vs Testsigma" }],
    type: "website",
  },
};

const ROWS = [
  { feature: "AI test case generation from Jira", testsurge: true, competitor: "partial" as const },
  { feature: "Change impact analysis", testsurge: true, competitor: false },
  { feature: "Story quality critique", testsurge: true, competitor: false },
  { feature: "No-code test automation execution", testsurge: false, competitor: true },
  { feature: "Cross-browser / mobile automation", testsurge: false, competitor: true },
  { feature: "Jira integration", testsurge: true, competitor: true },
  { feature: "Transparent pricing shown publicly", testsurge: true, competitor: false },
  { feature: "Starting price", testsurge: "$19/mo", competitor: "Custom (sales call)" },
];

export default function ComparePage_Testsigma() {
  return (
    <ComparePage
      competitorName="Testsigma"
      intro="Testsigma is a no-code test automation platform that lets teams build and run automated tests across web, mobile, and API without writing code. TestSurge sits earlier in the pipeline — generating the test cases and identifying which ones are impacted by a change. Here's how they compare."
      rows={ROWS}
      forCompetitor="Testsigma is a strong fit for teams that need to build and execute automated test scripts across browsers and devices without a dedicated automation engineering team, and who are comfortable with custom, sales-led pricing."
      forTestSurge="TestSurge is the better fit for QA teams whose core challenge is turning Jira stories into thorough test case coverage quickly, critiquing stories for ambiguity before development starts, and instantly knowing which test cases are impacted when a story changes — all at transparent, published pricing."
      verdict="TestSurge and Testsigma solve different parts of the QA lifecycle and can be used together: TestSurge generates and maintains your test case backlog with change-impact analysis, while Testsigma automates execution of those tests. If you're a small-to-mid QA team without dedicated automation engineers and your priority is coverage and impact visibility, start with TestSurge."
    />
  );
}
