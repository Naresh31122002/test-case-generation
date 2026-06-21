// src/lib/adapters.ts
//
// Converts normalized domain types (from the backend API) into the seed.ts
// Story shape that all existing components consume.
//
// This lets the stories list and workspace pages work with real API data
// while keeping every component unchanged. Once the backend has full quality/
// coverage endpoints, these fields can be replaced with real data.

import type { Story as DomainStory, TestCase as DomainTestCase } from '@/types/domain'
import type { Story, TestCase, StoryStatus } from '@/lib/seed'

function deriveStatus(s: DomainStory): StoryStatus {
  if (s.testCaseCount === 0) return 'Draft'
  if (s.impactedTestCasesCount > 0) return 'Impact Detected'
  return 'Ready'
}

/** Heuristic coverage % from test count vs expected range (INTEGRATION_PLAN Gap 1). */
function heuristicCoverage(testCaseCount: number): number {
  // Expected counts per complexity tier: low 23, medium 40, high 60
  // Use medium (40) as the default denominator — most uploaded stories are medium complexity.
  const expected = 40
  return Math.min(100, Math.round((testCaseCount / expected) * 100))
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Unknown'
  try {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7) return `${days}d ago`
    return `${Math.floor(days / 7)}w ago`
  } catch {
    return 'Unknown'
  }
}

/**
 * Derives a short display title (≤6 words) from the backend description.
 * New stories get a proper LLM-generated short title stored as description.
 * Existing stories have a long sentence — we extract the first 5–6 words.
 */
function shortTitle(description: string): string {
  if (!description) return 'Untitled Story'
  // If it's already short (≤40 chars, no sentence structure), use as-is
  if (description.length <= 40 && !description.includes('.')) return description
  // Strip "As a user, I want to" boilerplate if present
  const cleaned = description
    .replace(/^As an? [^,]+,?\s*/i, '')
    .replace(/^I want to\s*/i, '')
    .replace(/\s+so that.*/i, '')
    .replace(/\s+in order to.*/i, '')
    .trim()
  // Take first 6 words
  const words = cleaned.split(/\s+/).slice(0, 6)
  const title = words.join(' ').replace(/[.,;:!?]$/, '')
  return title || description.split(/\s+/).slice(0, 5).join(' ')
}

/**
 * Extract acceptance criteria from story content text.
 * Looks for lines after "Acceptance Criteria:" header.
 */
function extractAcceptanceCriteria(content: string | null): string[] {
  if (!content) return []
  const lines = content.split('\n')
  const acStart = lines.findIndex((l) =>
    /acceptance\s+criteria/i.test(l)
  )
  if (acStart === -1) return []
  const criteria: string[] = []
  for (let i = acStart + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // Stop at next section header
    if (/^#+\s|^[A-Z][^a-z]*:$/.test(line) && criteria.length > 0) break
    // Accept bullet points or numbered items
    const cleaned = line.replace(/^[-*•✓✗\d]+[.)]\s*/, '').trim()
    if (cleaned.length > 5) criteria.push(cleaned)
  }
  return criteria.slice(0, 10)
}

export function domainStoryToSeed(s: DomainStory): Story {
  return {
    id: s.id,
    title: shortTitle(s.description),
    status: deriveStatus(s),
    coverage: heuristicCoverage(s.testCaseCount),
    testCount: s.testCaseCount,
    impactCount: s.impactedTestCasesCount,
    lastUpdated: relativeTime(s.testCaseCreatedTime),
    type: 'Functional',                     // UNCLEAR — backend has no type field; default to Functional
    version: 'v1',                          // version history dropped in v1 (INTEGRATION_PLAN Gap 3)
    content: s.docContentText ?? s.description,
    acceptanceCriteria: extractAcceptanceCriteria(s.docContentText),
    qualityScore: 75,
    qualityBreakdown: { completeness: 70, clarity: 80, testability: 70 },
    qualityIssues: [],
    riskAreas: [],
    aiRecommendations: [],
    kanbanStatus: s.storyStatus,
  }
}

export function domainTestCaseToSeed(tc: DomainTestCase, storyId: string): TestCase {
  const priorityMap: Record<string, 'P1' | 'P2' | 'P3'> = {
    High: 'P1',
    Medium: 'P2',
    Low: 'P3',
  }
  return {
    id: tc.id,
    storyId,
    title: tc.title,
    type: inferTestType(tc.title),
    priority: priorityMap[tc.priority] ?? 'P2',
    status: 'Approved',
    steps: tc.steps,
    expectedResult: tc.expectedResult,
  }
}

// Keyword classifier matching INTEGRATION_PLAN Gap 1 heuristic
function inferTestType(title: string): TestCase['type'] {
  const t = title.toLowerCase()
  if (/\b(security|auth|inject|xss|csrf|permission|privilege|token|bypass)\b/.test(t)) return 'Security'
  if (/\b(boundary|limit|max|min|overflow|empty|null|zero|exceed)\b/.test(t)) return 'Boundary'
  if (/\b(invalid|fail|error|reject|wrong|missing|incorrect|denied|not found)\b/.test(t)) return 'Negative'
  if (/\b(accessibility|aria|keyboard|screen.?reader|contrast|focus)\b/.test(t)) return 'Accessibility'
  return 'Functional'
}
