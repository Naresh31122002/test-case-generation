import type { AIMessage, CopilotContext, CopilotIntent, CopilotRequest, CopilotChunk } from "./types";

export function buildRequest(
  messages: AIMessage[],
  intent: CopilotIntent,
  context: CopilotContext,
): CopilotRequest {
  return { messages, intent, context };
}

export const aiClient = {
  provider: { label: "Local assistant" },
  async *stream(req: CopilotRequest): AsyncGenerator<CopilotChunk> {
    const last = req.messages[req.messages.length - 1]?.content || "";
    const context = req.context.storyId
      ? ` for story ${req.context.storyId}`
      : req.context.projectName
      ? ` for ${req.context.projectName}`
      : "";
    const text = `I can help${context}. You asked: "${last}". Connect the backend AI endpoint when you want live Copilot responses.`;
    yield { delta: text };
  },
};
