/**
 * OpenAIProvider — future backend (stub).
 *
 * Wiring guide:
 *   1. Add the `openai` SDK and set OPENAI_API_KEY (server-side only).
 *   2. Proxy through a Next.js route handler (app/api/copilot/route.ts).
 *   3. Map ChatRequest.messages -> chat.completions messages, inject retrieved
 *      chunks as a system/context message, and stream tokens as ChatChunk deltas.
 */

import type { AIProvider, ChatChunk, ChatRequest, ChatResult } from "../types";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly label = "OpenAI";
  // Flip to true once the route handler + API key are configured.
  readonly available = false;

  async chat(req: ChatRequest): Promise<ChatResult> {
    void req;
    throw new Error(
      "OpenAIProvider not configured. Set OPENAI_API_KEY and implement app/api/copilot."
    );
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    void req;
    throw new Error("OpenAIProvider not configured.");
  }
}
