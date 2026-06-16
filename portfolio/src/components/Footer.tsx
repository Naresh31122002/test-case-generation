import { ShieldCheck, KeyRound, Lock, Users } from "lucide-react";

type Link = { label: string; href: string };

type IconProps = { size?: number; className?: string };

// Brand icons (inline SVG — this lucide-react version has no brand glyphs)
function LinkedinIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      role="img"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function XIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      role="img"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function InstagramIcon({ size = 20, className }: IconProps) {
  return (
    <svg
      role="img"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

const COLUMNS: { title: string; links: Link[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "Integrations", href: "/#integrations" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Compare",
    links: [
      { label: "TestSurge vs TestRail", href: "/compare/testrail" },
      { label: "TestSurge vs Qase", href: "/compare/qase" },
      { label: "TestSurge vs Testsigma", href: "/compare/testsigma" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Jira Test Case Generator", href: "/solutions/jira" },
      { label: "Change Impact Testing", href: "/solutions/impact" },
      { label: "Documentation", href: "/docs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Refund Policy", href: "/refund" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

const SECURITY_BADGES = [
  { icon: ShieldCheck, label: "SOC2 Ready", href: "/security" },
  { icon: KeyRound, label: "SSO", href: "/security#sso" },
  { icon: Users, label: "RBAC", href: "/security#rbac" },
  { icon: Lock, label: "Encrypted Data", href: "/security#encryption" },
];

const SOCIALS = [
  { icon: LinkedinIcon, label: "LinkedIn", href: "https://www.linkedin.com/company/kynetropo/" },
  { icon: XIcon, label: "X (Twitter)", href: "https://x.com/Kynetropo" },
  { icon: InstagramIcon, label: "Instagram", href: "https://www.instagram.com/kynetropo" },
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
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-400 transition-colors hover:text-secondary"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Security badges */}
        <div className="mt-12 flex flex-wrap items-center gap-3 border-t border-white/10 pt-8">
          {SECURITY_BADGES.map(({ icon: Icon, label, href }) => (
            <a
              key={label}
              href={href}
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-accent/40 hover:text-white"
            >
              <Icon size={14} className="text-accent" />
              {label}
            </a>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="mt-10 flex flex-col items-center gap-4 pt-2 sm:flex-row sm:justify-between">
          <p className="text-sm text-gray-400">
            © 2026 TestSurge by{" "}
            <a
              href="https://kynetropo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-secondary hover:underline"
            >
              Kynetropo
            </a>
            . Built for QA teams who ship fast.
          </p>
          <div className="flex items-center gap-4 sm:mr-20">
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
