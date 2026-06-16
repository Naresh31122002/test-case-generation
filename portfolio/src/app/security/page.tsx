import type { Metadata } from "next";
import { ShieldCheck, KeyRound, Users, Lock, Server, Mail } from "lucide-react";
import PageShell from "@/components/PageShell";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Security — TestSurge",
  description:
    "How TestSurge protects your data: SOC2 readiness, SSO, role-based access control, end-to-end encryption, and on-prem options.",
  alternates: { canonical: `${siteUrl}/security` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Security — TestSurge",
    description:
      "How TestSurge protects your data: SOC2 readiness, SSO, role-based access control, end-to-end encryption, and on-prem options.",
    url: `${siteUrl}/security`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

const SECTIONS = [
  {
    id: "soc2",
    icon: ShieldCheck,
    title: "SOC2 Ready",
    body:
      "TestSurge's infrastructure and processes are built to SOC2 standards covering security, availability, and confidentiality. We undergo regular internal audits and are preparing for formal SOC2 Type II certification as we scale.",
  },
  {
    id: "sso",
    icon: KeyRound,
    title: "SSO / Google Workspace",
    body:
      "Enterprise and Team plans support single sign-on via Google Workspace, so your team can log in with existing corporate credentials. SAML-based SSO for other identity providers is available on request.",
  },
  {
    id: "rbac",
    icon: Users,
    title: "Role-Based Access Control (RBAC)",
    body:
      "Admins can assign granular roles — Admin, Editor, Viewer — to control who can generate, edit, export, or manage billing. Audit logs track who changed what and when, giving you full visibility into team activity.",
  },
  {
    id: "encryption",
    icon: Lock,
    title: "End-to-End Encryption",
    body:
      "All data in transit is encrypted with TLS 1.2+, and all data at rest is encrypted using industry-standard AES-256. Story content and generated test artifacts are encrypted in our database and backups.",
  },
  {
    id: "data-never-sold",
    icon: ShieldCheck,
    title: "Data never sold",
    body:
      "We never sell, rent, or share your story content or account data with third parties for advertising or any other purpose. Your data is used only to provide and improve the TestSurge service for you.",
  },
  {
    id: "on-prem",
    icon: Server,
    title: "On-Prem Option",
    body:
      "For organizations with strict data-residency requirements, TestSurge offers an on-premises deployment option on the Team and Enterprise plans, keeping your story data fully within your own infrastructure.",
  },
];

export default function SecurityPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-3xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Security
        </h1>
        <p className="mt-3 text-sm text-text-light">Last updated: June 2026</p>
        <p className="mt-6 text-lg leading-relaxed text-text-secondary">
          Security is built into TestSurge from the ground up. Here&apos;s how
          we keep your test data, story content, and account safe.
        </p>

        <div className="mt-10 flex flex-col gap-10">
          {SECTIONS.map(({ id, icon: Icon, title, body }) => (
            <section key={id} id={id} className="scroll-mt-28">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                  <Icon className="text-secondary" size={20} />
                </span>
                <h2 className="font-heading text-2xl font-bold text-text-primary">
                  {title}
                </h2>
              </div>
              <p className="mt-3 leading-relaxed text-text-secondary">{body}</p>
            </section>
          ))}

          <section className="rounded-2xl bg-muted p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
                <Mail className="text-secondary" size={20} />
              </span>
              <h2 className="font-heading text-xl font-bold text-text-primary">
                Found a vulnerability?
              </h2>
            </div>
            <p className="mt-3 leading-relaxed text-text-secondary">
              We take security reports seriously. If you&apos;ve found a
              potential vulnerability, please report it to{" "}
              <a href="mailto:admin@kynetropo.com" className="font-semibold text-secondary">
                admin@kynetropo.com
              </a>{" "}
              and we&apos;ll respond as quickly as possible.
            </p>
          </section>
        </div>
      </article>
    </PageShell>
  );
}
