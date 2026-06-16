import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import LoginForm from "./LoginForm";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Sign In — TestSurge",
  description: "Sign in to your TestSurge account.",
  alternates: { canonical: `${siteUrl}/login` },
  robots: { index: false, follow: true },
  openGraph: {
    title: "Sign In — TestSurge",
    description: "Sign in to your TestSurge account.",
    url: `${siteUrl}/login`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

export default function LoginPage() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col items-center px-6 pb-24 text-center">
        <a href="/" className="font-heading text-[28px] font-bold leading-none">
          <span className="text-text-primary">Test</span>
          <span className="text-secondary">Surge</span>
        </a>
        <h1 className="mt-6 font-heading text-3xl font-bold text-text-primary md:text-4xl">
          Welcome back
        </h1>
        <p className="mt-3 text-text-secondary">
          Sign in to access your test cases and impact reports.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-6 text-sm text-text-secondary">
          Don&apos;t have an account?{" "}
          <a href="/signup" className="font-semibold text-secondary">
            Start free trial
          </a>
        </p>
      </div>
    </PageShell>
  );
}
