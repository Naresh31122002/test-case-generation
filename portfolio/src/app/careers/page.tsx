import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Careers — TestSurge",
  description:
    "Join the TestSurge team and help make QA intelligent, not manual. See open roles and what it's like to work with us.",
  alternates: { canonical: `${siteUrl}/careers` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Careers — TestSurge",
    description:
      "Join the TestSurge team and help make QA intelligent, not manual.",
    url: `${siteUrl}/careers`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

export default function CareersPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Careers
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-text-secondary">
          We&apos;re a small team building AI test intelligence for QA teams.
          We don&apos;t have open roles listed right now, but we&apos;re
          always happy to hear from people who care about QA and AI.
        </p>
        <a
          href="mailto:admin@kynetropo.com"
          className="mt-6 inline-block rounded-full border border-text-primary px-8 py-3 font-semibold text-text-primary transition-colors hover:bg-text-primary hover:text-white"
        >
          admin@kynetropo.com
        </a>
      </article>
    </PageShell>
  );
}
