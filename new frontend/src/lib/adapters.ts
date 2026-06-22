import type { Story as DomainStory } from "@/types/domain";
import type { Story, StoryStatus } from "./seed";

function inferTitle(description: string, fallback: string): string {
  const text = description.trim();
  if (!text) return fallback;
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

function deriveStatus(story: DomainStory): StoryStatus {
  const testCount = Number(story.testCaseCount || 0);
  const impactCount = Number(story.impactedTestCasesCount || 0);
  if (story.storyStatus === 'in_progress') return "Analyzing";
  if (impactCount > 0) return "Impact Detected";
  if (testCount > 0) return "Ready";
  if (story.storyStatus === 'in_review' || story.storyStatus === 'completed') return "Ready";
  return "Draft";
}

/**
 * Extracts acceptance criteria from story content text.
 * Looks for an "Acceptance Criteria" section header and collects
 * bullet points (- item), asterisks (* item), or numbered items (1. item).
 */
function parseAcceptanceCriteria(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  const criteria: string[] = [];
  let inSection = false;

  for (const raw of lines) {
    const line = raw.trim();
    // Detect section header (case-insensitive, handles "Acceptance Criteria:", "## Acceptance Criteria", etc.)
    if (/^#+\s*acceptance\s+criteria/i.test(line) || /^acceptance\s+criteria\s*[:\-]?$/i.test(line)) {
      inSection = true;
      continue;
    }
    // Stop at the next section header (line starting with # or a known keyword followed by :)
    if (inSection && /^#+\s/.test(line)) break;
    if (inSection && /^(story|description|background|scenario|given|when|then|notes?|remarks?)\s*:/i.test(line)) break;

    if (inSection) {
      // Match "- item", "* item", "• item", or "1. item"
      const match = line.match(/^(?:[-*•]|\d+\.)\s+(.+)$/);
      if (match) {
        criteria.push(match[1].trim());
      }
    }
  }
  return criteria;
}

export function domainStoryToSeed(story: DomainStory): Story {
  const description = story.description || story.docContentText || "";
  const testCount = Number(story.testCaseCount || 0);
  const impactCount = Number(story.impactedTestCasesCount || 0);
  const coverage = Math.min(100, Math.max(0, Math.round((testCount / 40) * 100)));
  // Parse acceptance criteria from the raw story content
  const rawContent = story.docContentText || description;
  return {
    id: story.id,
    title: inferTitle(description, story.id),
    content: rawContent,
    type: "Functional",
    status: deriveStatus(story),
    coverage,
    testCount,
    impactCount,
    acceptanceCriteria: parseAcceptanceCriteria(rawContent),
    qualityScore: 0,
    qualityBreakdown: { completeness: 0, clarity: 0, testability: 0 },
    qualityIssues: [],
    riskAreas: impactCount > 0
      ? [{ area: "Impact", severity: "Medium", description: `${impactCount} impacted tests need review.` }]
      : [],
    aiRecommendations: [],
    lastUpdated: story.testCaseCreatedTime || story.embeddingTimestamp || "",
    version: "v1",
  };
}
