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
  // Map DB story_status → UI StoryStatus
  if (story.storyStatus === 'in_progress') return "Analyzing";
  if (impactCount > 0) return "Impact Detected";
  if (testCount > 0) return "Ready";
  if (story.storyStatus === 'in_review' || story.storyStatus === 'completed') return "Ready";
  return "Draft";
}

export function domainStoryToSeed(story: DomainStory): Story {
  const description = story.description || story.docContentText || "";
  const testCount = Number(story.testCaseCount || 0);
  const impactCount = Number(story.impactedTestCasesCount || 0);
  // Coverage: heuristic based on test density (40 tests = ~100% for an average story)
  // Labeled as estimated in the UI via the "(estimated)" badge on the coverage ring.
  const coverage = Math.min(100, Math.max(0, Math.round((testCount / 40) * 100)));
  return {
    id: story.id,
    title: inferTitle(description, story.id),
    content: story.docContentText || description,
    type: "Functional",
    status: deriveStatus(story),
    coverage,
    testCount,
    impactCount,
    acceptanceCriteria: [],
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
