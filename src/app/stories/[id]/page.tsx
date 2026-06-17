"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Upload, RefreshCw, GitCompare, Download, TestTube2, Zap } from "lucide-react";
import { stories, testCases, coverageGaps, impactedTests } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { StatusChip } from "@/components/ui/StatusChip";
import { fadeIn, duration, easeStandard } from "@/lib/motion";

// Tabs
import { OverviewTab } from "./tabs/OverviewTab";
import { TestsTab } from "./tabs/TestsTab";
import { CoverageTab } from "./tabs/CoverageTab";
import { ImpactTab } from "./tabs/ImpactTab";
import { ExportTab } from "./tabs/ExportTab";

type Tab = "overview" | "tests" | "coverage" | "impact" | "export";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "tests", label: "Tests" },
  { id: "coverage", label: "Coverage" },
  { id: "impact", label: "Impact" },
  { id: "export", label: "Export" },
];

export default function StoryWorkspacePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const story = stories.find((s) => s.id === params.id) ?? stories[0];
  const storyTests = testCases.filter((t) => t.storyId === story.id);
  const storyGaps = coverageGaps.filter((g) => g.storyId === story.id);
  const storyImpact = impactedTests.filter((t) => t.storyId === story.id);

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-border h-16 flex items-center px-8 gap-4">
        <Link href="/stories" className="text-muted hover:text-navy transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-navy">{story.title}</h1>
      </div>

      {/* Workspace header */}
      <div className="sticky top-16 z-10 bg-white border-b border-border px-8 py-5">
        <div className="flex items-start justify-between gap-4">
          {/* Left: id + title */}
          <div>
            <span className="text-[13px] font-semibold text-cyan block mb-1">{story.id}</span>
            <h2 className="text-[22px] font-bold text-navy">{story.title}</h2>
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="h-9 px-3 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Upload size={14} />
              Upload New Version
            </button>
            <button className="h-9 px-3 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2">
              <RefreshCw size={14} />
              Generate Tests
            </button>
            <button className="h-9 px-3 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2">
              <GitCompare size={14} />
              Compare
            </button>
            <button className="h-9 px-3 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2">
              <Download size={14} />
              Export
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-2">
            <CoverageRing coverage={story.coverage} size={40} strokeWidth={4} />
            <span className="text-sm font-semibold text-navy">{story.coverage}% Coverage</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1.5 text-sm text-muted">
            <TestTube2 size={14} />
            <span>{story.testCount} Tests</span>
          </div>
          <span className="text-border">|</span>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${story.impactCount > 0 ? "text-pink" : "text-muted"}`}>
            <Zap size={14} />
            <span>Impact: {story.impactCount}</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">{story.version} · Updated {story.lastUpdated}</span>
            <StatusChip status={story.status} />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 mt-4 border-b border-border -mb-px">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-5 py-3.5 text-sm font-medium transition-colors ${
                activeTab === tab.id ? "text-navy" : "text-muted hover:text-navy"
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div
                  layoutId="tab-underline"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: duration.fast, ease: easeStandard }}
          >
            {activeTab === "overview" && <OverviewTab story={story} />}
            {activeTab === "tests" && <TestsTab tests={storyTests} />}
            {activeTab === "coverage" && <CoverageTab story={story} gaps={storyGaps} />}
            {activeTab === "impact" && <ImpactTab impacts={storyImpact} />}
            {activeTab === "export" && <ExportTab story={story} testCount={story.testCount} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
