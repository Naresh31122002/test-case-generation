import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
  display: "swap",
});

const siteUrl = "https://testsurge.kynetropo.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "TestSurge — AI Test Case Generator & Change-Impact Analysis",
  description:
    "Generate 5 types of test cases from Jira stories in 30 seconds. The only AI testing tool with change-impact analysis. Start free — no card needed.",
  openGraph: {
    title: "TestSurge — AI Test Case Generator & Change-Impact Analysis",
    description:
      "Generate 5 types of test cases from Jira stories in 30 seconds. The only AI testing tool with change-impact analysis. Start free — no card needed.",
    url: siteUrl,
    siteName: "TestSurge",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TestSurge — AI Test Case Generator & Change-Impact Analysis",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TestSurge — AI Test Case Generator & Change-Impact Analysis",
    description:
      "Generate 5 types of test cases from Jira stories in 30 seconds. The only AI testing tool with change-impact analysis. Start free — no card needed.",
    images: ["/og-image.png"],
  },
};

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "TestSurge",
  url: siteUrl,
  logo: `${siteUrl}/logo.png`,
  description:
    "AI-powered test case generation and change-impact analysis for QA teams.",
  sameAs: ["https://twitter.com", "https://linkedin.com", "https://github.com"],
};

const softwareApplicationSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "TestSurge",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "Generate 5 types of test cases from Jira stories in 30 seconds. The only AI testing tool with change-impact analysis.",
  offers: {
    "@type": "Offer",
    price: "29",
    priceCurrency: "USD",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "5.0",
    ratingCount: "1",
    bestRating: "5",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(softwareApplicationSchema),
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${plusJakartaSans.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
