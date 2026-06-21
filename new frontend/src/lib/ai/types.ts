export type CopilotIntent =
  | "freeform"
  | "ask_story"
  | "ask_tests"
  | "ask_coverage"
  | "explain_impact"
  | "generate_tests";

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

export interface CopilotContext {
  pathname: string;
  storyId?: string;
  projectId?: string;
  projectName?: string;
  projectStoryIds?: string[];
}

export interface CopilotRequest {
  messages: AIMessage[];
  intent: CopilotIntent;
  context: CopilotContext;
}

export interface CopilotChunk {
  delta: string;
}

// ── Legacy provider types (used by ai/providers/*) ────────────────────────────

export interface ChatRequest {
  messages: { role: "user" | "assistant" | "system"; content: string }[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  intent?: string;
  retrieved?: RetrievedChunk[];
}

export interface ChatChunk { delta: string; }

export interface ChatResult {
  content: string;
  message?: string;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface RetrievedChunk {
  id: string;
  content?: string;
  score: number;
  title?: string;
  text?: string;
  kind?: string;
  href?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AIProvider {
  chat(req: ChatRequest): Promise<ChatResult>;
  chatStream?(req: ChatRequest): AsyncIterable<ChatChunk>;
}

export interface Retriever {
  retrieve(query: string, ctxOrTopK?: CopilotContext | number, topK?: number): Promise<RetrievedChunk[]>;
}
