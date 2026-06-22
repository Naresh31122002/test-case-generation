/**
 * RAG abstraction.
 *
 * `SeedRetriever` is a lightweight keyword/TF retriever over the existing
 * in-memory seed data. It implements the same `Retriever` contract a real
 * vector store would, so it can be replaced by an embeddings-backed retriever
 * (e.g. Pinecone / pgvector) without touching callers.
 */

import {
  stories,
  testCases,
  coverageGaps,
  impactedTests,
  changeRequests,
} from "@/lib/seed";
import type { CopilotContext, RetrievedChunk, Retriever } from "./types";

/** Flatten all seed data into a single searchable corpus. */
function buildCorpus(): RetrievedChunk[] {
  const corpus: RetrievedChunk[] = [];

  for (const s of stories) {
    corpus.push({
      id: `story:${s.id}`,
      kind: "story",
      title: `${s.id} — ${s.title}`,
      text: `${s.title}. ${s.content} Coverage ${s.coverage}%. ${s.testCount} tests. Impact ${s.impactCount}. Status ${s.status}.`,
      score: 0,
      href: `/stories/${s.id}`,
    });
  }
  for (const t of testCases) {
    corpus.push({
      id: `test:${t.id}`,
      kind: "test",
      title: `${t.id} — ${t.title}`,
      text: `${t.title}. Type ${t.type}. Priority ${t.priority}. ${t.steps.join(" ")} Expected: ${t.expectedResult}`,
      score: 0,
      href: `/stories/${t.storyId}`,
    });
  }
  for (const g of coverageGaps) {
    corpus.push({
      id: `coverage:${g.id}`,
      kind: "coverage",
      title: `Gap — ${g.title}`,
      text: `${g.title}. ${g.description} Type ${g.type}. Severity ${g.severity}.`,
      score: 0,
      href: `/stories/${g.storyId}`,
    });
  }
  for (const i of impactedTests) {
    corpus.push({
      id: `impact:${i.id}`,
      kind: "impact",
      title: `Impact — ${i.title}`,
      text: `${i.title}. ${i.impactType}. ${i.reason} ${i.aiReason} Confidence ${i.aiConfidence}%.`,
      score: 0,
      href: `/stories/${i.storyId}`,
    });
  }
  for (const c of changeRequests) {
    corpus.push({
      id: `change:${c.id}`,
      kind: "change",
      title: `${c.id} — ${c.title}`,
      text: `${c.title}. ${c.storiesAffected} stories, ${c.testsAffected} tests affected. Impact ${c.impactScore}. Status ${c.status}.`,
      score: 0,
      href: `/changes/${c.id}`,
    });
  }
  return corpus;
}

/** Map each chunk id -> the storyId it belongs to (for project scoping). */
function buildStoryIdMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of stories) map[`story:${s.id}`] = s.id;
  for (const t of testCases) map[`test:${t.id}`] = t.storyId;
  for (const g of coverageGaps) map[`coverage:${g.id}`] = g.storyId;
  for (const i of impactedTests) map[`impact:${i.id}`] = i.storyId;
  for (const c of changeRequests) map[`change:${c.id}`] = c.storyId;
  return map;
}

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

export class SeedRetriever implements Retriever {
  private corpus = buildCorpus();
  private storyIdOf = buildStoryIdMap();

  async retrieve(
    query: string,
    ctx: CopilotContext,
    topK = 4
  ): Promise<RetrievedChunk[]> {
    const terms = tokenize(query);
    const focusId = ctx.storyId?.toLowerCase();

    // Scope the corpus to the current project (if one is selected).
    const projectSet = ctx.projectStoryIds
      ? new Set(ctx.projectStoryIds)
      : null;
    const corpus = projectSet
      ? this.corpus.filter((c) => {
          const sid = this.storyIdOf[c.id];
          return sid ? projectSet.has(sid) : true;
        })
      : this.corpus;

    const scored = corpus.map((chunk) => {
      const haystack = `${chunk.title} ${chunk.text}`.toLowerCase();
      let score = 0;
      for (const term of terms) {
        if (haystack.includes(term)) score += 1;
      }
      // Boost chunks tied to the story the user is currently viewing.
      if (focusId && haystack.includes(focusId)) score += 3;
      // Normalize roughly into 0..1.
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
export const retriever: Retriever = new SeedRetriever();
