import { AtSign, Share2, Code2 } from "lucide-react";

const COLUMNS = [
  {
    title: "Product",
    links: ["Features", "Pricing", "Integrations", "Changelog", "Roadmap"],
  },
  {
    title: "Compare",
    links: ["vs TestRail", "vs Qase", "vs Testsigma", "vs Katalon"],
  },
  {
    title: "Resources",
    links: ["Blog", "Documentation", "API Reference", "Status"],
  },
  {
    title: "Company",
    links: ["About", "Careers", "Privacy", "Terms"],
  },
];

const SOCIALS = [
  { icon: AtSign, label: "Twitter", href: "https://twitter.com" },
  { icon: Share2, label: "LinkedIn", href: "https://linkedin.com" },
  { icon: Code2, label: "GitHub", href: "https://github.com" },
];

export default function Footer() {
  return (
    <footer className="bg-text-primary px-6 pt-16 pb-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-6">
          {/* Logo + tagline */}
          <div className="col-span-2">
            <a href="/" className="font-heading text-[28px] font-bold leading-none">
              <span className="text-white">Test</span>
              <span className="text-secondary">Surge</span>
            </a>
            <p className="mt-3 text-sm text-gray-400">AI Test Intelligence</p>
          </div>

          {/* Link columns */}
          {COLUMNS.map((column) => (
            <div key={column.title}>
              <h3 className="font-heading text-sm font-semibold text-white">
                {column.title}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {column.links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-sm text-gray-400 transition-colors hover:text-secondary"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-16 flex flex-col items-center gap-4 border-t border-white/10 pt-8 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-400">
            © 2026 TestSurge. Built for QA teams who ship fast.
          </p>
          <div className="flex items-center gap-4">
            {SOCIALS.map(({ icon: Icon, label, href }) => (
              <a
                key={label}
                href={href}
                aria-label={label}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 transition-colors hover:text-secondary"
              >
                <Icon size={20} />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
