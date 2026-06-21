/**
 * Provider-agnostic AI contracts.
 *
 * Everything the UI and orchestration layer touch is defined here so that
 * swapping the underlying engine (Mock -> Gemini -> OpenAI) never requires
 * changes outside `src/lib/ai/providers/*`.
 */

export type AIRole = "user" | "assistant" | "system";

export interface AIMessage {
  id: string;
  role: AIRole;
  content: string;
  /** Optional grounding sources surfaced to the user (RAG citations). */
  sources?: RetrievedChunk[];
  createdAt: number;
}

/** The 5 first-class Copilot capabilities. Drives quick actions + routing. */
export type CopilotIntent =
  | "ask_story"
  | "ask_tests"
  | "ask_coverage"
  | "explain_impact"
  | "generate_tests"
  | "freeform";

export interface CopilotContext {
  /** Route the user is currently on, e.g. "/stories/AUTH-010". */
  pathname?: string;
  /** Story currently in focus, if any. */
  storyId?: string;
  /** Currently selected project (Project Management Layer). */
  projectId?: string;
  projectName?: string;
  /** Story IDs in the current project — scopes RAG retrieval. */
  projectStoryIds?: string[];
}

export interface ChatRequest {
  messages: AIMessage[];
  intent: CopilotIntent;
  context: CopilotContext;
  /** Retrieved grounding chunks (populated by the RAG layer before the call). */
  retrieved?: RetrievedChunk[];
}

export interface ChatChunk {
  /** Incremental text delta for streaming UIs. */
  delta: string;
  done: boolean;
}

export interface ChatResult {
  message: AIMessage;
}

/** A unit of grounding knowledge returned by a Retriever. */
export interface RetrievedChunk {
  id: string;
  kind: "story" | "test" | "coverage" | "impact" | "change";
  title: string;
  text: string;
  /** Relevance score 0..1; higher is better. */
  score: number;
  /** Optional deep link into the app. */
  href?: string;
}

/** RAG abstraction — any vector store / keyword index implements this. */
export interface Retriever {
  retrieve(query: string, ctx: CopilotContext, topK?: number): Promise<RetrievedChunk[]>;
}

/** The single contract every model backend must satisfy. */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  /** Whether this provider is wired up and usable in the current build. */
  readonly available: boolean;

  /** Non-streaming completion. */
  chat(req: ChatRequest): Promise<ChatResult>;

  /** Streaming completion. Implementations may fall back to chunking chat(). */
  stream(req: ChatRequest): AsyncIterable<ChatChunk>;
}

export type ProviderId = "mock" | "gemini" | "openai";
