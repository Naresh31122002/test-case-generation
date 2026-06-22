"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Send, X, Sparkles } from "lucide-react";
import { aiClient, buildRequest } from "@/lib/ai/client";
import type { AIMessage, CopilotContext, CopilotIntent } from "@/lib/ai/types";
import { quickActions } from "./quickActions";
import { useProject } from "@/contexts/ProjectContext";
import { getCopilotPageContext, onCopilotContextChange } from "@/lib/copilotContext";

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Derive Copilot context from the current route + selected project. */
function useCopilotContext(): CopilotContext {
  const pathname = usePathname();
  const { selectedProject } = useProject();
  const match = pathname.match(/\/stories\/([^/]+)/);
  return {
    pathname,
    storyId: match ? match[1] : undefined,
    projectId: selectedProject?.id,
    projectName: selectedProject?.name,
    projectStoryIds: selectedProject?.storyIds,
  };
}

export function CopilotPanel({
  onClose,
  initialAction,
}: {
  onClose: () => void;
  /** Optional quick-action auto-sent when the panel opens (from the launcher menu). */
  initialAction?: { prompt: string; intent: CopilotIntent };
}) {
  const context = useCopilotContext();

  // Dynamic greeting based on current page
  function getGreeting(): string {
    const ctx = getCopilotPageContext();
    if (ctx.pageType === "story_detail" && ctx.storyTitle) {
      return `Hi! I know this story — **${ctx.storyTitle}**${ctx.testCount ? ` with ${ctx.testCount} test cases` : ""}${ctx.impactCount ? `, ${ctx.impactCount} impacts` : ""}. Ask me anything about it.`;
    }
    return "Hi! I'm your TestSurge Copilot. Open a story and ask me about its test cases, quality, impacts, or coverage.";
  }

  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: uid(),
      role: "assistant",
      content: getGreeting(),
      createdAt: Date.now(),
    },
  ]);

  // Update greeting when page context changes
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    return onCopilotContextChange(() => forceUpdate(n => n + 1));
  }, []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Fire the launcher's chosen quick action once, on open.
  const firedRef = useRef(false);
  useEffect(() => {
    if (initialAction && !firedRef.current) {
      firedRef.current = true;
      send(initialAction.prompt, initialAction.intent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function send(text: string, intent: CopilotIntent) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;

    const userMsg: AIMessage = {
      id: uid(),
      role: "user",
      content: trimmed,
      createdAt: Date.now(),
    };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setBusy(true);

    // Streaming assistant message.
    const assistantId = uid();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", createdAt: Date.now() },
    ]);

    try {
      const req = buildRequest(history, intent, context);
      let acc = "";
      for await (const chunk of aiClient.stream(req)) {
        acc += chunk.delta;
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, content: acc } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry — the assistant is unavailable right now." }
            : m
        )
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="fixed bottom-24 right-6 z-[60] w-[380px] max-w-[calc(100vw-2rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-white border border-border rounded-card shadow-card flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full bg-surface-pink text-pink flex items-center justify-center">
            <Sparkles size={15} />
          </span>
          <div>
            <p className="text-sm font-semibold text-navy leading-none">Copilot</p>
            <p className="text-[11px] text-muted mt-0.5">{aiClient.provider.label}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-muted hover:text-navy transition-colors"
          aria-label="Close Copilot"
        >
          <X size={18} />
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-card px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === "user"
                  ? "bg-pink text-white"
                  : "bg-gray-50 text-navy border border-border"
              }`}
            >
              {m.content || (
                <span className="inline-flex gap-1 text-muted">
                  <span className="animate-pulse">●</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions — context-aware */}
      <div className="px-3 py-2 border-t border-border flex flex-wrap gap-1.5">
        {(() => {
          const ctx = getCopilotPageContext();
          const actions = ctx.pageType === "story_detail" ? [
            { label: "Summarise story", prompt: "Summarise this story and its key requirements in 2-3 sentences." },
            { label: "Quality issues", prompt: "What quality issues does this story have? What's missing?" },
            { label: "Gaps in tests", prompt: "What test scenarios are missing or undercovered for this story?" },
            { label: "Explain impacts", prompt: "Explain why this story caused impacts on other test cases." },
          ] : [
            { label: "What can I ask?", prompt: "What can you help me with on this page?" },
            { label: "Story overview", prompt: "Give me a summary of the stories in this project." },
          ];
          return actions.map((a) => (
            <button key={a.label} type="button" disabled={busy}
              onClick={() => send(a.prompt, "freeform")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-btn border border-border text-[11px] font-medium text-muted hover:text-navy hover:border-pink hover:bg-surface-pink/40 transition-colors disabled:opacity-50">
              {a.label}
            </button>
          ));
        })()}
      </div>

      {/* Composer */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input, "freeform");
        }}
        className="p-3 border-t border-border flex items-center gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Copilot…"
          className="flex-1 h-9 px-3 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="w-9 h-9 rounded-btn bg-pink text-white flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
          aria-label="Send"
        >
          <Send size={16} />
        </button>
      </form>
    </motion.div>
  );
}
