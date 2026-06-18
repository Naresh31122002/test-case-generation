"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  GitPullRequest,
  PieChart,
  GitCompare,
  Download,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { spring } from "@/lib/motion";
import { WorkspaceSwitcher } from "@/components/WorkspaceSwitcher";

const navItems = [
  { label: "Stories", icon: BookOpen, href: "/stories" },
  { label: "Changes", icon: GitPullRequest, href: "/changes" },
  { label: "Coverage", icon: PieChart, href: "/coverage" },
  { label: "Compare", icon: GitCompare, href: "/compare" },
  { label: "Exports", icon: Download, href: "/exports" },
];

const STORAGE_KEY = "testsurge:sidebar-pinned";

export function Sidebar() {
  const pathname = usePathname();
  // `pinned` = user explicitly keeps it open. Default false => auto-collapse mode.
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);

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
              <li key={item.href} className="relative">
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-surface-pink rounded-lg"
                    style={{ borderLeft: "3px solid #FF0A78" }}
                    transition={spring.snappy}
                  />
                )}
                <Link
                  href={item.href}
                  prefetch
                  title={item.label}
                  className={`relative flex items-center gap-3 px-4 h-10 rounded-lg text-sm font-medium transition-colors duration-100
                    ${isActive
                      ? "text-navy"
                      : "text-muted hover:bg-gray-50 hover:text-navy"
                    }`}
                >
                  <Icon
                    size={18}
                    className={`flex-shrink-0 ${isActive ? "text-pink" : ""}`}
                    style={
                      isActive
                        ? { transform: "scale(1.05)", color: "#FF0A78" }
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
        <WorkspaceSwitcher collapsed={!expanded} />
      </div>

      {/* Footer: user profile + Settings entry point */}
      <div className="px-4 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-pink flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          JD
        </div>
        <motion.div
          animate={{ opacity: expanded ? 1 : 0 }}
          transition={{ duration: 0.15 }}
          className="flex-1 min-w-0 overflow-hidden"
        >
          <p className="text-sm font-medium text-navy truncate">Jane Doe</p>
          <p className="text-[11px] text-muted truncate">jane@acme.com</p>
        </motion.div>
        <Link
          href="/settings"
          title="Settings"
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            settingsActive
              ? "bg-surface-pink text-pink"
              : "text-muted hover:text-navy hover:bg-gray-50"
          }`}
          style={{ opacity: expanded ? 1 : 0, pointerEvents: expanded ? "auto" : "none" }}
        >
          <Settings size={17} />
        </Link>
      </div>
    </motion.aside>
  );
}
