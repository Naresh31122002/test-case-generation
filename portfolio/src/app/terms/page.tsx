import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Terms of Service — TestSurge",
  description:
    "TestSurge's terms of service: acceptable use, AI-generated content disclaimer, billing, cancellation, liability, and governing law.",
  alternates: { canonical: `${siteUrl}/terms` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Terms of Service — TestSurge",
    description:
      "TestSurge's terms of service: acceptable use, AI-generated content disclaimer, billing, cancellation, liability, and governing law.",
    url: `${siteUrl}/terms`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

export default function TermsPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-text-light">Last updated: June 2026</p>

        <div className="mt-10 flex flex-col gap-10 text-text-secondary">
          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              1. Service description
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge is an AI-powered test generation platform operated by{" "}
              <span className="font-semibold text-text-primary">Kynetropo</span>{" "}
              (the &quot;Company&quot;). The service analyzes user stories,
              acceptance criteria, and requirement documents to automatically
              generate test cases, perform change-impact analysis, and critique
              story quality. These Terms of Service govern your access to and use
              of the TestSurge website (testsurge.kynetropo.com), applications,
              and APIs.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              2. Acceptable use &amp; user responsibilities
            </h2>
            <p className="mt-3 leading-relaxed">
              You may use TestSurge to generate, manage, and export test cases
              and related QA artifacts for your own projects or your
              organization. You are responsible for maintaining the
              confidentiality of your account credentials, for all activity that
              occurs under your account, and for ensuring you have the right to
              submit any content you provide to the service. You agree not to use
              the service to upload unlawful content, attempt to reverse-engineer
              or disrupt the platform, or resell access without a written
              agreement with us.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              3. AI-generated content disclaimer
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge uses AI models to generate test cases, change-impact
              analysis, and story critiques. AI output may occasionally be
              incomplete, inaccurate, or require adjustment. You are
              responsible for reviewing generated content before relying on it
              for release decisions. TestSurge is a productivity aid, not a
              replacement for your team&apos;s QA judgment.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              4. Subscription, billing &amp; auto-renewal
            </h2>
            <p className="mt-3 leading-relaxed">
              Paid plans are billed monthly or annually in advance, based on
              the plan selected at signup. Prices are shown in USD and exclude
              applicable taxes. Generation limits, user seats, and features
              included in each plan are described on our{" "}
              <a href="/#pricing" className="font-semibold text-secondary">
                pricing page
              </a>
              . We may update pricing for future billing periods with at least
              30 days&apos; notice.
            </p>
            <p className="mt-3 leading-relaxed">
              <span className="font-semibold text-text-primary">
                Auto-renewal:
              </span>{" "}
              your subscription{" "}
              <span className="font-semibold text-text-primary">
                automatically renews
              </span>{" "}
              at the end of each billing period (monthly or annual) and your
              payment method is charged the then-current rate, unless you cancel
              before the renewal date. We will send a reminder before annual
              renewals. You can turn off auto-renewal at any time from your
              account settings.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              5. Cancellation &amp; refunds
            </h2>
            <p className="mt-3 leading-relaxed">
              You can cancel your subscription at any time from your account
              settings. Cancellation takes effect at the end of your current
              billing period, and you will retain access until then. Refund
              eligibility, including our 7-day money-back guarantee, is described
              in our{" "}
              <a href="/refund" className="font-semibold text-secondary">
                Refund Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              6. Account termination
            </h2>
            <p className="mt-3 leading-relaxed">
              You may close your account at any time. We may suspend or terminate
              your access if you violate these terms, fail to pay applicable
              fees, or use the service in a way that risks harm to TestSurge or
              other users. Where practical, we will provide notice and an
              opportunity to cure. On termination, your right to use the service
              ends and your content is handled in accordance with our{" "}
              <a href="/privacy" className="font-semibold text-secondary">
                Privacy Policy
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              7. Limitation of liability
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge is provided &quot;as is&quot; without warranties of any
              kind. To the maximum extent permitted by law, TestSurge and its
              team are not liable for indirect, incidental, or consequential
              damages arising from use of the service, including reliance on
              AI-generated test cases or analysis.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              8. Governing law
            </h2>
            <p className="mt-3 leading-relaxed">
              These terms are governed by the laws of{" "}
              <span className="font-semibold text-text-primary">India</span>,
              without regard to conflict-of-law principles. Any disputes arising
              from or relating to these terms or the service will be subject to
              the exclusive jurisdiction of the courts located in India.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              9. Contact
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge — questions about these terms? Email us at{" "}
              <a href="mailto:admin@kynetropo.com" className="font-semibold text-secondary">
                admin@kynetropo.com
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </PageShell>
  );
}
