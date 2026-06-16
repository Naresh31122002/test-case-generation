"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BLOG_POSTS, type BlogCategory } from "@/lib/blog";

const CATEGORIES: ("All" | BlogCategory)[] = [
  "All",
  "AI Testing",
  "Change Management",
  "Jira",
  "Best Practices",
];

export default function BlogIndexClient() {
  const [active, setActive] = useState<"All" | BlogCategory>("All");

  const posts =
    active === "All" ? BLOG_POSTS : BLOG_POSTS.filter((p) => p.tags.includes(active));

  return (
    <div>
      {/* Filter */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActive(cat)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active === cat
                ? "bg-secondary text-white"
                : "bg-muted text-text-secondary hover:text-text-primary"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post, i) => (
          <motion.a
            key={post.slug}
            href={`/blog/${post.slug}`}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: "easeOut" }}
            whileHover={{ y: -4 }}
            className="flex flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-shadow hover:shadow-lg"
          >
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-text-secondary"
                >
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="mt-4 font-heading text-lg font-bold leading-snug text-text-primary">
              {post.title}
            </h2>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-text-secondary">
              {post.excerpt}
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-text-light">
              <span>{post.date}</span>
              <span aria-hidden>·</span>
              <span>{post.readTime}</span>
            </div>
          </motion.a>
        ))}
      </div>
    </div>
  );
}
