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
  body: string;
  detail: string;
  createdAt: number;
  timestamp: number;
  read: boolean;
  href?: string;
}

const now = Date.now();
let items: Activity[] = [
  {
    id: "act-1",
    type: "story_uploaded",
    title: "Story uploaded",
    body: "A new requirement was added to the demo project.",
    detail: "A new requirement was added to the demo project.",
    createdAt: now - 30 * 60 * 1000,
    timestamp: now - 30 * 60 * 1000,
    read: false,
    href: "/stories",
  },
  {
    id: "act-2",
    type: "tests_generated",
    title: "Tests generated",
    body: "AI generated a new test pack for PROJ-101.",
    detail: "AI generated a new test pack for PROJ-101.",
    createdAt: now - 3 * 60 * 60 * 1000,
    timestamp: now - 3 * 60 * 60 * 1000,
    read: true,
    href: "/stories/PROJ-101",
  },
];

export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.max(1, Math.round(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function groupBySection(activity: Activity[]): { section: string; items: Activity[] }[] {
  const unread = activity.filter((item) => !item.read);
  const read = activity.filter((item) => item.read);
  return [
    unread.length ? { section: "Unread", items: unread } : null,
    read.length ? { section: "Earlier", items: read } : null,
  ].filter((group): group is { section: string; items: Activity[] } => Boolean(group));
}

export const activityService = {
  async list(): Promise<Activity[]> {
    return items;
  },
  async markAllRead(): Promise<void> {
    items = items.map((item) => ({ ...item, read: true }));
  },
  async markRead(id: string, read = true): Promise<void> {
    items = items.map((item) => item.id === id ? { ...item, read } : item);
  },
  async remove(id: string): Promise<void> {
    items = items.filter((item) => item.id !== id);
  },
  async clearAll(): Promise<void> {
    items = [];
  },
};
