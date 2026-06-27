"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import {
  BookOpen,
  GitPullRequest,
  PieChart,
  GitCompare,
  Download,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronUp,
  Kanban,
  Play,
} from "lucide-react";
import { spring } from "@/lib/motion";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";
import { useProductTour } from "@/contexts/ProductTourContext";
import { TourButton } from "@/components/onboarding/TourButton";

const navItems = [
  { label: "Stories", icon: BookOpen, href: "/stories", tourId: "nav-stories", title: "Stories — manage user stories and view generated test cases" },
  { label: "Kanban", icon: Kanban, href: "/kanban", tourId: "nav-kanban", title: "Kanban board — drag stories between status columns" },
  { label: "Changes", icon: GitPullRequest, href: "/changes", tourId: "nav-changes", title: "Changes — track impact when stories are updated" },
  { label: "Coverage", icon: PieChart, href: "/coverage", tourId: "nav-coverage", title: "Coverage — see test coverage across all your stories" },
  { label: "Compare", icon: GitCompare, href: "/compare", tourId: "nav-compare", title: "Compare — cross-story impact detection, see how changes ripple across tests" },
  { label: "Exports", icon: Download, href: "/exports", tourId: "nav-exports", title: "Exports — export test cases to Excel, Playwright, Cypress, or PyTest" },
];

const STORAGE_KEY = "testsurge:sidebar-pinned";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { startTour } = useProductTour();
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    router.push("/login");
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) setPinned(stored === "true");
    } catch {
      /* ignore */
    }
  }, []);

  // Expanded when pinned open, or temporarily on hover (auto-collapse mode).
  const expanded = pinned || hovered;

  // Phase 6: show the user's display name, falling back to nothing (not the email
  // prefix) so the name line never duplicates the email line below it.
  const displayName = user?.fullName?.trim() || null;
  const avatarInitials = displayName
    ? displayName.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()
    : user?.email
    ? user.email.slice(0, 2).toUpperCase()
    : "?";

  // Settings lives in the footer (near the profile), not the main nav.
  const settingsActive =
    pathname === "/settings" || pathname.startsWith("/settings/");

  const togglePinned = () => {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch {
      /* ignore */
    }
  };

  return (
    <motion.aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: expanded ? 240 : 72 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex-shrink-0 h-screen sticky top-0 bg-white border-r border-border flex flex-col overflow-hidden z-40"
    >
      {/* Logo + collapse toggle */}
      <div className="px-2 py-5 border-b border-border flex items-center justify-between gap-2">
        <Link
          href="/"
          className="flex items-center gap-3 min-w-0 px-4 h-10 flex-1"
        >
          {/* Icon slot is centered on the same x-axis as the nav icons below
              (which are 18px wide). The logo image is larger but stays centered
              within this 18px slot, so all sidebar icons line up when collapsed. */}
          <span className="flex-shrink-0 w-[18px] flex items-center justify-center">
            <Image
              src="/icon.png"
              alt="TestSurge"
              width={28}
              height={28}
              className="w-7 h-7 max-w-none"
              priority
            />
          </span>
          <motion.span
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-lg font-bold tracking-tight leading-none whitespace-nowrap"
          >
            <span className="text-navy">Test</span>
            <span className="text-pink">Surge</span>
          </motion.span>
        </Link>
        <button
          type="button"
          onClick={togglePinned}
          title={pinned ? "Auto-collapse sidebar" : "Keep sidebar open"}
          className="flex-shrink-0 text-muted hover:text-navy transition-colors"
          style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? "auto" : "none" }}
        >
          {pinned ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative" data-tour={item.tourId}>
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-surface-pink rounded-lg"
                    style={{ borderLeft: "4px solid var(--color-brand-primary)", boxShadow: "inset 0 0 0 0 transparent" }}
                    transition={spring.snappy}
                  />
                )}
                <Link
                  href={item.href}
                  prefetch
                  title={item.title}
                  className={`relative flex items-center gap-3 px-4 h-10 rounded-lg text-sm font-medium transition-colors duration-100
                    ${isActive
                      ? "text-navy font-semibold"
                      : "text-muted hover:bg-gray-50 hover:text-navy"
                    }`}
                >
                  <Icon
                    size={18}
                    className={`flex-shrink-0 ${isActive ? "text-pink" : ""}`}
                    style={
                      isActive
                        ? { transform: "scale(1.05)", color: "var(--color-brand-primary)" }
                        : {}
                    }
                  />
                  <motion.span
                    animate={{ opacity: expanded ? 1 : 0 }}
                    transition={{ duration: 0.15 }}
                    className="whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Workspace switcher (multi-tenant) */}
      <div className="px-3 pt-3 border-t border-border">
        <TourButton collapsed={!expanded} />
        <WorkspaceSwitcher collapsed={!expanded} />
      </div>

      {/* Footer: user profile menu (Product Tour, Settings, Sign out) */}
      <div ref={menuRef} className="relative px-4 py-4">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-3 text-left"
        >
          <div className="w-8 h-8 rounded-full bg-pink flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {avatarInitials}
          </div>
          <motion.div
            animate={{ opacity: expanded ? 1 : 0 }}
            transition={{ duration: 0.15 }}
            className="flex-1 min-w-0 overflow-hidden"
          >
            {/* Phase 6: prefer the real display name; never repeat the email as
                the "name" line — if no full name is set, show only the email. */}
            {displayName && (
              <p className="text-sm font-medium text-navy truncate">{displayName}</p>
            )}
            <p className={`${displayName ? "text-[11px] text-muted" : "text-sm font-medium text-navy"} truncate`}>
              {user?.email ?? ""}
            </p>
          </motion.div>
          <ChevronUp
            size={14}
            className={`flex-shrink-0 text-muted transition-transform ${menuOpen ? "" : "rotate-180"}`}
            style={{ opacity: expanded ? 1 : 0 }}
          />
        </button>

        <AnimatePresence>
          {menuOpen && expanded && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute left-3 right-3 bottom-full mb-2 bg-white border border-border rounded-card shadow-card overflow-hidden z-50"
            >
              <button
                type="button"
                onClick={() => { setMenuOpen(false); startTour(); }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-navy hover:bg-gray-50 transition-colors"
              >
                <Play size={16} className="text-muted" />
                Product Tour
              </button>
              <div className="border-t border-border" />
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                data-tour="nav-settings"
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors ${
                  settingsActive ? "text-pink bg-surface-pink" : "text-navy hover:bg-gray-50"
                }`}
              >
                <Settings size={16} className={settingsActive ? "text-pink" : "text-muted"} />
                Settings
              </Link>
              <div className="border-t border-border" />
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-navy hover:bg-gray-50 transition-colors"
              >
                <LogOut size={16} className="text-muted" />
                Sign out
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
}
