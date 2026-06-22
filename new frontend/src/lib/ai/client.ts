import type { AIMessage, CopilotContext, CopilotIntent, CopilotRequest, CopilotChunk } from "./types";
import { getCopilotPageContext, buildSystemPrompt } from "@/lib/copilotContext";

export function buildRequest(
  messages: AIMessage[],
  intent: CopilotIntent,
  context: CopilotContext,
): CopilotRequest {
  return { messages, intent, context };
}

export const aiClient = {
  provider: { label: "TestSurge AI" },

  async *stream(req: CopilotRequest): AsyncGenerator<CopilotChunk> {
    const pageCtx = getCopilotPageContext();
    const systemPrompt = buildSystemPrompt(pageCtx);
    const lastUser = [...req.messages].reverse().find(m => m.role === "user");
    const query = lastUser?.content ?? "";

    // Build conversation history for the backend
    const history = req.messages.slice(-6).map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      // Use the real RAG endpoint — it searches similar stories and uses LLM
      const res = await fetch("/api/stories/rag-chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          system_prompt: systemPrompt,
          history,
          story_id: pageCtx.storyId,
        }),
      });

      if (!res.ok) {
        // Fallback: direct LLM call without RAG
        const fallback = await fetch("/api/stories/copilot-chat", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, system_prompt: systemPrompt, history }),
        });
        if (fallback.ok) {
          const data = await fallback.json();
          const text = data.response ?? data.answer ?? "I couldn't find an answer for that.";
          // Stream word by word for natural feel
          const words = text.split(" ");
          for (const word of words) {
            yield { delta: word + " " };
            await new Promise(r => setTimeout(r, 15));
          }
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      // rag-chat can return { answer: string } OR { testCases: [...] }
      // Handle both shapes so neither is silently dropped.
      if (data.answer) {
        const words = (data.answer as string).split(" ");
        for (const word of words) {
          yield { delta: word + " " };
          await new Promise(r => setTimeout(r, 15));
        }
        return;
      }
      const testCases: any[] = data.testCases ?? [];
      if (testCases.length > 0) {
        const answer = formatRagAnswer(query, testCases, pageCtx);
        const words = answer.split(" ");
        for (const word of words) {
          yield { delta: word + " " };
          await new Promise(r => setTimeout(r, 15));
        }
      } else {
        yield { delta: "I couldn't find relevant test cases for that query. Try rephrasing or asking something more specific about the current story." };
      }
    } catch (err) {
      yield { delta: `Sorry, I couldn't connect to the AI backend right now. (${err instanceof Error ? err.message : "unknown error"})` };
    }
  },
};

function formatRagAnswer(query: string, testCases: any[], ctx: any): string {
  const q = query.toLowerCase();

  if (q.includes("how many") || q.includes("count")) {
    return `There are ${testCases.length} relevant test cases. ${testCases.slice(0, 3).map(tc => `"${tc.title}"`).join(", ")}${testCases.length > 3 ? ` and ${testCases.length - 3} more.` : "."}`;
  }

  if (q.includes("list") || q.includes("show") || q.includes("what")) {
    const list = testCases.slice(0, 5).map((tc, i) => `${i + 1}. **${tc.title}** (${tc.priority || "Medium"} priority)`).join("\n");
    return `Here are the most relevant test cases:\n\n${list}${testCases.length > 5 ? `\n\n...and ${testCases.length - 5} more related test cases.` : ""}`;
  }

  // Generic answer
  const titles = testCases.slice(0, 3).map(tc => `"${tc.title}"`).join(", ");
  return `Based on the story content, I found ${testCases.length} related test cases including ${titles}. These cover the scenarios most relevant to your question.`;
}
