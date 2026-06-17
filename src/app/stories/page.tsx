"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  BookOpen,
  Search,
  LayoutGrid,
  List,
  TestTube2,
  Zap,
  Plus,
  MoreHorizontal,
  GitCompare,
  Download,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { stories, type Story } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { StatusChip } from "@/components/ui/StatusChip";
import { staggerContainer, fadeInUp, scaleIn } from "@/lib/motion";

type ViewMode = "board" | "list";
type SortKey = "lastUpdated" | "name" | "coverageAsc" | "coverageDesc" | "impactDesc";

export default function StoriesPage() {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("All Types");
  const [sortKey, setSortKey] = useState<SortKey>("lastUpdated");
  const [viewMode, setViewMode] = useState<ViewMode>("board");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = [...stories];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      );
    }
    if (filterType !== "All Types") {
      result = result.filter((s) => s.type === filterType);
    }
    switch (sortKey) {
      case "name":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "coverageAsc":
        result.sort((a, b) => a.coverage - b.coverage);
        break;
      case "coverageDesc":
        result.sort((a, b) => b.coverage - a.coverage);
        break;
      case "impactDesc":
        result.sort((a, b) => b.impactCount - a.impactCount);
        break;
    }
    return result;
  }, [search, filterType, sortKey]);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-border h-16 flex items-center justify-between px-8">
        <h1 className="text-2xl font-semibold text-navy">Stories</h1>
        <Link
          href="/stories/new"
          className="inline-flex items-center gap-2 bg-pink text-white text-sm font-medium px-4 h-9 rounded-btn hover:bg-[#e0005f] transition-colors"
        >
          <Plus size={16} />
          New Story
        </Link>
      </div>

      {/* Page content */}
      <div className="flex-1 px-8 py-8 max-w-content mx-auto w-full">
        {/* Toolbar */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative w-[280px]">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              placeholder="Search stories…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 h-9 text-sm border border-border rounded-btn bg-white text-navy placeholder:text-muted focus:outline-none focus:border-cyan focus:ring-1 focus:ring-cyan/30 transition-colors"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option>All Types</option>
            <option>Functional</option>
            <option>OAuth</option>
            <option>Security</option>
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-9 px-3 text-sm border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
          >
            <option value="lastUpdated">Last Updated</option>
            <option value="name">Name A–Z</option>
            <option value="coverageDesc">Coverage ↑</option>
            <option value="coverageAsc">Coverage ↓</option>
            <option value="impactDesc">Impact ↑</option>
          </select>

          <div className="ml-auto flex items-center border border-border rounded-btn overflow-hidden">
            <button
              onClick={() => setViewMode("board")}
              className={`w-9 h-9 flex items-center justify-center transition-colors ${
                viewMode === "board" ? "bg-surface-pink text-pink" : "bg-white text-muted hover:text-navy"
              }`}
              title="Board view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`w-9 h-9 flex items-center justify-center transition-colors ${
                viewMode === "list" ? "bg-surface-pink text-pink" : "bg-white text-muted hover:text-navy"
              }`}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          {filtered.length === 0 ? (
            <EmptyState key="empty" hasSearch={!!search} />
          ) : viewMode === "board" ? (
            <BoardView key={`board-${filterType}-${sortKey}`} stories={filtered} />
          ) : (
            <ListView
              key={`list-${filterType}-${sortKey}`}
              stories={filtered}
              openMenu={openMenu}
              setOpenMenu={setOpenMenu}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <motion.div
      {...fadeInUp}
      className="flex flex-col items-center justify-center py-24 text-center"
    >
      <BookOpen size={48} className="text-muted mb-4" />
      <h2 className="text-h2 text-navy mb-2">
        {hasSearch ? "No stories match your search" : "No stories yet"}
      </h2>
      <p className="text-sm text-muted max-w-sm mb-6">
        {hasSearch
          ? "Try a different search term or clear filters."
          : "Upload a user story, paste requirements, or import from Jira to get started."}
      </p>
      {!hasSearch && (
        <Link
          href="/stories/new"
          className="inline-flex items-center gap-2 bg-pink text-white text-sm font-medium px-4 h-9 rounded-btn hover:bg-[#e0005f] transition-colors"
        >
          <Plus size={16} />
          Create Your First Story
        </Link>
      )}
    </motion.div>
  );
}

function BoardView({ stories }: { stories: Story[] }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
    >
      {stories.map((story) => (
        <StoryCard key={story.id} story={story} />
      ))}
    </motion.div>
  );
}

function StoryCard({ story }: { story: Story }) {
  const [hovered, setHovered] = useState(false);

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -2 }}
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      className="relative bg-white border rounded-card p-5 cursor-pointer overflow-hidden transition-shadow"
      style={{
        borderColor: hovered ? "#06B6D4" : "#E2E8F0",
        boxShadow: hovered ? "0 4px 16px rgba(0,0,0,0.06)" : "none",
      }}
    >
      {/* Row 1: ID + Status */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-cyan">{story.id}</span>
        <StatusChip status={story.status} />
      </div>

      {/* Row 2: Title */}
      <h3 className="text-[15px] font-semibold text-navy line-clamp-2 mb-3 leading-snug">
        {story.title}
      </h3>

      {/* Row 3: Coverage + Tests + Impact */}
      <div className="flex items-center gap-3 mb-3">
        <CoverageRing coverage={story.coverage} size={48} strokeWidth={5} showLabel />
        <div className="flex items-center gap-1 text-xs text-muted">
          <TestTube2 size={13} />
          <span>{story.testCount} Tests</span>
        </div>
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            story.impactCount > 0 ? "text-pink" : "text-muted"
          }`}
        >
          <Zap size={13} />
          <span>Impact: {story.impactCount}</span>
        </div>
      </div>

      {/* Row 4: Last updated */}
      <p className="text-[11px] text-muted">Last updated {story.lastUpdated}</p>

      {/* Hover overlay */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-8"
            style={{
              background:
                "linear-gradient(to top, rgba(255,255,255,1) 70%, rgba(255,255,255,0) 100%)",
            }}
          >
            <div className="flex items-center gap-2">
              <Link
                href={`/stories/${story.id}`}
                className="flex items-center gap-1 text-xs font-medium text-navy hover:text-pink transition-colors px-2 py-1 rounded hover:bg-surface-pink"
              >
                <ExternalLink size={12} />
                Open
              </Link>
              <Link
                href={`/compare?a=${story.id}`}
                className="flex items-center gap-1 text-xs font-medium text-muted hover:text-navy transition-colors px-2 py-1 rounded hover:bg-gray-50"
              >
                <GitCompare size={12} />
                Compare
              </Link>
              <Link
                href={`/exports?story=${story.id}`}
                className="flex items-center gap-1 text-xs font-medium text-muted hover:text-navy transition-colors px-2 py-1 rounded hover:bg-gray-50"
              >
                <Download size={12} />
                Export
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ListView({
  stories,
  openMenu,
  setOpenMenu,
}: {
  stories: Story[];
  openMenu: string | null;
  setOpenMenu: (id: string | null) => void;
}) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="bg-white border border-border rounded-card overflow-hidden"
    >
      {/* Header */}
      <div className="grid grid-cols-[100px_1fr_80px_100px_80px_120px_80px] items-center px-4 py-2.5 border-b border-border bg-gray-50">
        {["Story ID", "Title", "Tests", "Coverage", "Impact", "Last Updated", ""].map(
          (col, i) => (
            <span
              key={i}
              className={`text-[11px] font-semibold text-muted uppercase tracking-wide ${
                i === 2 || i === 3 || i === 4 ? "text-center" : ""
              } ${i === 6 ? "text-right" : ""}`}
            >
              {col}
            </span>
          )
        )}
      </div>

      {stories.map((story, idx) => (
        <motion.div
          key={story.id}
          variants={fadeInUp}
          className={`grid grid-cols-[100px_1fr_80px_100px_80px_120px_80px] items-center px-4 py-3 hover:bg-gray-50 transition-colors ${
            idx < stories.length - 1 ? "border-b border-border" : ""
          }`}
        >
          <span className="text-[11px] font-semibold text-cyan">{story.id}</span>
          <Link
            href={`/stories/${story.id}`}
            className="text-sm font-medium text-navy hover:text-pink truncate pr-4 transition-colors"
          >
            {story.title}
          </Link>
          <span className="text-sm text-muted text-center">{story.testCount}</span>
          <div className="flex items-center justify-center gap-1.5">
            <CoverageRing coverage={story.coverage} size={28} strokeWidth={3} />
            <span className="text-xs font-semibold text-navy">{story.coverage}%</span>
          </div>
          <div className="text-center">
            {story.impactCount > 0 ? (
              <span className="inline-block text-[11px] font-semibold bg-[#FFF0F7] text-pink border border-[#FF0A78] rounded-full px-2 py-0.5">
                {story.impactCount}
              </span>
            ) : (
              <span className="text-sm text-muted">—</span>
            )}
          </div>
          <span className="text-xs text-muted">{story.lastUpdated}</span>
          <div className="relative flex justify-end">
            <button
              onClick={() =>
                setOpenMenu(openMenu === story.id ? null : story.id)
              }
              className="w-8 h-8 flex items-center justify-center rounded text-muted hover:text-navy hover:bg-gray-100 transition-colors"
            >
              <MoreHorizontal size={16} />
            </button>
            {openMenu === story.id && (
              <div className="absolute right-0 top-9 z-20 bg-white border border-border rounded-lg shadow-card py-1 w-36">
                <Link
                  href={`/stories/${story.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  <ExternalLink size={14} />
                  Open
                </Link>
                <Link
                  href={`/compare?a=${story.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  <GitCompare size={14} />
                  Compare
                </Link>
                <Link
                  href={`/exports?story=${story.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
                  onClick={() => setOpenMenu(null)}
                >
                  <Download size={14} />
                  Export
                </Link>
                <div className="my-1 border-t border-border" />
                <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-error hover:bg-[#FEF2F2] transition-colors">
                  <Trash2 size={14} />
                  Delete Story
                </button>
              </div>
            )}
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
