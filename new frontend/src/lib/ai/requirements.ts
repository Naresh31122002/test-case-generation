/**
 * Requirements → User Stories service (Path B of Story Creation).
 *
 * Calls the real backend endpoint POST /api/stories/generate-from-requirements
 * which uses the Groq LLM to extract structured user stories from BRD/PRD/SRS docs.
 *
 * The UI layer (generate/page.tsx) uses this service — swapping mock → real
 * required no UI changes, only this file.
 */

/* ─────────────────────────── Credits ─────────────────────────── */

export const REQUIREMENT_CREDIT_RATES = {
  /** Per analyzed document. */
  analysisPerDoc: 8,
  /** Per generated user story. */
  storyGeneration: 5,
  /** Per story when generating tests downstream (matches AI_ACTION_COSTS.generateTests). */
  testGeneration: 25,
} as const;

/* ─────────────────────────── Types ─────────────────────────── */

export interface RequirementSource {
  name: string;
  text: string;
  file?: File;
}

export interface ExtractedAnalysis {
  features: string[];
  actors: string[];
  businessRules: string[];
  acceptanceCriteria: string[];
  /** Raw stories returned by backend — used in generateStories() */
  _rawStories?: GeneratedStory[];
}

export type StoryStatus = "draft" | "approved";

export interface GeneratedStory {
  id: string;
  title: string;
  /** "As a … I want … so that …" */
  narrative: string;
  acceptanceCriteria: string[];
  status: StoryStatus;
}

export interface ValidationResult {
  valid: boolean;
  messages: string[];
}

/* ─────────────────────────── Validation ─────────────────────────── */

const MIN_DOC_CHARS = 100;

const JUNK_PATTERNS: { test: RegExp; reason: string }[] = [
  { test: /^\s*at\s+.+\(.+:\d+:\d+\)/m, reason: "Looks like a JavaScript stack trace, not requirements." },
  { test: /(Error|Exception|Traceback)\b.*(:|\n)/m, reason: "Contains error/exception output rather than requirements." },
  { test: /\b(npm|yarn|pnpm)\s+(run|install|err)/i, reason: "Looks like terminal/npm output." },
  { test: /^\s*(\$|>|PS [A-Z]:\\)/m, reason: "Looks like a shell/terminal log." },
  { test: /EADDRINUSE|ECONNREFUSED|ENOENT|MODULE_NOT_FOUND/, reason: "Contains runtime/system error logs." },
  { test: /webpack|node_modules|HMR|hot-reload/i, reason: "Looks like build/bundler output." },
];

export function validateSource(src: RequirementSource): ValidationResult {
  const messages: string[] = [];
  const t = src.text.trim();
  if (t.length < MIN_DOC_CHARS) {
    return { valid: false, messages: [`"${src.name}" is too short (${t.length} chars). Minimum ${MIN_DOC_CHARS}.`] };
  }
  for (const p of JUNK_PATTERNS) {
    if (p.test.test(t)) { messages.push(p.reason); break; }
  }
  return { valid: messages.length === 0, messages };
}

export function validateSources(sources: RequirementSource[]): ValidationResult {
  if (sources.length === 0) return { valid: false, messages: ["No content provided."] };
  const messages: string[] = [];
  let validCount = 0;
  for (const s of sources) {
    const r = validateSource(s);
    if (r.valid) validCount++;
    else messages.push(...r.messages);
  }
  return { valid: validCount > 0, messages };
}

/**
 * Read a File object into a RequirementSource.
 * For TXT/MD files, reads text client-side for validation.
 * For PDF/DOCX, returns a placeholder — real extraction happens server-side.
 */
export async function readSourceText(file: File): Promise<RequirementSource> {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  if (ext === "txt" || ext === "md") {
    const text = await file.text();
    return { name: file.name, text, file };
  }
  // PDF/DOCX: return stub text so validation passes; real extraction happens server-side
  return {
    name: file.name,
    text: `[Document: ${file.name} — ${Math.round(file.size / 1024)} KB — will be extracted server-side]`,
    file,
  };
}

/* ─────────────────────────── Real backend calls ─────────────────────────── */

const BASE_URL =
  typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:5000")
    : "http://127.0.0.1:5000";

/**
 * Analyze requirement sources — calls POST /api/stories/generate-from-requirements.
 * The backend extracts text (for PDF/DOCX) and uses the Groq LLM to produce stories.
 * Returns an ExtractedAnalysis whose _rawStories contains the generated stories.
 */
export async function analyzeRequirements(
  sources: RequirementSource[]
): Promise<ExtractedAnalysis> {
  const formData = new FormData();

  for (const src of sources) {
    if (
      src.file &&
      (src.file.name.toLowerCase().endsWith(".pdf") ||
        src.file.name.toLowerCase().endsWith(".docx"))
    ) {
      // Binary files — let the backend extract text
      formData.append("file", src.file);
    } else if (src.text && !src.text.startsWith("[Document:")) {
      // TXT/MD or pasted text
      const existing = formData.get("text") as string | null;
      formData.set(
        "text",
        existing ? existing + "\n\n---\n\n" + src.text : src.text
      );
    }
  }

  const res = await fetch(
    `${BASE_URL}/api/stories/generate-from-requirements`,
    {
      method: "POST",
      credentials: "include",
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error ?? `Server returned ${res.status}`);
  }

  const data = await res.json();
  const rawStories: GeneratedStory[] = (data.stories ?? []).map(
    (s: any, i: number) => ({
      id: s.id ?? `gen-${i + 1}`,
      title: s.title ?? `Story ${i + 1}`,
      narrative: s.narrative ?? "",
      acceptanceCriteria: Array.isArray(s.acceptance_criteria)
        ? s.acceptance_criteria
        : [],
      status: "draft" as StoryStatus,
    })
  );

  // Build ExtractedAnalysis from the stories for the UI breakdown panel
  return {
    features: rawStories.map((s) => s.title),
    actors: [],
    businessRules: [],
    acceptanceCriteria: rawStories.flatMap((s) => s.acceptanceCriteria).slice(0, 10),
    _rawStories: rawStories,
  };
}

/**
 * Convert analysis into GeneratedStory objects for the review step.
 * Since the backend already generated the stories during analysis, just return them.
 */
export async function generateStories(
  analysis: ExtractedAnalysis
): Promise<GeneratedStory[]> {
  if (analysis._rawStories && analysis._rawStories.length > 0) {
    return analysis._rawStories;
  }
  // Fallback
  return analysis.features.map((f, i) => ({
    id: `gen-${i + 1}`,
    title: f,
    narrative: `As a user, I want to ${f.toLowerCase()} so that I can achieve my goal.`,
    acceptanceCriteria: ["The feature must work as described."],
    status: "draft" as StoryStatus,
  }));
}

/**
 * Regenerate a single story using the RAG chat endpoint.
 */
export async function regenerateStory(
  story: GeneratedStory,
  _analysis: ExtractedAnalysis
): Promise<GeneratedStory> {
  try {
    const res = await fetch(`${BASE_URL}/api/stories/rag-chat`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `Rewrite this user story with better, more specific acceptance criteria:\nTitle: ${story.title}\nNarrative: ${story.narrative}`,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const tcs = data.testCases ?? [];
      if (tcs.length > 0) {
        return {
          ...story,
          acceptanceCriteria: tcs
            .slice(0, 5)
            .map((tc: any) => String(tc.title ?? "")),
          status: "draft",
        };
      }
    }
  } catch {}

  // Return original if regeneration fails
  return { ...story, status: "draft" };
}
