import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Refund Policy — TestSurge",
  description:
    "TestSurge's refund policy: 7-day no-questions-asked money-back guarantee, how to request a refund, processing times, and annual plan terms.",
  alternates: { canonical: `${siteUrl}/refund` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Refund Policy — TestSurge",
    description:
      "TestSurge's refund policy: 7-day no-questions-asked money-back guarantee, how to request a refund, processing times, and annual plan terms.",
    url: `${siteUrl}/refund`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

export default function RefundPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Refund Policy
        </h1>
        <p className="mt-3 text-sm text-text-light">Last updated: June 2026</p>

        <div className="mt-10 flex flex-col gap-10 text-text-secondary">
          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              1. 7-day money-back guarantee
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge offers a{" "}
              <span className="font-semibold text-text-primary">
                7-day money-back guarantee
              </span>{" "}
              on new paid subscriptions. If you are not satisfied for any reason
              within 7 days of your initial purchase, you are eligible for a
              full refund —{" "}
              <span className="font-semibold text-text-primary">
                no questions asked
              </span>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              2. How to request a refund
            </h2>
            <p className="mt-3 leading-relaxed">
              To request a refund, simply email us at{" "}
              <a href="mailto:admin@kynetropo.com" className="font-semibold text-secondary">
                admin@kynetropo.com
              </a>{" "}
              from the email address associated with your account. Include your
              account email and, if available, your invoice or order number so
              we can locate your purchase quickly.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              3. Processing time
            </h2>
            <p className="mt-3 leading-relaxed">
              Approved refunds are processed within{" "}
              <span className="font-semibold text-text-primary">
                5–7 business days
              </span>{" "}
              back to your original payment method. Depending on your bank or
              card issuer, it may take a few additional days for the credit to
              appear on your statement.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              4. After the 7-day window
            </h2>
            <p className="mt-3 leading-relaxed">
              After the initial 7-day window, monthly subscriptions are{" "}
              <span className="font-semibold text-text-primary">
                non-refundable
              </span>
              . You can still cancel at any time from your account settings —
              cancellation stops future renewals, and you retain access through
              the end of your current billing period (pro-rated cancellation,
              not a pro-rated refund).
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              5. Annual plans
            </h2>
            <p className="mt-3 leading-relaxed">
              For{" "}
              <span className="font-semibold text-text-primary">
                annual plans
              </span>
              , you may request a full refund within{" "}
              <span className="font-semibold text-text-primary">
                30 days
              </span>{" "}
              of purchase. After 30 days, annual subscriptions are
              non-refundable, but you can cancel auto-renewal at any time and
              keep access until the end of your paid term.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              6. Contact
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge — questions about refunds or billing? Email us at{" "}
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
