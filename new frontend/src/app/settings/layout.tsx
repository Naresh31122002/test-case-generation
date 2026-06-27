"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, X, ExternalLink } from "lucide-react";
import { PageLayout, PageHeader, PageActions } from "@/components/layout/PageLayout";
import { useAuth } from "@/contexts/AuthContext";

const DOCS_URL = "https://testsurge.kynetropo.com/docs";

interface NavItem {
  label: string;
  href: string;
  /** Opens in a new tab and is never highlighted as the active route. */
  external?: boolean;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

// Phase 6: the Team item is only included once the user has a workspace.
function buildNavSections(hasWorkspace: boolean): NavSection[] {
  return [
    {
      label: "Workspace",
      items: [
        { label: "Workspace",     href: "/settings/workspace" },
        ...(hasWorkspace ? [{ label: "Team", href: "/settings/team" }] : []),
        { label: "Integrations",  href: "/settings/integrations" },
        { label: "API Keys",      href: "/settings/api-keys" },
        { label: "Notifications", href: "/settings/notifications" },
      ],
    },
    {
      label: "Account",
      items: [
        { label: "Profile",     href: "/settings/profile" },
        { label: "Preferences", href: "/settings/preferences" },
        { label: "Billing",     href: "/settings/billing" },
      ],
    },
    {
      label: "Support",
      items: [
        { label: "Contact & Report Bug", href: "/settings/contact" },
        { label: "Documentation", href: DOCS_URL, external: true },
      ],
    },
  ];
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <SettingsLayoutInner>{children}</SettingsLayoutInner>
    </Suspense>
  );
}

function SettingsLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showLogout, setShowLogout] = useState(false);
  const { user, signOut } = useAuth();
  const navSections = buildNavSections(Boolean(user?.currentWorkspace));

  async function handleSignOut() {
    await signOut();
    window.location.href = "/login";
  }

  return (
    <PageLayout>
      <PageHeader title="Settings" actions={<PageActions />} />

      <div className="flex flex-1 overflow-hidden mx-auto w-full max-w-[1600px]">
        {/* Sub-nav */}
        <nav className="w-[200px] flex-shrink-0 border-r border-border py-4 px-2 overflow-y-auto flex flex-col">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p className="px-3 mb-1 text-[11px] font-semibold text-pink uppercase tracking-wide">
                {section.label}
              </p>
              {section.items.map((item) => {
                if (item.external) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative flex items-center justify-between h-9 px-3 rounded-lg text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors mb-0.5"
                    >
                      {item.label}
                      <ExternalLink size={13} className="flex-shrink-0" />
                    </a>
                  );
                }
                // Active match: items WITH query params require the full search string to match.
                // This prevents /settings/contact and /settings/contact?type=bug from both
                // highlighting at the same time — they share a base path but differ by query.
                const itemPath = item.href.split("?")[0];
                const itemQuery = item.href.includes("?") ? item.href.split("?")[1] : null;
                const currentQuery = searchParams.toString();
                const isActive = itemQuery
                  ? pathname === itemPath && currentQuery === itemQuery
                  : pathname === itemPath && currentQuery === "";
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
            </div>
          ))}

          {/* Logout (Account section) */}
          <button
            type="button"
            onClick={() => setShowLogout(true)}
            className="flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-medium text-error hover:bg-[#FEF2F2] transition-colors mt-auto"
          >
            <LogOut size={15} />
            Logout
          </button>
        </nav>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-5 lg:px-6 py-6">
          <div className="max-w-[640px] space-y-6">
            {children}
          </div>
        </div>
      </div>

      {/* Logout confirmation modal */}
      <AnimatePresence>
        {showLogout && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
            onMouseDown={() => setShowLogout(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
              className="w-full max-w-sm bg-white border border-border rounded-card shadow-card overflow-hidden"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <h2 className="text-base font-semibold text-navy">Sign out</h2>
                <button
                  type="button"
                  onClick={() => setShowLogout(false)}
                  className="text-muted hover:text-navy transition-colors"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-5">
                <p className="text-sm text-navy">
                  Are you sure you want to sign out?
                </p>
                <div className="flex justify-end gap-2 mt-5">
                  <button
                    type="button"
                    onClick={() => setShowLogout(false)}
                    className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="h-9 px-4 rounded-btn bg-error text-white text-sm font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
