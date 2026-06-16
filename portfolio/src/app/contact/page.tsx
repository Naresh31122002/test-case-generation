import type { Metadata } from "next";
import { Mail, Clock } from "lucide-react";
import PageShell from "@/components/PageShell";
import ContactForm from "@/components/ContactForm";

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  title: "Contact — TestSurge",
  description:
    "Get in touch with TestSurge. Reach our general, billing, legal, and security teams, or send us a message — we respond within 24 hours.",
  alternates: { canonical: `${siteUrl}/contact` },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Contact — TestSurge",
    description:
      "Get in touch with TestSurge. Reach our general, billing, legal, and security teams, or send us a message — we respond within 24 hours.",
    url: `${siteUrl}/contact`,
    siteName: "TestSurge",
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "TestSurge" }],
    type: "website",
  },
};

const CONTACTS = [
  {
    icon: Mail,
    label: "Email us",
    email: "admin@kynetropo.com",
    note: "General questions, sales, billing, legal, and security — we route your message to the right team.",
  },
];

export default function ContactPage() {
  return (
    <PageShell>
      <article className="mx-auto max-w-5xl px-6 pb-24">
        <h1 className="font-heading text-4xl font-bold text-text-primary md:text-5xl">
          Contact us
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-text-secondary">
          We&apos;re here to help. Reach the right team directly, or send us a
          message using the form below.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-secondary/20 bg-secondary/5 px-4 py-2 text-sm font-medium text-text-primary">
          <Clock size={16} className="text-secondary" />
          We respond within 24 hours
        </p>

        <div className="mt-12 grid gap-10 md:grid-cols-2">
          {/* Contact channels */}
          <div className="flex flex-col gap-4">
            {CONTACTS.map(({ icon: Icon, label, email, note }) => (
              <div
                key={label}
                className="flex items-start gap-4 rounded-2xl border border-text-primary/10 bg-white p-5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                  <Icon size={20} className="text-secondary" />
                </div>
                <div>
                  <h3 className="font-heading text-base font-semibold text-text-primary">
                    {label}
                  </h3>
                  <a
                    href={`mailto:${email}`}
                    className="font-semibold text-secondary"
                  >
                    {email}
                  </a>
                  <p className="mt-1 text-sm text-text-secondary">{note}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="rounded-2xl border border-text-primary/10 bg-white p-6 md:p-8">
            <h2 className="font-heading text-xl font-bold text-text-primary">
              Send a message
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Fill out the form and the right team will get back to you.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </article>
    </PageShell>
  );
}
