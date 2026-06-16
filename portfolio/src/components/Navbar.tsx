"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "/#features", id: "features" },
  { label: "Pricing", href: "/#pricing", id: "pricing" },
  { label: "Integrations", href: "/#integrations", id: "integrations" },
  { label: "Blog", href: "/blog", id: "blog" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 8);
      // Clear any active highlight when the user returns to the top.
      if (window.scrollY < 100) setActiveLink(null);
    };
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = NAV_LINKS.map((link) => document.getElementById(link.id)).filter(
      (el): el is HTMLElement => el !== null
    );

    const observer = new IntersectionObserver(
      (entries) => {
        // Don't highlight anything while the page is still at the top —
        // only activate a link once the user has scrolled to a section.
        if (window.scrollY < 100) {
          setActiveLink(null);
          return;
        }
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveLink(entry.target.id);
          }
        });
      },
      { rootMargin: "-40% 0px -55% 0px", threshold: 0 }
    );

    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={
        scrolled
          ? {
              background: "rgba(255, 255, 255, 0.85)",
              backdropFilter: "blur(8px)",
              WebkitBackdropFilter: "blur(8px)",
              boxShadow: "0 1px 12px rgba(26, 26, 46, 0.06)",
            }
          : { background: "transparent" }
      }
    >
      <nav
        className="relative flex items-center justify-between"
        style={{
          width: "100%",
          maxWidth: "100vw",
          padding: "16px 48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          overflow: "visible",
        }}
      >
        {/* Logo */}
        <a
          href="/"
          className="font-heading"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            textDecoration: "none",
          }}
        >
          <img
            src="/icon.png"
            alt="TestSurge"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
              verticalAlign: "middle",
            }}
          />
          <span
            style={{
              fontSize: "22px",
              fontWeight: "700",
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
            }}
          >
            <span style={{ color: "#0D1B2A" }}>Test</span>
            <span style={{ color: "#FF3B6B" }}>Surge</span>
          </span>
        </a>

        {/* Desktop nav links — macOS-style glassmorphic pill */}
        <div
          className="absolute left-1/2 hidden max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-1 rounded-full border md:flex"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(0, 0, 0, 0.06)",
            boxShadow: "0 2px 12px rgba(0, 0, 0, 0.08)",
            borderRadius: "999px",
            padding: "6px 8px",
          }}
        >
          {NAV_LINKS.map((link) => {
            const isActive = activeLink === link.id;
            return (
              <a
                key={link.label}
                href={link.href}
                className="relative whitespace-nowrap rounded-full px-4 py-1.5 font-normal"
                style={{
                  fontSize: "14px",
                  color: isActive ? "#0D1B2A" : "#6b7280",
                  transition: "color 300ms ease",
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="navActivePill"
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: "#F5F5F7",
                      boxShadow: "0 1px 4px rgba(0, 0, 0, 0.08)",
                    }}
                    transition={{ type: "spring", duration: 0.3, bounce: 0.15 }}
                  />
                )}
                <span className="relative z-10">{link.label}</span>
              </a>
            );
          })}
        </div>

        {/* Right side buttons (desktop) */}
        <div className="hidden items-center gap-4 md:flex">
          <a
            href="/login"
            className="rounded-full border border-text-primary px-5 py-2 text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-surface"
          >
            Sign In
          </a>
          <motion.a
            href="/signup"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-full bg-secondary px-6 py-2 font-semibold text-white shadow-sm"
          >
            Start Free Trial
          </motion.a>
        </div>

        {/* Mobile hamburger */}
        <button
          aria-label="Toggle menu"
          onClick={() => setMenuOpen((open) => !open)}
          className="text-text-primary md:hidden"
        >
          {menuOpen ? <X size={28} /> : <Menu size={28} />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden bg-white/90 backdrop-blur-md shadow-sm md:hidden"
          >
            <div className="flex flex-col gap-4 px-6 py-6">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="font-normal transition-colors duration-200"
                  style={{ color: "#374151", fontSize: "15px" }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#1A1A1A";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#374151";
                  }}
                >
                  {link.label}
                </a>
              ))}

              <div className="mt-2 flex flex-col gap-3">
                <a
                  href="/login"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-text-primary px-5 py-2 text-center text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-surface"
                >
                  Sign In
                </a>
                <motion.a
                  href="/signup"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full bg-secondary px-6 py-2 text-center font-semibold text-white shadow-sm"
                >
                  Start Free Trial
                </motion.a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
