"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft,
  TestTube2,
  Zap,
  FileText,
  PieChart,
  type LucideIcon,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { Story as SeedStory, TestCase as SeedTestCase, CoverageGap, ImpactedTest } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { StatusChip } from "@/components/ui/StatusChip";
import { InlineTooltip } from "@/components/ui/InlineTooltip";
import { duration, easeStandard } from "@/lib/motion";
import { useProject } from "@/contexts/ProjectContext";
import { PageLayout, PageHeader, PageActions } from "@/components/layout/PageLayout";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { StoryActions } from "./StoryActions";
import { Skeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import { invalidateStories } from "@/lib/storiesStore";
import { useCopilotPageContext } from "@/lib/copilotContext";
import type { TestCase as DomainTestCase } from "@/types/domain";

// Tabs — lazy-loaded so only the active tab's bundle is fetched.
const TabFallback = () => (
  <div className="p-6 space-y-4">
    <Skeleton className="h-7 w-1/3" />
    <Skeleton className="h-40 w-full rounded-card" />
    <Skeleton className="h-32 w-full rounded-card" />
  </div>
);
const OverviewTab = dynamic(() => import("./tabs/OverviewTab").then((m) => m.OverviewTab), { loading: TabFallback });
const TestsTab = dynamic(() => import("./tabs/TestsTab").then((m) => m.TestsTab), { loading: TabFallback });
const CoverageTab = dynamic(() => import("./tabs/CoverageTab").then((m) => m.CoverageTab), { loading: TabFallback });
const ImpactTab = dynamic(() => import("./tabs/ImpactTab").then((m) => m.ImpactTab), { loading: TabFallback });

type Tab = "overview" | "tests" | "coverage" | "impact";

const TABS: { id: Tab; label: string; icon: LucideIcon; description: string }[] = [
  { id: "overview", label: "Overview", icon: FileText,  description: "Story content, quality analysis, and AI insights" },
  { id: "tests",    label: "Tests",    icon: TestTube2,  description: "View, approve, and manage generated test cases" },
  { id: "coverage", label: "Coverage", icon: PieChart,   description: "See which requirements have test coverage" },
  { id: "impact",   label: "Impact",   icon: Zap,        description: "Detect how this story affects other tests" },
];

/* ─── Secondary contextual sidebar (Story navigation) ─── */
function StorySidebar({
  active,
  onSelect,
}: {
  active: Tab;
  onSelect: (id: Tab) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const expanded = hovered;

  return (
    <motion.nav
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      animate={{ width: expanded ? 180 : 56 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex-shrink-0 sticky top-0 self-start h-full bg-white border-r border-border overflow-hidden py-3 px-2"
    >
      <ul className="space-y-0.5">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <li key={tab.id} className="relative">
              {isActive && (
                <motion.div
                  layoutId="story-nav-active"
                  className="absolute inset-0 bg-surface-pink rounded-lg"
                  style={{ borderLeft: "3px solid var(--color-brand-primary)" }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                title={tab.description}
                className={`relative w-full flex items-center gap-3 px-3 h-10 rounded-lg text-sm font-medium transition-colors duration-100 ${
                  isActive ? "text-navy" : "text-muted hover:bg-gray-50 hover:text-navy"
                }`}
              >
                <Icon
                  size={18}
                  className="flex-shrink-0"
                  style={isActive ? { color: "var(--color-brand-primary)" } : {}}
                />
                <motion.span
                  animate={{ opacity: expanded ? 1 : 0 }}
                  transition={{ duration: 0.15 }}
                  className="whitespace-nowrap"
                >
                  {tab.label}
                </motion.span>
              </button>
            </li>
          );
        })}
      </ul>
    </motion.nav>
  );
}

export default function StoryWorkspacePage({ params }: { params: { id: string } }) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const { fullscreen } = useFullscreen();
  const { selectedProject } = useProject();
  const storyId = params.id;

  const [story, setStory] = useState<SeedStory | null>(null);
  const [domainTestCases, setDomainTestCases] = useState<DomainTestCase[]>([]);
  const [storyTests, setStoryTests] = useState<SeedTestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const storyGaps: CoverageGap[] = [];

  // Inject page context into the Copilot so it knows what's on screen
  useCopilotPageContext({
    pageType: "story_detail",
    storyId,
    storyTitle: story?.title,
    storyContent: story?.content,
    testCount: story?.testCount,
    impactCount: story?.impactCount,
    qualityScore: story?.qualityScore,
    projectName: selectedProject?.name,
    testCases: storyTests.slice(0, 20).map(t => ({
      id: t.id, title: t.title, priority: t.priority, status: t.status, steps: t.steps,
    })),
  });

  // Derive project ID: URL param > ProjectContext > "default"
  const projectId =
    (typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("project_id")
      : null) ??
    selectedProject?.id ??
    "default";

  // Track generating state — true when arriving from wizard OR when testCount is 0
  const arrivedAnalyzing =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("analyzing") === "true";
  const [isGenerating, setIsGenerating] = useState(arrivedAnalyzing);
  const isAnalyzing = isGenerating || (story !== null && story.testCount === 0);

  // Version history state
  const [versions, setVersions] = useState<Array<{ version_number: number; description: string | null; created_on: string }>>([]);
  const [versionRegenerating, setVersionRegenerating] = useState(false);
  const [newVersionLabel, setNewVersionLabel] = useState<string | null>(null);
  const [regenProgress, setRegenProgress] = useState(0);

  // Version picker: null = latest (current), number = specific historical version
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [versionSnapshot, setVersionSnapshot] = useState<{
    story_content: string;
    story_description: string;
    test_cases: any[];
    test_case_count: number;
    version_number: number;
    is_latest: boolean;
  } | null>(null);
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  // Derived: the test cases shown depend on selectedVersion
  // When null (latest), use real-time storyTests; when a version, use snapshot TCs
  const displayedTests: SeedTestCase[] = selectedVersion !== null && versionSnapshot
    ? versionSnapshot.test_cases.map((t: any) => ({
        id: t.id, storyId,
        title: t.title,
        type: inferCategory(t.title),
        priority: (t.priority === "High" ? "P1" : t.priority === "Low" ? "P3" : t.priority === "P1" ? "P1" : t.priority === "P3" ? "P3" : "P2") as any,
        status: (t.status as any) ?? "Pending",
        steps: t.steps ?? [],
        expectedResult: t.expected_result ?? t.expectedResult ?? '',
        group: t.group,
        version: t.version,
      }))
    : storyTests;

  // Story content shown in Overview — from snapshot when viewing old version
  const displayedContent = selectedVersion !== null && versionSnapshot
    ? versionSnapshot.story_content
    : story?.content ?? '';

  function inferCategory(title: string): SeedTestCase["type"] {
    const t = title.toLowerCase();
    if (/\b(security|auth|inject|xss|csrf|permission|token|bypass)\b/.test(t)) return "Security";
    if (/\b(boundary|limit|max|min|overflow|empty|null|zero|exceed)\b/.test(t)) return "Boundary";
    if (/\b(invalid|fail|error|reject|wrong|missing|incorrect|denied)\b/.test(t)) return "Negative";
    if (/\b(performance|load|throughput|timeout|latency)\b/.test(t)) return "Performance";
    return "Functional";
  }

  const handleUpdate = useCallback((updated: any) => {
    const seed = domainStoryToSeed(updated);
    setStory(seed);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([api.getStory(storyId), api.getTestCases(storyId)])
      .then(([s, tc]) => {
        if (!cancelled) {
          setStory(domainStoryToSeed(s));
          setDomainTestCases(tc.testCases);
          setStoryTests(tc.testCases.map((t: DomainTestCase) => ({
            id: t.id, storyId,
            title: t.title,
            type: inferCategory(t.title),
            priority: t.priority === "High" ? "P1" : t.priority === "Low" ? "P3" : "P2",
            status: "Approved" as const,
            steps: t.steps,
            expectedResult: t.expectedResult,
            version: t.version,
          })));
          setLoading(false);
        }
      })
      .catch(() => { if (!cancelled) setLoading(false); });
    // Fetch version history for the version chips
    api.getStoryVersions(storyId)
      .then((data) => { if (!cancelled) setVersions(data.versions ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [storyId]);

  // When user selects a version from the picker, fetch that version's snapshot
  useEffect(() => {
    if (selectedVersion === null) {
      setVersionSnapshot(null);
      return;
    }
    let cancelled = false;
    setSnapshotLoading(true);
    api.getVersionSnapshot(storyId, selectedVersion)
      .then((snap) => {
        if (!cancelled) setVersionSnapshot(snap);
      })
      .catch(() => {
        if (!cancelled) setVersionSnapshot(null);
      })
      .finally(() => { if (!cancelled) setSnapshotLoading(false); });
    return () => { cancelled = true; };
  }, [storyId, selectedVersion]);

  // Animate regenProgress from 0→85 while versionRegenerating (never reaches 100 until polling confirms)
  useEffect(() => {
    if (!versionRegenerating) { setRegenProgress(0); return; }
    setRegenProgress(5);
    const interval = setInterval(() => {
      setRegenProgress(prev => prev < 85 ? prev + Math.random() * 6 : prev);
    }, 2500);
    return () => clearInterval(interval);
  }, [versionRegenerating]);

  // Polling — runs until test cases appear, then keeps going until impact settles
  useEffect(() => {
    if (loading) return;
    // Only skip polling if story is fully settled:
    // tests exist AND impact has been checked (impactCount >= 0 and we've polled at least once)
    if (!arrivedAnalyzing && (story?.testCount ?? 0) > 0 && story?.impactCount !== undefined) return;

    let stopped = false;
    let attempts = 0;
    let testsFound = (story?.testCount ?? 0) > 0;
    // Poll up to 2 min when generating, 90s when just checking impact
    const MAX = testsFound ? 23 : 30; // 23×4s≈92s or 30×4s=2min

    const interval = setInterval(async () => {
      if (stopped || attempts++ >= MAX) {
        clearInterval(interval);
        setIsGenerating(false);
        return;
      }
      try {
        const [s, tc] = await Promise.all([api.getStory(storyId), api.getTestCases(storyId)]);
        const seed = domainStoryToSeed(s);
        setStory(seed);
        setDomainTestCases(tc.testCases);
        setStoryTests(tc.testCases.map((t: DomainTestCase) => ({
          id: t.id, storyId,
          title: t.title,
          type: inferCategory(t.title),
          priority: t.priority === "High" ? "P1" : t.priority === "Low" ? "P3" : "P2",
          status: "Approved" as const,
          steps: t.steps,
          expectedResult: t.expectedResult,
          group: t.group,
          version: t.version,
        })));

        if (s.testCaseCount > 0) {
          testsFound = true;
          setIsGenerating(false);
          if (versionRegenerating) {
            setVersionRegenerating(false);
            setRegenProgress(100);
            // Refresh version list now that a new version exists
            api.getStoryVersions(storyId).then((data) => setVersions(data.versions ?? [])).catch(() => {});
          }
          invalidateStories();
        }

        // Stop once tests exist — impact analysis keeps running server-side,
        // we'll catch the final count on the next few polls
        if (testsFound && attempts > 3) {
          clearInterval(interval);
        }
      } catch { /* keep polling silently */ }
    }, 4000);

    return () => { stopped = true; clearInterval(interval); };
  }, [storyId, loading, arrivedAnalyzing, versionRegenerating]);

  // Called by StoryActions when upload-new-version succeeds
  const handleVersionUploaded = useCallback((versionNumber?: number) => {
    setVersionRegenerating(true);
    setIsGenerating(true);
    setSelectedVersion(null); // always return to current view when new version uploaded
    setVersionSnapshot(null);
    if (versionNumber) setNewVersionLabel(`v${versionNumber}`);
    api.getStoryVersions(storyId).then((data) => setVersions(data.versions ?? [])).catch(() => {});
  }, [storyId]);

  if (loading) {
    return (
      <PageLayout>
        <div className="flex h-full items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-muted" />
        </div>
      </PageLayout>
    );
  }

  if (!story) {
    return (
      <PageLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4 py-24">
          <p className="text-lg font-semibold text-navy">Story not found</p>
          <a href="/stories" className="text-sm text-cyan hover:underline">Back to Stories</a>
        </div>
      </PageLayout>
    );
  }

  // Breadcrumb: use active project name
  const owningProject = selectedProject;

  return (
    <PageLayout>
      <PageHeader
        title={
          <span className="flex items-baseline gap-2 min-w-0">
            <span className="text-[13px] font-semibold text-cyan flex-shrink-0">{story.id}</span>
            <span className="truncate">{story.title}</span>
          </span>
        }
        leading={
          <Link href="/stories" className="text-muted hover:text-navy transition-colors flex-shrink-0">
            <ArrowLeft size={20} />
          </Link>
        }
        subtitle={
          <span className="flex items-center gap-1.5">
            <Link href="/stories" className="hover:text-navy transition-colors">Projects</Link>
            {owningProject && (
              <>
                <span>/</span>
                <span className="text-navy font-medium">{owningProject?.name ?? owningProject?.id}</span>
              </>
            )}
            <span>/</span>
            <span className="truncate">{story.title}</span>
          </span>
        }
        actions={<PageActions fullscreen />}
      />

      {/* Workspace header — metadata + actions (title lives in PageHeader).
          Hidden in Full Screen Reading Mode. */}
      {!fullscreen && (
      <div className="bg-white border-b border-border">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-5 lg:px-6 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Stats row */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CoverageRing coverage={story.coverage} size={40} strokeWidth={4} />
              <span className="text-sm font-semibold text-navy">{story.coverage}% Coverage</span>
              <InlineTooltip content="What % of this story's requirements have test cases. Click the Coverage tab to see which requirements are missing coverage." />
            </div>
            <span className="text-border">|</span>
            <div className="flex items-center gap-1.5 text-sm text-muted">
              {(story.testCount === 0 || isAnalyzing) && selectedVersion === null ? (
                <><Loader2 size={14} className="animate-spin text-pink" /><span className="text-pink font-medium">Generating…</span></>
              ) : selectedVersion !== null && snapshotLoading ? (
                <><Loader2 size={14} className="animate-spin" /><span>Loading v{selectedVersion}…</span></>
              ) : selectedVersion !== null && versionSnapshot ? (
                <><TestTube2 size={14} /><span>{versionSnapshot.test_case_count} Tests (v{selectedVersion})</span></>
              ) : (
                <><TestTube2 size={14} /><span>{story.testCount} Tests</span></>
              )}
            </div>
            <span className="text-border">|</span>
            <div className={`flex items-center gap-1.5 text-sm font-medium ${story.impactCount > 0 ? "text-pink" : "text-muted"}`}>
              <Zap size={14} />
              <span>Impact: {story.impactCount}</span>
              <InlineTooltip content="Number of test cases in OTHER stories that may need updating because of this story. 0 means no cross-story impact detected." />
            </div>
            {story.pageUrl && (
              <>
                <span className="text-border">|</span>
                <a
                  href={story.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-cyan hover:text-cyan/80 transition-colors"
                  title={story.pageUrl}
                >
                  <ExternalLink size={14} />
                  <span className="max-w-[180px] truncate">{story.pageUrl.replace(/^https?:\/\//, '')}</span>
                </a>
              </>
            )}
            <span className="text-border">|</span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">Updated {story.lastUpdated}</span>
              <StatusChip status={
                (story.testCount === 0 || isAnalyzing)
                  ? "Analyzing"
                  : story.impactCount > 0
                  ? "Impact Detected"
                  : "Ready"
              } title={
                (story.testCount === 0 || isAnalyzing)
                  ? "AI is generating test cases — this takes 30-60 seconds"
                  : story.impactCount > 0
                  ? "Impact detected — test cases in other stories may need updating"
                  : "Test cases have been generated and are ready to review"
              } />
            </div>
          </div>

          {/* Actions */}
          <StoryActions story={story} onVersionUploaded={handleVersionUploaded} />
        </div>

        {/* Version picker + regeneration progress banner */}
        {(versions.length > 0 || versionRegenerating) && (
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            {/* Version picker dropdown */}
            {versions.length > 0 && !versionRegenerating && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-medium">Viewing:</span>
                <div className="relative">
                  <select
                    value={selectedVersion === null ? 'latest' : String(selectedVersion)}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedVersion(val === 'latest' ? null : Number(val));
                    }}
                    className="h-7 pl-2.5 pr-7 text-[12px] font-semibold border border-pink/40 rounded-btn bg-pink/5 text-pink appearance-none cursor-pointer focus:outline-none focus:border-pink transition-colors"
                  >
                    <option value="latest">Current (latest)</option>
                    {[...versions]
                      .sort((a, b) => b.version_number - a.version_number)
                      .map((v) => (
                        <option key={v.version_number} value={String(v.version_number)}>
                          v{v.version_number} — {v.description ? v.description.slice(0, 30) : 'No description'}{v.created_on ? ` (${new Date(v.created_on).toLocaleDateString()})` : ''}
                        </option>
                      ))}
                  </select>
                  <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-pink"><path d="M2 3.5L5 6.5L8 3.5"/></svg>
                  </div>
                </div>
                {selectedVersion !== null && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#92400E] border border-[#FCD34D] font-semibold">
                      Viewing v{selectedVersion} — read-only snapshot
                    </span>
                    <button
                      onClick={() => setSelectedVersion(null)}
                      className="text-[11px] text-muted hover:text-navy underline"
                    >
                      Back to current
                    </button>
                  </div>
                )}
                {snapshotLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <Loader2 size={11} className="animate-spin" /> Loading snapshot…
                  </span>
                )}
              </div>
            )}
            {/* Regeneration progress bar */}
            {versionRegenerating && (
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] border border-[#93C5FD] flex items-center gap-1">
                  <Loader2 size={9} className="animate-spin" />
                  {newVersionLabel ?? 'New'} generating…
                </span>
                <div className="w-40">
                  <div className="h-1.5 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-pink rounded-full transition-all duration-[2500ms] ease-out"
                      style={{ width: `${regenProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-muted mt-0.5">Regenerating test cases…</p>
                </div>
              </div>
            )}
          </div>
        )}
        </div>
      </div>
      )}

      {/* Story workspace: secondary sidebar + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Secondary contextual sidebar (Story navigation) — hidden in fullscreen. */}
        {!fullscreen && <StorySidebar active={activeTab} onSelect={setActiveTab} />}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto">
          {/* Minimal tab strip so reading mode stays navigable (secondary sidebar is hidden). */}
          {fullscreen && (
            <div className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-border">
              <div className="mx-auto w-full max-w-[1600px] px-6 flex items-center gap-1 h-11">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      title={tab.description}
                      className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-btn text-sm font-medium transition-colors ${
                        isActive ? "bg-surface-pink text-pink" : "text-muted hover:text-navy hover:bg-gray-50"
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mx-auto w-full max-w-[1600px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: duration.fast, ease: easeStandard }}
              >
                {activeTab === "overview" && (
                  <OverviewTab
                    story={selectedVersion !== null && versionSnapshot
                      ? { ...story, content: versionSnapshot.story_content, title: versionSnapshot.story_description || story.title }
                      : story
                    }
                  />
                )}
                {activeTab === "tests" && (
                  snapshotLoading ? (
                    <div className="flex items-center justify-center py-24 gap-2 text-muted text-sm">
                      <Loader2 size={20} className="animate-spin" /> Loading v{selectedVersion} test cases…
                    </div>
                  ) : (story.testCount === 0 || isAnalyzing) && selectedVersion === null ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
                      <div className="w-14 h-14 rounded-full bg-surface-pink flex items-center justify-center">
                        <Loader2 size={28} className="text-pink animate-spin" />
                      </div>
                      <p className="text-base font-semibold text-navy">Generating test cases…</p>
                      <p className="text-sm text-muted max-w-xs">Our AI is writing test cases for this story. This usually takes 15–30 seconds.</p>
                    </div>
                  ) : (
                    <TestsTab tests={displayedTests} storyId={storyId} readOnly={selectedVersion !== null} />
                  )
                )}
                {activeTab === "coverage" && (
                  <CoverageTab
                    story={story}
                    gaps={storyGaps}
                    realTests={selectedVersion !== null && versionSnapshot
                      ? versionSnapshot.test_cases.map((t: any) => ({
                          id: t.id, title: t.title,
                          priority: t.priority ?? 'Medium',
                          steps: t.steps ?? [],
                          expectedResult: t.expected_result ?? t.expectedResult ?? '',
                          status: t.status,
                        }))
                      : domainTestCases}
                  />
                )}
                {activeTab === "impact" && (
                  <ImpactTab storyId={storyId} projectId={projectId} versionFilter={selectedVersion} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
