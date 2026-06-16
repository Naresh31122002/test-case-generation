import type { Metadata } from "next";
import ComparePage from "@/components/ComparePage";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "TestSurge vs TestRail (2026) — Which QA Tool Should You Choose?",
  description:
    "Detailed comparison of TestSurge and TestRail. Pricing, AI features, integrations, and which is right for your team.",
  alternates: { canonical: `${siteUrl}/compare/testrail` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "TestSurge vs TestRail (2026) — Which QA Tool Should You Choose?",
    description:
      "Detailed comparison of TestSurge and TestRail. Pricing, AI features, integrations, and which is right for your team.",
    url: `${siteUrl}/compare/testrail`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge vs TestRail" }],
    type: "website",
  },
};

const ROWS = [
  { feature: "AI test case generation from Jira", testsurge: true, competitor: false },
  { feature: "Change impact analysis", testsurge: true, competitor: false },
  { feature: "Story quality critique", testsurge: true, competitor: false },
  { feature: "Manual test case management", testsurge: true, competitor: true },
  { feature: "Test run tracking & reporting", testsurge: "partial" as const, competitor: true },
  { feature: "Jira integration", testsurge: true, competitor: true },
  { feature: "Transparent pricing shown publicly", testsurge: true, competitor: true },
  { feature: "Starting price", testsurge: "$19/mo", competitor: "$36/user/mo" },
];

export default function ComparePage_TestRail() {
  return (
    <ComparePage
      competitorName="TestRail"
      intro="TestRail is a well-established test case management tool used by QA teams to organize, execute, and report on manual and automated test runs. TestSurge focuses on a different problem: generating the test cases in the first place, and telling you which ones are affected when requirements change. Here's how they compare."
      rows={ROWS}
      forCompetitor="TestRail is a strong fit if your team already writes test cases manually and primarily needs a system to organize test runs, track execution status across releases, and produce detailed reporting for stakeholders."
      forTestSurge="TestSurge is the better fit if your team spends significant time writing test cases from Jira stories, struggles to know which tests to re-run after a requirements change, or wants AI to flag ambiguous stories before they cause bugs. Many teams use TestSurge to generate test cases and push them into TestRail for execution tracking."
      verdict="TestRail and TestSurge aren't strictly either/or — TestRail excels at execution tracking, while TestSurge excels at generation and impact analysis. If you're choosing one tool to start with and your biggest pain point is writing test cases, TestSurge's AI generation and change-impact analysis will save more hours per week. If you already have a healthy test suite and just need better run tracking, TestRail remains a solid choice."
    />
  );
}
