"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = ["Features", "Pricing", "Integrations", "Blog"];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeLink, setActiveLink] = useState(NAV_LINKS[0]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
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
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "0 1px 12px rgba(26, 26, 46, 0.06)",
            }
          : { background: "transparent" }
      }
    >
      <nav className="relative mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        {/* Logo */}
        <a href="/" className="font-heading font-bold text-[28px] leading-none">
          <span className="text-text-primary">Test</span>
          <span className="text-secondary">Surge</span>
        </a>

        {/* Desktop nav links — glassmorphic floating pill */}
        <div
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 rounded-full border p-2 md:flex"
          style={{
            background: "rgba(255, 255, 255, 0.7)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderColor: "rgba(255, 255, 255, 0.8)",
            boxShadow: "0 4px 24px rgba(255, 77, 109, 0.08)",
          }}
        >
          {NAV_LINKS.map((link) => {
            const isActive = link === activeLink;
            return (
              <motion.a
                key={link}
                href={`#${link.toLowerCase()}`}
                onClick={() => setActiveLink(link)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className={`rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? "bg-white text-secondary shadow-[0_2px_8px_rgba(26,26,46,0.08)]"
                    : "text-text-secondary hover:bg-secondary/[0.08] hover:text-secondary"
                }`}
              >
                {link}
              </motion.a>
            );
          })}
        </div>

        {/* Right side buttons (desktop) */}
        <div className="hidden items-center gap-4 md:flex">
          <a
            href="/signin"
            className="rounded-full border border-text-primary px-5 py-2 text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-surface"
          >
            Sign In
          </a>
          <motion.a
            href="/trial"
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
                  key={link}
                  href={`#${link.toLowerCase()}`}
                  onClick={() => setMenuOpen(false)}
                  className="text-text-secondary transition-colors duration-200 hover:text-secondary"
                >
                  {link}
                </a>
              ))}

              <div className="mt-2 flex flex-col gap-3">
                <a
                  href="/signin"
                  onClick={() => setMenuOpen(false)}
                  className="rounded-full border border-text-primary px-5 py-2 text-center text-text-primary transition-colors duration-200 hover:bg-text-primary hover:text-surface"
                >
                  Sign In
                </a>
                <motion.a
                  href="/trial"
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
