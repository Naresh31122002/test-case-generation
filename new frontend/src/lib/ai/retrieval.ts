/**
 * RAG abstraction.
 *
 * `ApiRetriever` fetches real stories and test cases from the backend API
 * and does client-side keyword scoring. This is a lightweight local layer
 * used by CopilotPanel to add context before the backend RAG call.
 *
 * The backend `/api/stories/rag-chat` is the authoritative RAG endpoint
 * (vector search over LanceDB). This retriever supplements it with
 * real-time context from the currently loaded page.
 */

import type { CopilotContext, RetrievedChunk, Retriever } from "./types";
import { getCopilotPageContext } from "@/lib/copilotContext";

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "for", "and", "or", "in", "on",
  "what", "how", "why", "do", "does", "can", "about", "this", "that", "my",
  "tell", "me", "show", "explain", "with",
]);

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

export class ApiRetriever implements Retriever {
  async retrieve(
    query: string,
    ctx: CopilotContext,
    topK = 4
  ): Promise<RetrievedChunk[]> {
    const terms = tokenize(query);
    if (terms.length === 0) return [];

    // Build corpus from the current page context (injected by useCopilotPageContext)
    const pageCtx = getCopilotPageContext();
    const corpus: RetrievedChunk[] = [];

    // Add current story if we're on a story page
    if (pageCtx.pageType === "story_detail" && pageCtx.storyId && pageCtx.storyTitle) {
      corpus.push({
        id: `story:${pageCtx.storyId}`,
        kind: "story",
        title: `${pageCtx.storyId} — ${pageCtx.storyTitle}`,
        text: `${pageCtx.storyTitle}. ${pageCtx.storyContent ?? ""} ${pageCtx.testCount ?? 0} tests. Quality ${pageCtx.qualityScore ?? 0}%.`,
        score: 0,
        href: `/stories/${pageCtx.storyId}`,
      });
      // Add current story's test cases from page context
      for (const tc of pageCtx.testCases ?? []) {
        corpus.push({
          id: `test:${tc.id}`,
          kind: "test",
          title: `${tc.id} — ${tc.title}`,
          text: `${tc.title}. Priority ${tc.priority}. ${(tc.steps ?? []).join(" ")} Expected: ${(tc as any).expectedResult ?? ""}`,
          score: 0,
          href: `/stories/${pageCtx.storyId}`,
        });
      }
    }

    if (corpus.length === 0) return [];

    const focusId = ctx.storyId?.toLowerCase();
    const scored = corpus.map((chunk) => {
      const haystack = `${chunk.title} ${chunk.text}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
      }
      if (focusId && haystack.includes(focusId)) score += 3;
      const norm = terms.length ? score / (terms.length + 3) : 0;
      return { ...chunk, score: Math.min(1, norm) };
    });

    return scored
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);
  }
}

/** Swap this single export to change the active retriever globally. */
export const retriever: Retriever = new ApiRetriever();
