import type { Metadata } from "next";
import ComparePage from "@/components/ComparePage";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "TestSurge vs Qase (2026) — Which QA Tool Should You Choose?",
  description:
    "Detailed comparison of TestSurge and Qase. Pricing, AI features, integrations, and which is right for your team.",
  alternates: { canonical: `${siteUrl}/compare/qase` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "TestSurge vs Qase (2026) — Which QA Tool Should You Choose?",
    description:
      "Detailed comparison of TestSurge and Qase. Pricing, AI features, integrations, and which is right for your team.",
    url: `${siteUrl}/compare/qase`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge vs Qase" }],
    type: "website",
  },
};

const ROWS = [
  { feature: "AI test case generation from Jira", testsurge: true, competitor: "partial" as const },
  { feature: "Change impact analysis", testsurge: true, competitor: false },
  { feature: "Story quality critique", testsurge: true, competitor: false },
  { feature: "Test case management & repositories", testsurge: "partial" as const, competitor: true },
  { feature: "Test run tracking & reporting", testsurge: "partial" as const, competitor: true },
  { feature: "Jira integration", testsurge: true, competitor: true },
  { feature: "Transparent pricing shown publicly", testsurge: true, competitor: true },
  { feature: "Starting price", testsurge: "$19/mo", competitor: "$49.80/mo" },
];

export default function ComparePage_Qase() {
  return (
    <ComparePage
      competitorName="Qase"
      intro="Qase is a modern test case management platform with growing AI capabilities, popular with teams that want a unified hub for manual and automated testing. TestSurge focuses specifically on AI-driven test generation and change-impact analysis from your Jira backlog. Here's how they compare."
      rows={ROWS}
      forCompetitor="Qase is a great choice for teams that want an all-in-one home for test repositories, test runs, and automation results, with some AI-assisted authoring features layered on top of a traditional test management workflow."
      forTestSurge="TestSurge is the better fit if your biggest bottleneck is converting Jira stories into comprehensive test coverage — including negative, edge-case, and regression tests — and you want a dedicated change-impact engine that flags exactly which tests need attention after a requirements change."
      verdict={`Qase and TestSurge can complement each other: TestSurge generates and maintains test case coverage tied to your Jira stories with change-impact analysis, while Qase can serve as the broader execution and reporting hub. If you need to start with one, teams whose core pain point is "we don't have enough test cases, and we don't know what changed" will see faster ROI from TestSurge.`}
    />
  );
}
