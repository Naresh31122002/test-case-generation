import {
  BookOpen,
  TestTube2,
  PieChart,
  Zap,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { CopilotIntent } from "@/lib/ai/types";

export interface QuickAction {
  intent: CopilotIntent;
  label: string;
  icon: LucideIcon;
  /** Prefilled prompt sent when the action is clicked. */
  prompt: string;
}

export const quickActions: QuickAction[] = [
  {
    intent: "ask_story",
    label: "Ask about story",
    icon: BookOpen,
    prompt: "Tell me about this story and its acceptance criteria.",
  },
  {
    intent: "ask_tests",
    label: "Ask about tests",
    icon: TestTube2,
    prompt: "What tests exist and what do they cover?",
  },
  {
    intent: "ask_coverage",
    label: "Ask about coverage",
    icon: PieChart,
    prompt: "Where are the coverage gaps?",
  },
  {
    intent: "explain_impact",
    label: "Explain impact analysis",
    icon: Zap,
    prompt: "Explain the impact analysis for the recent changes.",
  },
  {
    intent: "generate_tests",
    label: "Generate missing tests",
    icon: Sparkles,
    prompt: "Generate the missing tests for this story.",
  },
];
