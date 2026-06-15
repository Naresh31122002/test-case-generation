"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";

const NAV_LINKS = ["Features", "Pricing", "Integrations", "Blog"];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-white/70 backdrop-blur-md shadow-sm"
          : "bg-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
        {/* Logo */}
        <a href="/" className="font-heading font-bold text-[28px] leading-none">
          <span className="text-text-primary">Test</span>
          <span className="text-secondary">Surge</span>
        </a>

        {/* Desktop nav links */}
        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href={`#${link.toLowerCase()}`}
              className="text-text-secondary transition-colors duration-200 hover:text-secondary"
            >
              {link}
            </a>
          ))}
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
