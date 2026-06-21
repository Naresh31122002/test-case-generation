// @ts-nocheck
/**
 * MockProvider — the active backend.
 *
 * Produces deterministic, grounded answers from retrieved seed chunks so the
 * Copilot is fully functional with zero external dependencies. Mirrors the
 * exact contract Gemini/OpenAI providers will implement.
 */

import type {
  AIProvider,
  ChatChunk,
  ChatRequest,
  ChatResult,
  CopilotIntent,
  RetrievedChunk,
} from "../types";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function citations(chunks: RetrievedChunk[] = []): string {
  if (!chunks.length) return "";
  const list = chunks.map((c) => `• ${c.title}`).join("\n");
  return `\n\nSources:\n${list}`;
}

function answerFor(intent: CopilotIntent, query: string, chunks: RetrievedChunk[]): string {
  const top = chunks.slice(0, 3);
  const ground = top.map((c) => c.text).join(" ");

  switch (intent) {
    case "ask_story": {
      const s = top.find((c) => c.kind === "story") ?? top[0];
      return s
        ? `Here's what I found on **${s.title}**:\n\n${s.text}`
        : "I couldn't find a matching story. Try referencing a story ID like AUTH-010.";
    }
    case "ask_tests": {
      const tests = chunks.filter((c) => c.kind === "test");
      if (!tests.length) return "No matching tests found for that query.";
      return `I found ${tests.length} relevant test${tests.length > 1 ? "s" : ""}:\n\n${tests
        .map((t) => `• **${t.title}** — ${((t as any).text ?? "").slice(0, 90)}…`)
        .join("\n")}`;
    }
    case "ask_coverage": {
      const gaps = chunks.filter((c) => c.kind === "coverage");
      return gaps.length
        ? `Coverage gaps related to your question:\n\n${gaps
            .map((g) => `• ${g.title}: ${g.text}`)
            .join("\n")}`
        : `Based on current data: ${ground || "no specific coverage gaps matched."}`;
    }
    case "explain_impact": {
      const impacts = chunks.filter((c) => c.kind === "impact");
      return impacts.length
        ? `Impact analysis explanation:\n\n${impacts
            .map((i) => `• ${i.title} — ${i.text}`)
            .join(
              "\n"
            )}\n\nImpact analysis compares the new requirement against existing tests and flags which must be modified, created, deprecated, or merged.`
        : "Impact analysis evaluates how a requirement change ripples across existing tests. I didn't find a specific impacted set for that query — open a story marked 'Impact Detected' for details.";
    }
    case "generate_tests": {
      const s = top.find((c) => c.kind === "story") ?? top[0];
      const base = s ? s.title : "the selected story";
      return `Here are suggested missing tests for **${base}** (draft — review before saving):\n\n1. **Negative** — Submit with empty required fields → validation errors shown.\n2. **Boundary** — Input at max length limit → accepted; one over → rejected.\n3. **Security** — Attempt injection in input fields → sanitized, no execution.\n4. **Accessibility** — Keyboard-only navigation reaches all controls; ARIA labels present.\n\nWant me to expand any of these into full steps?`;
    }
    default:
      return ground
        ? `${ground}`
        : `I'm the TestSurge Copilot. Ask me about a story, its tests, coverage, or impact analysis — or ask me to generate missing tests.`;
  }
}

export class MockProvider implements AIProvider {
  readonly id = "mock";
  readonly label = "TestSurge AI (Demo)";
  readonly available = true;

  async chat(req: ChatRequest): Promise<ChatResult> {
    const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
    const query = lastUser?.content ?? "";
    const body = answerFor((req as any).intent, query, (req as any).retrieved ?? []);
    const content = body + citations((req as any).retrieved);
    return {
      message: {
        id: uid(),
        role: "assistant",
        content,
        sources: (req as any).retrieved,
        createdAt: Date.now(),
      },
    };
  }

  async *stream(req: ChatRequest): AsyncIterable<ChatChunk> {
    (req as any, {message}) = await this.chat(req);
    const words = message.content.split(" ");
    for (let i = 0; i < words.length; i++) {
      await new Promise((r) => setTimeout(r, 18));
      yield { delta: words[i] + (i < words.length - 1 ? " " : ""), done: false };
    }
    yield { delta: "", done: true };
  }
}
