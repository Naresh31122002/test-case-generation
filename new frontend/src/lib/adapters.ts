import type { Story as DomainStory } from "@/types/domain";
import type { Story } from "./seed";

function inferTitle(description: string, fallback: string): string {
  const text = description.trim();
  if (!text) return fallback;
  return text.length > 72 ? `${text.slice(0, 72)}...` : text;
}

export function domainStoryToSeed(story: DomainStory): Story {
  const description = story.description || story.docContentText || "";
  const testCount = Number(story.testCaseCount || 0);
  const impactCount = Number(story.impactedTestCasesCount || 0);
  return {
    id: story.id,
    title: inferTitle(description, story.id),
    content: story.docContentText || description,
    type: "Functional",
    status: impactCount > 0 ? "Impact Detected" : "Ready",
    coverage: Math.min(100, Math.max(0, Math.round((testCount / 12) * 100))),
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
