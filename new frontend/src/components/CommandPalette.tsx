"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  BookOpen,
  TestTube2,
  GitPullRequest,
  PieChart,
  Clock,
  CornerDownLeft,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import { useProject } from "@/contexts/ProjectContext";

type ResultKind = "story" | "test" | "change" | "coverage" | "nav";

interface CommandItem {
  id: string;
  kind: ResultKind;
  title: string;
  subtitle?: string;
  href: string;
  keywords: string;
}

const KIND_META: Record<
  ResultKind,
  { label: string; icon: typeof BookOpen }
> = {
  story: { label: "Stories", icon: BookOpen },
  test: { label: "Tests", icon: TestTube2 },
  change: { label: "Changes", icon: GitPullRequest },
  coverage: { label: "Coverage", icon: PieChart },
  nav: { label: "Navigation", icon: Search },
};

const NAV_ITEMS: CommandItem[] = [
  { id: "nav-stories", kind: "nav", title: "Stories", href: "/stories", keywords: "stories home" },
  { id: "nav-changes", kind: "nav", title: "Changes", href: "/changes", keywords: "changes impact" },
  { id: "nav-coverage", kind: "nav", title: "Coverage", href: "/coverage", keywords: "coverage gaps" },
  { id: "nav-compare", kind: "nav", title: "Compare", href: "/compare", keywords: "compare diff" },
  { id: "nav-exports", kind: "nav", title: "Exports", href: "/exports", keywords: "exports download" },
  { id: "nav-settings", kind: "nav", title: "Settings", href: "/settings", keywords: "settings preferences" },
  { id: "nav-kanban", kind: "nav", title: "Kanban", href: "/kanban", keywords: "kanban board" },
];

const RECENT_KEY = "testsurge:recent-searches";

export function CommandPalette() {
  const router = useRouter();
  const { selectedProject } = useProject();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [storyItems, setStoryItems] = useState<CommandItem[]>([]);
  const [storyFetchError, setStoryFetchError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load real stories from API when palette opens
  useEffect(() => {
    if (!open) return;
    setStoryFetchError(false);
    api.getStories(1, 200).then(res => {
      const items: CommandItem[] = res.data.map(domainStoryToSeed).map(s => ({
        id: `story:${s.id}`,
        kind: "story" as ResultKind,
        title: s.title,
        subtitle: `${s.id} · ${s.testCount} tests${s.impactCount > 0 ? ` · ${s.impactCount} impacts` : ''}`,
        href: `/stories/${s.id}`,
        keywords: `${s.id} ${s.title} ${s.status}`,
      }));
      setStoryItems(items);
    }).catch(() => { setStoryFetchError(true); });
  }, [open]);

  // Load recent searches.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      if (raw) setRecent(JSON.parse(raw));
    } catch {
      /* ignore */
    }
  }, []);

  const pushRecent = useCallback((term: string) => {
    if (!term.trim()) return;
    setRecent((prev) => {
      const next = [term, ...prev.filter((t) => t !== term)].slice(0, 5);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Toggle on Ctrl/Cmd + K, close on ESC.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Reset + focus when opened.
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Filtered results (max 10).
  const results = useMemo(() => {
    const allItems = [...NAV_ITEMS, ...storyItems];
    const q = query.trim().toLowerCase();
    if (!q) return [] as CommandItem[];
    return allItems
      .filter((it) =>
        `${it.title} ${it.subtitle ?? ""} ${it.keywords}`
          .toLowerCase()
          .includes(q)
      )
      .slice(0, 10);
  }, [query, storyItems]);

  // Keep active index in range.
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const go = useCallback(
    (item: CommandItem) => {
      pushRecent(query || item.title);
      setOpen(false);
      router.push(item.href);
    },
    [pushRecent, query, router]
  );

  function onListKey(e: React.KeyboardEvent) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) go(item);
    }
  }

  // Scroll active item into view.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-idx="${activeIndex}"]`
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4 bg-navy/20"
          onMouseDown={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-xl bg-white border border-border rounded-card shadow-card overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onListKey}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
              <Search size={18} className="text-muted flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search stories, tests, changes, coverage…"
                className="flex-1 text-sm text-navy placeholder:text-muted focus:outline-none bg-transparent"
              />
              <kbd className="text-[10px] font-semibold text-muted border border-border rounded px-1.5 py-0.5">
                ESC
              </kbd>
            </div>

            {/* Body */}
            <div ref={listRef} className="max-h-[360px] overflow-y-auto">
              {/* Recent searches (no query) */}
              {!query && (
                <div className="py-2">
                  {recent.length > 0 ? (
                    <>
                      <p className="px-4 py-1.5 text-[11px] font-semibold text-muted uppercase tracking-wide">
                        Recent searches
                      </p>
                      {recent.map((term) => (
                        <button
                          key={term}
                          type="button"
                          onClick={() => setQuery(term)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-gray-50 transition-colors"
                        >
                          <Clock size={15} className="text-muted flex-shrink-0" />
                          <span className="text-sm text-navy">{term}</span>
                        </button>
                      ))}
                    </>
                  ) : (
                    <p className="px-4 py-6 text-center text-sm text-muted">
                      Start typing to search across Stories, Tests, Changes and
                      Coverage.
                    </p>
                  )}
                </div>
              )}

              {/* Story fetch error warning */}
              {storyFetchError && (
                <p className=”px-4 py-2 text-xs text-warning bg-[#FFFBEB] border-b border-[#FCD34D]”>
                  ⚠ Could not load stories — navigation only
                </p>
              )}

              {/* Results */}
              {query && results.length === 0 && (
                <p className=”px-4 py-6 text-center text-sm text-muted”>
                  No results for &quot;{query}&quot;.
                </p>
              )}

              {query &&
                results.map((item, i) => {
                  const Icon = KIND_META[item.kind].icon;
                  const active = i === activeIndex;
                  return (
                    <button
                      key={item.id}
                      data-idx={i}
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(item)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        active ? "bg-surface-pink" : "hover:bg-gray-50"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded flex items-center justify-center flex-shrink-0 ${
                          active
                            ? "bg-white text-pink"
                            : "bg-gray-100 text-muted"
                        }`}
                      >
                        <Icon size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-navy truncate">
                          {item.title}
                        </p>
                        {item.subtitle && (
                          <p className="text-[11px] text-muted truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-muted bg-gray-100 px-1.5 py-0.5 rounded flex-shrink-0">
                        {KIND_META[item.kind].label}
                      </span>
                      {active && (
                        <CornerDownLeft size={14} className="text-pink flex-shrink-0" />
                      )}
                    </button>
                  );
                })}
            </div>

            {/* Footer hint */}
            <div className="flex items-center gap-4 px-4 h-9 border-t border-border bg-gray-50 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <ArrowUp size={11} />
                <ArrowDown size={11} />
                navigate
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft size={11} />
                open
              </span>
              <span className="flex items-center gap-1">
                <kbd className="border border-border rounded px-1 bg-white">esc</kbd>
                close
              </span>
              <span className="ml-auto flex items-center gap-1">
                <kbd className="border border-border rounded px-1 bg-white">⌘</kbd>
                <kbd className="border border-border rounded px-1 bg-white">K</kbd>
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
