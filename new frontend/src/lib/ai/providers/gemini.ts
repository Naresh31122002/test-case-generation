/**
 * GeminiProvider — future backend (stub).
 *
 * Wiring guide:
 *   1. Add @google/generative-ai and set GEMINI_API_KEY (server-side only).
 *   2. Route calls through a Next.js route handler (e.g. app/api/copilot/route.ts)
 *      so the key is never exposed to the client.
 *   3. Map ChatRequest.messages -> Gemini contents, prepend retrieved chunks as
 *      grounding context, and stream the response back as ChatChunk deltas.
 */

import type { AIProvider, ChatChunk, ChatRequest, ChatResult } from "../types";

export class GeminiProvider implements AIProvider {
  readonly id = "gemini";
  readonly label = "Google Gemini";
  // Flip to true once the route handler + API key are configured.
  readonly available = false;

  async chat(req: ChatRequest): Promise<ChatResult> {
    void req;
    throw new Error(
      "GeminiProvider not configured. Set GEMINI_API_KEY and implement app/api/copilot."
    );
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    void req;
    throw new Error("GeminiProvider not configured.");
  }
}
