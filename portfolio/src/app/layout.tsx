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
  title: {
    default: "TestSurge — AI Test Case Generator & Impact Analysis",
    template: "%s | TestSurge",
  },
  description:
    "Generate all 5 test types from Jira stories in 30 seconds. Detect change impact. Critique stories. Built by Kynetropo.",
  keywords: [
    "AI test case generator",
    "test case from jira",
    "change impact analysis",
    "QA automation",
    "TestSurge",
    "Kynetropo",
  ],
  authors: [{ name: "Kynetropo" }],
  creator: "Kynetropo",
  publisher: "Kynetropo",
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
    other: [
      {
        rel: "icon",
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
      },
    ],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "TestSurge by Kynetropo",
    title: "TestSurge — AI Test Intelligence & Impact for Modern QA Teams",
    description:
      "Generate tests. Predict impact. Prevent missed coverage.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "TestSurge — AI Test Intelligence & Impact for Modern QA Teams",
      },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TestSurge — AI Test Case Generator",
    description:
      "Generate all 5 test types from Jira stories in 30 seconds.",
    creator: "@kynetropo",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
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
        <link rel="icon" href="/favicon.ico" />
        <link rel="shortcut icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
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
