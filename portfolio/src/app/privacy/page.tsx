import type { Metadata } from "next";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Privacy Policy — TestSurge",
  description:
    "Learn what data TestSurge collects, how it's used for AI processing, our data retention policy, and how we comply with GDPR.",
  alternates: { canonical: `${siteUrl}/privacy` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Privacy Policy — TestSurge",
    description:
      "Learn what data TestSurge collects, how it's used for AI processing, our data retention policy, and how we comply with GDPR.",
    url: `${siteUrl}/privacy`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-text-light">Last updated: June 2026</p>

        <div className="mt-10 flex flex-col gap-10 text-text-secondary">
          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              1. What data we collect
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge is a product of{" "}
              <span className="font-semibold text-text-primary">Kynetropo</span>{" "}
              (kynetropo.com). TestSurge collects only the information necessary
              to generate test cases and provide our service. This includes:
            </p>
            <ul className="mt-3 flex flex-col gap-2 pl-5">
              <li className="list-disc leading-relaxed">
                <span className="font-semibold text-text-primary">Story content:</span>{" "}
                the text of Jira user stories, acceptance criteria, and any
                requirement documents you submit for test generation.
              </li>
              <li className="list-disc leading-relaxed">
                <span className="font-semibold text-text-primary">Account information:</span>{" "}
                your email address, name, and organization, used for
                authentication and billing.
              </li>
              <li className="list-disc leading-relaxed">
                <span className="font-semibold text-text-primary">Usage data:</span>{" "}
                basic product analytics (pages visited, features used) to help
                us improve TestSurge.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              2. How we use it
            </h2>
            <p className="mt-3 leading-relaxed">
              Story content you submit is used exclusively for{" "}
              <span className="font-semibold text-text-primary">AI processing</span>{" "}
              — generating test cases, running change-impact analysis, and
              critiquing story quality. We do not sell, rent, or use your story
              content to train third-party models, and we do not share it with
              advertisers.
            </p>
            <p className="mt-3 leading-relaxed">
              Account information is used to operate your subscription, send
              service-related communications, and provide support. Usage data
              is aggregated and anonymized before being used for product
              analytics.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              3. We do not sell your data
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge does{" "}
              <span className="font-semibold text-text-primary">not sell</span>{" "}
              your personal data, your story content, or any information you
              submit to us. We do not trade, monetize, or otherwise disclose
              your data to third parties for their own marketing or commercial
              purposes.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              4. Data security and encryption
            </h2>
            <p className="mt-3 leading-relaxed">
              All data is{" "}
              <span className="font-semibold text-text-primary">
                stored encrypted
              </span>{" "}
              at rest and transmitted over encrypted connections (TLS) in
              transit. We apply industry-standard safeguards, access controls,
              and regular security reviews to protect your story content and
              account information against unauthorized access.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              5. Data retention policy
            </h2>
            <p className="mt-3 leading-relaxed">
              We retain story content and generated test artifacts for as long
              as your account is active, so you can revisit and re-export past
              generations. If you delete a project or close your account, the
              associated content is permanently removed from our active systems
              within 30 days, and from backups within 90 days.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              6. GDPR &amp; CCPA compliance
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge complies with the EU General Data Protection Regulation
              (GDPR). If you are located in the European Economic Area, you
              have the right to access, correct, export, or request deletion of
              your personal data at any time. We act as a data processor for
              story content you submit and as a data controller for account
              information.
            </p>
            <p className="mt-3 leading-relaxed">
              We also comply with the California Consumer Privacy Act (CCPA). If
              you are a California resident, you have the right to know what
              personal information we collect, request its deletion, and opt out
              of the sale of your personal information. As stated above, we do
              not sell your personal information. To exercise any of these
              rights, contact us at{" "}
              <a href="mailto:admin@kynetropo.com" className="font-semibold text-secondary">
                admin@kynetropo.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              7. Cookie policy
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge uses cookies and similar technologies to keep you signed
              in, remember your preferences, and understand how the product is
              used. We use{" "}
              <span className="font-semibold text-text-primary">
                essential cookies
              </span>{" "}
              required for authentication and security, and{" "}
              <span className="font-semibold text-text-primary">
                analytics cookies
              </span>{" "}
              to measure aggregated, anonymized usage. We do not use cookies for
              third-party advertising. You can control or disable cookies
              through your browser settings; disabling essential cookies may
              affect core functionality.
            </p>
          </section>

          <section>
            <h2 className="font-heading text-2xl font-bold text-text-primary">
              8. Contact
            </h2>
            <p className="mt-3 leading-relaxed">
              TestSurge — questions about this policy or a data request? Email us
              at{" "}
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
