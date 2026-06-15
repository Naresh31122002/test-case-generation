"use client";

import { motion } from "framer-motion";

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  size: 4 + ((i * 7) % 12),
  top: (i * 13) % 100,
  left: (i * 23) % 100,
  duration: 6 + (i % 5),
  delay: (i % 6) * 0.5,
}));

export default function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-secondary px-6 py-20">
      {/* Animated particles */}
      {PARTICLES.map((p) => (
        <motion.span
          key={p.id}
          className="pointer-events-none absolute rounded-full bg-white/15"
          style={{
            width: p.size,
            height: p.size,
            top: `${p.top}%`,
            left: `${p.left}%`,
          }}
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.7, 0.3] }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: false, amount: 0.3 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative z-10 mx-auto flex max-w-4xl flex-col items-center text-center"
      >
        <h2 className="font-heading text-3xl font-bold text-white md:text-5xl">
          Start writing better tests today
        </h2>
        <p className="mt-4 text-lg text-white/80">
          Free for 7 days. No credit card needed.
        </p>
        <motion.a
          href="/trial"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          className="mt-8 rounded-full bg-white px-8 py-4 text-lg font-semibold text-secondary shadow-lg"
        >
          Start Free Trial
        </motion.a>
      </motion.div>
    </section>
  );
}
