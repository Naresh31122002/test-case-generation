/**
 * AIClient — the single orchestration entry point used by the UI.
 *
 * Responsibilities:
 *   - Select the active provider (env-driven; defaults to Mock).
 *   - Run RAG retrieval and inject grounding into each request.
 *   - Expose chat() and stream() that the Copilot components call.
 *
 * Switching providers later is a one-line change (env var) — no UI edits.
 */

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResult,
  CopilotContext,
  CopilotIntent,
  ProviderId,
  Retriever,
} from "./types";
import { MockProvider } from "./providers/mock";
import { GeminiProvider } from "./providers/gemini";
import { OpenAIProvider } from "./providers/openai";
import { retriever as defaultRetriever } from "./retrieval";

function resolveProvider(): AIProvider {
  const requested = (process.env.NEXT_PUBLIC_AI_PROVIDER ?? "mock") as ProviderId;
  const registry: Record<ProviderId, AIProvider> = {
    mock: new MockProvider(),
    gemini: new GeminiProvider(),
    openai: new OpenAIProvider(),
  };
  const chosen = registry[requested];
  // Fall back to Mock if the requested provider isn't wired up yet.
  return chosen && chosen.available ? chosen : registry.mock;
}

export class AIClient {
  readonly provider: AIProvider;
  private retriever: Retriever;

  constructor(provider?: AIProvider, retriever?: Retriever) {
    this.provider = provider ?? resolveProvider();
    this.retriever = retriever ?? defaultRetriever;
  }

  private async ground(req: ChatRequest): Promise<ChatRequest> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const query = lastUser?.content ?? "";
    const retrieved = await this.retriever.retrieve(query, req.context);
    return { ...req, retrieved };
  }

  async chat(req: ChatRequest): Promise<ChatResult> {
    const grounded = await this.ground(req);
    return this.provider.chat(grounded);
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    const grounded = await this.ground(req);
    yield* this.provider.stream(grounded);
  }
}

/** Shared singleton for the app. */
export const aiClient = new AIClient();

/** Convenience builder used by the UI quick actions. */
export function buildRequest(
  messages: ChatRequest["messages"],
  intent: CopilotIntent,
  context: CopilotContext
): ChatRequest {
  return { messages, intent, context };
}
