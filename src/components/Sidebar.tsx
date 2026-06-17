"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  GitPullRequest,
  PieChart,
  GitCompare,
  Download,
  Settings,
} from "lucide-react";
import { spring } from "@/lib/motion";

const navItems = [
  { label: "Stories", icon: BookOpen, href: "/stories" },
  { label: "Changes", icon: GitPullRequest, href: "/changes" },
  { label: "Coverage", icon: PieChart, href: "/coverage" },
  { label: "Compare", icon: GitCompare, href: "/compare" },
  { label: "Exports", icon: Download, href: "/exports" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-sidebar flex-shrink-0 h-screen sticky top-0 bg-white border-r border-border flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-pink tracking-tight">TestSurge</span>
        </div>
        <p className="text-[11px] text-muted mt-0.5">Acme Corp workspace</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto">
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
                  className={`relative flex items-center gap-3 px-4 h-10 rounded-lg text-sm font-medium transition-colors duration-100
                    ${isActive
                      ? "text-navy"
                      : "text-muted hover:bg-gray-50 hover:text-navy"
                    }`}
                >
                  <Icon
                    size={18}
                    className={isActive ? "text-pink" : ""}
                    style={
                      isActive
                        ? { transform: "scale(1.05)", color: "#FF0A78" }
                        : {}
                    }
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-pink flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          JD
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-navy truncate">Jane Doe</p>
          <p className="text-[11px] text-muted truncate">jane@acme.com</p>
        </div>
        <Link href="/settings" className="text-muted hover:text-navy transition-colors">
          <Settings size={16} />
        </Link>
      </div>
    </aside>
  );
}
