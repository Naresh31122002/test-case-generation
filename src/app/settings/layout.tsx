"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const settingsNav = [
  { label: "Workspace",     href: "/settings/workspace" },
  { label: "Integrations",  href: "/settings/integrations" },
  { label: "API Keys",      href: "/settings/api-keys" },
  { label: "Team",          href: "/settings/team" },
  { label: "Billing",       href: "/settings/billing" },
  { label: "Notifications", href: "/settings/notifications" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center px-8">
        <h1 className="text-2xl font-semibold text-navy">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sub-nav */}
        <nav className="w-[200px] flex-shrink-0 border-r border-border py-4 px-2 overflow-y-auto">
          {settingsNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center h-9 px-3 rounded-lg text-sm font-medium transition-colors mb-0.5 ${
                  isActive ? "text-navy bg-surface-pink" : "text-muted hover:text-navy hover:bg-gray-50"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="settings-active"
                    className="absolute left-0 top-0 bottom-0 w-0.5 bg-pink rounded-l-lg"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="max-w-[640px] space-y-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
