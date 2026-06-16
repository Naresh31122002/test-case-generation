import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import SignupForm from "./SignupForm";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Join the Waitlist — TestSurge",
  description:
    "Get early access to TestSurge — AI test case generation and change-impact analysis for QA teams. Join the waitlist, no credit card needed.",
  alternates: { canonical: `${siteUrl}/signup` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Join the Waitlist — TestSurge",
    description:
      "Get early access to TestSurge — AI test case generation and change-impact analysis for QA teams.",
    url: `${siteUrl}/signup`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

export default function SignupPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pb-24 text-center">
        <a href="/" className="font-heading text-[28px] font-bold leading-none">
          <span className="text-text-primary">Test</span>
          <span className="text-secondary">Surge</span>
        </a>
        <h1 className="mt-6 font-heading text-3xl font-bold text-text-primary md:text-4xl">
          Start free — no card needed
        </h1>
        <p className="mt-3 text-text-secondary">
          Join the waitlist and be among the first to generate test cases with
          AI.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <SignupForm />
        </div>

        <p className="mt-6 text-sm text-text-secondary">
          Already have an account?{" "}
          <a href="/login" className="font-semibold text-secondary">
            Sign in
          </a>
        </p>
      </div>
    </PageShell>
  );
}
