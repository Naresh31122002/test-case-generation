/**
 * Activity infrastructure — reusable service for notifications / activity feed.
 *
 * Mock-backed today, API-ready tomorrow: every consumer goes through
 * `activityService.list()`, so swapping the mock for a real endpoint is a
 * one-method change (see `ApiActivityService` stub below).
 */

export type ActivityType =
  | "story_uploaded"
  | "tests_generated"
  | "export_completed"
  | "impact_detected"
  | "change_approved";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  /** Epoch ms — used for grouping + relative time. */
  timestamp: number;
  read: boolean;
  /** Optional deep link into the app. */
  href?: string;
  /** Project this activity belongs to (for future scoping). */
  projectId?: string;
}

/** UI metadata per activity type (label only — icons live in the component). */
export const ACTIVITY_META: Record<ActivityType, { label: string }> = {
  story_uploaded: { label: "Story Uploaded" },
  tests_generated: { label: "Tests Generated" },
  export_completed: { label: "Export Completed" },
  impact_detected: { label: "Impact Detected" },
  change_approved: { label: "Change Approved" },
};

/* ---------------- Time grouping ---------------- */

export type ActivitySection = "Today" | "Yesterday" | "This Week" | "Earlier";

const SECTION_ORDER: ActivitySection[] = [
  "Today",
  "Yesterday",
  "This Week",
  "Earlier",
];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function sectionFor(timestamp: number, now = Date.now()): ActivitySection {
  const today = startOfDay(new Date(now));
  const yesterday = today - 24 * 60 * 60 * 1000;
  const weekAgo = today - 7 * 24 * 60 * 60 * 1000;

  if (timestamp >= today) return "Today";
  if (timestamp >= yesterday) return "Yesterday";
  if (timestamp >= weekAgo) return "This Week";
  return "Earlier";
}

/** Relative "time ago" string. */
export function timeAgo(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export interface GroupedActivity {
  section: ActivitySection;
  items: Activity[];
}

/** Group a flat activity list into ordered sections, newest first within each. */
export function groupBySection(
  activities: Activity[],
  now = Date.now()
): GroupedActivity[] {
  const buckets = new Map<ActivitySection, Activity[]>();
  for (const a of activities) {
    const section = sectionFor(a.timestamp, now);
    if (!buckets.has(section)) buckets.set(section, []);
    buckets.get(section)!.push(a);
  }
  return SECTION_ORDER.filter((s) => buckets.has(s)).map((section) => ({
    section,
    items: buckets
      .get(section)!
      .sort((a, b) => b.timestamp - a.timestamp),
  }));
}

/* ---------------- Mock data ---------------- */

const H = 60 * 60 * 1000;
const D = 24 * H;

function mockActivities(now = Date.now()): Activity[] {
  return [
    {
      id: "act-1",
      type: "impact_detected",
      title: "Impact detected on AUTH-010",
      detail: "18 tests may break from OAuth changes",
      timestamp: now - 2 * H,
      read: false,
      href: "/stories/AUTH-010",
    },
    {
      id: "act-2",
      type: "tests_generated",
      title: "23 tests generated",
      detail: "LOGIN-001 — Email and Password Login",
      timestamp: now - 5 * H,
      read: false,
      href: "/stories/LOGIN-001",
    },
    {
      id: "act-3",
      type: "story_uploaded",
      title: "New story uploaded",
      detail: "PROFILE-003 — User Settings & Profile",
      timestamp: now - 9 * H,
      read: true,
      href: "/stories/PROFILE-003",
    },
    {
      id: "act-4",
      type: "change_approved",
      title: "Change request approved",
      detail: "AUTH-003 — Password Reset Flow",
      timestamp: now - 1 * D - 3 * H,
      read: false,
      href: "/changes/CR-002",
    },
    {
      id: "act-5",
      type: "export_completed",
      title: "Export completed",
      detail: "12 stories exported as Playwright",
      timestamp: now - 1 * D - 6 * H,
      read: true,
      href: "/exports",
    },
    {
      id: "act-6",
      type: "tests_generated",
      title: "14 tests generated",
      detail: "AUTH-003 — Password Reset Flow",
      timestamp: now - 3 * D,
      read: true,
      href: "/stories/AUTH-003",
    },
    {
      id: "act-7",
      type: "impact_detected",
      title: "Impact detected on LOGIN-001",
      detail: "5 tests flagged after MFA requirement",
      timestamp: now - 5 * D,
      read: true,
      href: "/stories/LOGIN-001",
    },
  ];
}

/* ---------------- Service ---------------- */

export interface ActivityService {
  list(): Promise<Activity[]>;
  markAllRead(): Promise<void>;
  markRead(id: string, read: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  clearAll(): Promise<void>;
}

/** Mock implementation — in-memory, deterministic relative to "now". */
class MockActivityService implements ActivityService {
  private cache: Activity[] | null = null;

  async list(): Promise<Activity[]> {
    if (!this.cache) this.cache = mockActivities();
    // Simulate async fetch latency.
    return new Promise((resolve) =>
      setTimeout(() => resolve(this.cache!), 120)
    );
  }

  async markAllRead(): Promise<void> {
    if (this.cache) this.cache = this.cache.map((a) => ({ ...a, read: true }));
  }

  async markRead(id: string, read: boolean): Promise<void> {
    if (this.cache)
      this.cache = this.cache.map((a) => (a.id === id ? { ...a, read } : a));
  }

  async remove(id: string): Promise<void> {
    if (this.cache) this.cache = this.cache.filter((a) => a.id !== id);
  }

  async clearAll(): Promise<void> {
    this.cache = [];
  }
}

/**
 * Future API implementation (stub). Swap `activityService` to this once a
 * backend exists — no consumer changes required.
 *
 * class ApiActivityService implements ActivityService {
 *   async list() {
 *     const res = await fetch("/api/activity");
 *     return res.json() as Promise<Activity[]>;
 *   }
 *   async markAllRead() {
 *     await fetch("/api/activity/read", { method: "POST" });
 *   }
 *   async markRead(id: string, read: boolean) {
 *     await fetch(`/api/activity/${id}/read`, { method: "PATCH", body: JSON.stringify({ read }) });
 *   }
 *   async remove(id: string) {
 *     await fetch(`/api/activity/${id}`, { method: "DELETE" });
 *   }
 *   async clearAll() {
 *     await fetch("/api/activity", { method: "DELETE" });
 *   }
 * }
 */

export const activityService: ActivityService = new MockActivityService();
