/**
 * CopilotContext store — pages inject their data here so the Copilot
 * can answer questions about what's currently on screen.
 *
 * Usage in a page/tab:
 *   useCopilotPageContext({ storyId, testCases, ... })
 *
 * The Copilot reads from here when building its system prompt.
 */

import { useEffect } from "react";

export interface PageContext {
  /** What page the user is on */
  pageType: "stories_list" | "story_detail" | "kanban" | "other";
  storyId?: string;
  storyTitle?: string;
  storyContent?: string;
  testCases?: Array<{ id: string; title: string; priority: string; status: string; steps: string[] }>;
  testCount?: number;
  impactCount?: number;
  qualityScore?: number;
  projectName?: string;
}

// Simple in-memory store (no React state — avoids re-render churn)
let _ctx: PageContext = { pageType: "other" };
let _listeners: Array<() => void> = [];

export function setCopilotPageContext(ctx: PageContext) {
  _ctx = ctx;
  _listeners.forEach(fn => fn());
}

export function getCopilotPageContext(): PageContext {
  return _ctx;
}

export function onCopilotContextChange(fn: () => void): () => void {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

/** Hook: call in any page/tab to inject context into the Copilot */
export function useCopilotPageContext(ctx: PageContext) {
  useEffect(() => {
    setCopilotPageContext(ctx);
    return () => setCopilotPageContext({ pageType: "other" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(ctx)]);
}

/** Build a rich system-prompt string from the current page context */
export function buildSystemPrompt(ctx: PageContext): string {
  const lines: string[] = [
    "You are TestSurge Copilot, an expert QA assistant embedded in a test case management tool.",
    "Answer questions about the current page content. Be concise and specific.",
    "",
  ];

  if (ctx.storyTitle) lines.push(`Current story: "${ctx.storyTitle}" (${ctx.storyId})`);
  if (ctx.projectName) lines.push(`Project: ${ctx.projectName}`);
  if (ctx.testCount !== undefined) lines.push(`Test cases: ${ctx.testCount}`);
  if (ctx.impactCount !== undefined) lines.push(`Impacts detected: ${ctx.impactCount}`);
  if (ctx.qualityScore !== undefined) lines.push(`Quality score: ${ctx.qualityScore}/100`);

  if (ctx.storyContent) {
    lines.push("", "Story content:", ctx.storyContent.slice(0, 800));
  }

  if (ctx.testCases && ctx.testCases.length > 0) {
    lines.push("", "Test cases on screen:");
    ctx.testCases.slice(0, 15).forEach(tc => {
      lines.push(`- [${tc.priority}] ${tc.title} (${tc.status})`);
    });
    if (ctx.testCases.length > 15) lines.push(`  ... and ${ctx.testCases.length - 15} more`);
  }

  lines.push("", "Help the user understand, improve, or query the content above.");
  return lines.join("\n");
}
