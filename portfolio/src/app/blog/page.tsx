import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import BlogIndexClient from "./BlogIndexClient";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "QA Intelligence Blog — TestSurge",
  description:
    "Testing strategies, AI insights, and QA best practices from the TestSurge team. Learn how to generate test cases with AI, run change impact analysis, and more.",
  alternates: { canonical: `${siteUrl}/blog` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "QA Intelligence Blog — TestSurge",
    description:
      "Testing strategies, AI insights, and QA best practices from the TestSurge team.",
    url: `${siteUrl}/blog`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge Blog" }],
    type: "website",
  },
};

export default function BlogIndexPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-6xl px-6 pb-24">
        <div className="text-center">
          <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
            QA Intelligence Blog
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
            Testing strategies, AI insights, and QA best practices.
          </p>
        </div>

        <div className="mt-12">
          <BlogIndexClient />
        </div>
      </div>
    </PageShell>
  );
}
