/**
 * Project Management Layer — data model + sample projects.
 *
 * Additive only: this maps EXISTING seed story IDs into projects. It does not
 * modify seed.ts. Filtering helpers let pages scope seed data to a project
 * without rewriting their existing imports.
 */

import { stories, testCases, changeRequests, type Story } from "@/lib/seed";

export interface Project {
  id: string;
  name: string;
  description: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  storyCount: number;
  testCount: number;
  /** Story IDs that belong to this project (maps onto existing seed stories). */
  storyIds: string[];
  /** True when the project has been archived (hidden from active list). */
  archived?: boolean;
}

/* ---- Sample projects (use existing seed stories) ---- */

interface SampleProjectSeed {
  id: string;
  name: string;
  description: string;
  domain: string;
  createdAt: string;
  updatedAt: string;
  storyIds: string[];
}

const SAMPLE_SEEDS: SampleProjectSeed[] = [
  {
    id: "default",
    name: "My Project",
    description: "Default project for uploaded stories.",
    domain: "General",
    createdAt: "2026-01-01",
    updatedAt: "2026-06-18",
    storyIds: [],
  },
  {
    id: "auth-platform",
    name: "Authentication Platform",
    description: "Login, OAuth, registration and password flows.",
    domain: "Authentication",
    createdAt: "2026-01-12",
    updatedAt: "2026-06-15",
    storyIds: ["LOGIN-001", "AUTH-010", "AUTH-002", "AUTH-003"],
  },
  {
    id: "ecommerce-platform",
    name: "E-Commerce Platform",
    description: "Checkout, payments and cart experience.",
    domain: "E-Commerce",
    createdAt: "2026-02-03",
    updatedAt: "2026-06-10",
    storyIds: ["PAYMENT-001"],
  },
  {
    id: "banking-platform",
    name: "Banking Platform",
    description: "Account profiles, settings and secure access.",
    domain: "FinTech",
    createdAt: "2026-03-21",
    updatedAt: "2026-06-08",
    storyIds: ["PROFILE-003"],
  },
];

/** Count tests for a set of story IDs using existing seed data. */
export function countTestsForStories(storyIds: string[]): number {
  const set = new Set(storyIds);
  return testCases.filter((t) => set.has(t.storyId)).length;
}

/** Hydrate a sample seed into a full Project with live counts. */
function hydrate(seed: SampleProjectSeed): Project {
  return {
    ...seed,
    storyCount: seed.storyIds.length,
    testCount: countTestsForStories(seed.storyIds),
  };
}

export const sampleProjects: Project[] = SAMPLE_SEEDS.map(hydrate);

/* ---- Scoping helpers (used by pages to filter seed data) ---- */

export function storiesForProject(project: Project | null): Story[] {
  if (!project) return [];
  const set = new Set(project.storyIds);
  return stories.filter((s) => set.has(s.id));
}

export function testsForProject(project: Project | null) {
  if (!project) return [];
  const set = new Set(project.storyIds);
  return testCases.filter((t) => set.has(t.storyId));
}

export function changesForProject(project: Project | null) {
  if (!project) return [];
  const set = new Set(project.storyIds);
  return changeRequests.filter((c) => set.has(c.storyId));
}

/** Find which project a story belongs to (for breadcrumbs). */
export function projectForStory(
  storyId: string,
  projectList: Project[]
): Project | undefined {
  return projectList.find((p) => p.storyIds.includes(storyId));
}

/** Create a fresh, empty project. */
export function createProject(name: string, description: string, domain = ""): Project {
  const now = new Date().toISOString().slice(0, 10);
  // Use the name as the project_id (slugified) so the backend stores it
  // under a human-readable ID and the project selector shows the right name.
  const id = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `proj-${Date.now().toString(36)}`;
  return {
    id,
    name: name.trim(),
    description: description.trim(),
    domain: domain.trim(),
    createdAt: now,
    updatedAt: now,
    storyCount: 0,
    testCount: 0,
    storyIds: [],
  };
}
