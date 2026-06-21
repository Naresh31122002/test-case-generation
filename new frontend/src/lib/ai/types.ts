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
