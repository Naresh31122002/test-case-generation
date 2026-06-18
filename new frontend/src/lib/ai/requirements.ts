/**
 * Requirements → User Stories service (Path B of Story Creation).
 *
 * This is the single backend entry point for the "Generate User Stories From
 * Requirements" flow. Today it is mock-backed (deterministic, derived from the
 * actual document text the user provides — never from nothing), but it is shaped
 * as a real service so it can be swapped for a live AI endpoint without touching
 * the UI: replace the body of `analyzeRequirements` / `generateStories` with a
 * `fetch()` to your API and keep the same return contracts.
 *
 * Hard rules enforced here:
 *   - Input is validated BEFORE any generation (logs, stack traces, empty/junk
 *     are rejected with meaningful messages).
 *   - No story is ever fabricated from console output or invalid content.
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
  /** File name or "Pasted text". */
  name: string;
  /** Raw text content (already extracted from txt/md, or returned by the backend for pdf/docx). */
  text: string;
}

export interface ExtractedAnalysis {
  features: string[];
  actors: string[];
  businessRules: string[];
  acceptanceCriteria: string[];
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
  /** Human-readable reasons when invalid. */
  messages: string[];
}

/* ─────────────────────────── Validation ─────────────────────────── */

const MIN_DOC_CHARS = 120;
const MIN_WORDS = 25;

/** Signatures of terminal output / stack traces / code dumps — never valid requirements. */
const JUNK_PATTERNS: { test: RegExp; reason: string }[] = [
  { test: /^\s*at\s+.+\(.+:\d+:\d+\)/m, reason: "Looks like a JavaScript stack trace, not requirements." },
  { test: /(Error|Exception|Traceback)\b.*(:|\n)/m, reason: "Contains error/exception output rather than requirements." },
  { test: /Traceback \(most recent call last\)/, reason: "Contains a Python traceback, not requirements." },
  { test: /\b(npm|yarn|pnpm)\s+(run|install|err)/i, reason: "Looks like terminal/npm output." },
  { test: /^\s*(\$|>|PS [A-Z]:\\)/m, reason: "Looks like a shell/terminal log." },
  { test: /EADDRINUSE|ECONNREFUSED|ENOENT|MODULE_NOT_FOUND|Cannot find module/, reason: "Contains runtime/system error logs." },
  { test: /\b\d{2}:\d{2}:\d{2}(\.\d+)?\s+(INFO|WARN|ERROR|DEBUG|TRACE)\b/, reason: "Looks like timestamped application logs." },
  { test: /webpack|node_modules|HMR|hot-reload/i, reason: "Looks like build/bundler output." },
];

/** Validate a single requirement source before it can be analyzed. */
export function validateSource(src: RequirementSource): ValidationResult {
  const messages: string[] = [];
  const text = src.text.trim();

  if (text.length === 0) {
    return { valid: false, messages: [`"${src.name}" is empty.`] };
  }
  if (text.length < MIN_DOC_CHARS) {
    messages.push(`"${src.name}" is too short to be a requirement document (min ${MIN_DOC_CHARS} characters).`);
  }
  if (text.split(/\s+/).filter(Boolean).length < MIN_WORDS) {
    messages.push(`"${src.name}" doesn't contain enough prose to extract requirements.`);
  }

  // Reject terminal logs / stack traces / code dumps outright.
  for (const { test, reason } of JUNK_PATTERNS) {
    if (test.test(text)) {
      messages.push(`"${src.name}": ${reason}`);
      break;
    }
  }

  // Heuristic: requirements read like prose. If almost no sentence-like lines exist, reject.
  const proseLines = text.split("\n").filter((l) => /[a-z]{3,}.*\b(shall|must|should|will|the|a|an|user|system|when|allow|able|support)\b/i.test(l));
  if (proseLines.length === 0 && messages.length === 0) {
    messages.push(`"${src.name}" doesn't look like a requirements document.`);
  }

  return { valid: messages.length === 0, messages };
}

/** Validate all sources; returns combined result. */
export function validateSources(sources: RequirementSource[]): ValidationResult {
  if (sources.length === 0) {
    return { valid: false, messages: ["Add at least one requirement document or paste requirements."] };
  }
  const messages: string[] = [];
  let anyValid = false;
  for (const s of sources) {
    const r = validateSource(s);
    if (r.valid) anyValid = true;
    else messages.push(...r.messages);
  }
  // If at least one source is valid, we can proceed (invalid ones are surfaced as warnings).
  return { valid: anyValid, messages };
}

/* ─────────────────────────── Extraction (mock-backed) ─────────────────────────── */

const sentenceSplit = (t: string) =>
  t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 12);

const unique = (arr: string[]) => Array.from(new Set(arr.map((s) => s.trim()))).filter(Boolean);

/**
 * Analyze requirement text → features / actors / business rules / acceptance
 * criteria. Mock implementation derives everything from the ACTUAL text — it
 * returns nothing if the text yields nothing, so junk never produces output.
 *
 * Swap with: `return fetch('/api/requirements/analyze', { ... }).then(r => r.json())`
 */
export async function analyzeRequirements(sources: RequirementSource[]): Promise<ExtractedAnalysis> {
  await delay(900);
  const text = sources.map((s) => s.text).join("\n");
  const sentences = sentenceSplit(text);

  const actorRe = /\b(?:as an?|the)\s+([a-z][a-z ]{2,24}?)\s+(?:can|should|must|will|wants?|needs?|is able to)\b/gi;
  const actors = unique(
    Array.from(text.matchAll(actorRe)).map((m) => titleCase(m[1]))
  ).slice(0, 8);

  const ruleRe = /[^.!?\n]*\b(must|shall|should not|cannot|is required to|may not|only)\b[^.!?\n]*[.!?]/gi;
  const businessRules = unique(Array.from(text.matchAll(ruleRe)).map((m) => m[0].trim())).slice(0, 12);

  const featureRe = /\b(?:ability to|able to|support for|feature[:]?|allow(?:s|ing)? (?:the )?user to|provide[s]?)\s+([a-z][^.!?\n]{6,60})/gi;
  const features = unique(
    Array.from(text.matchAll(featureRe)).map((m) => sentenceCase(m[1]))
  ).slice(0, 12);

  const criteria = unique(
    sentences.filter((s) => /\b(should|must|when|given|then|verify|ensure|display|return|show|allow)\b/i.test(s))
  ).slice(0, 12);

  return { features, actors, businessRules, acceptanceCriteria: criteria };
}

/**
 * Generate structured user stories from the analysis. One story per detected
 * feature (or per actor if no features), each grounded in the extracted criteria.
 *
 * Swap with a real endpoint that returns the same `GeneratedStory[]` shape.
 */
export async function generateStories(
  analysis: ExtractedAnalysis,
  opts: { count?: number } = {}
): Promise<GeneratedStory[]> {
  await delay(1200);

  const actor = analysis.actors[0] ?? "user";
  const basis = analysis.features.length > 0 ? analysis.features : analysis.actors.map((a) => `${a} workflow`);
  const max = opts.count ?? basis.length;

  const stories: GeneratedStory[] = basis.slice(0, max).map((feature, i) => {
    const ac = analysis.acceptanceCriteria
      .filter((_, idx) => idx % Math.max(1, basis.length) === i % Math.max(1, basis.length))
      .slice(0, 3);
    return {
      id: `gen-${Date.now().toString(36)}-${i}`,
      title: sentenceCase(feature),
      narrative: `As a ${actor.toLowerCase()}, I want to ${lcFirst(feature)} so that I can achieve the related business outcome.`,
      acceptanceCriteria: ac.length > 0 ? ac : ["The behavior is implemented as described in the requirements."],
      status: "draft",
    };
  });

  return stories;
}

/** Regenerate a single story (e.g. after the user rejects it). */
export async function regenerateStory(
  story: GeneratedStory,
  analysis: ExtractedAnalysis
): Promise<GeneratedStory> {
  await delay(700);
  const actor = analysis.actors[0] ?? "user";
  return {
    ...story,
    id: `gen-${Date.now().toString(36)}`,
    narrative: `As a ${actor.toLowerCase()}, I want to ${lcFirst(story.title)} so that the requirement is satisfied with clear, testable behavior.`,
    acceptanceCriteria:
      analysis.acceptanceCriteria.slice(0, 3).length > 0
        ? analysis.acceptanceCriteria.slice(0, 3)
        : story.acceptanceCriteria,
    status: "draft",
  };
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
function titleCase(s: string) {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase());
}
function sentenceCase(s: string) {
  const t = s.trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function lcFirst(s: string) {
  const t = s.trim();
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** Read text from a File. txt/md are read directly; pdf/docx are sent to the backend. */
export async function readSourceText(file: File): Promise<RequirementSource> {
  const name = file.name;
  const lower = name.toLowerCase();
  if (lower.endsWith(".txt") || lower.endsWith(".md")) {
    const text = await file.text();
    return { name, text };
  }
  // pdf / docx: in a real deployment the backend extracts text. For now we
  // upload-and-extract via the (mock) service. We read whatever text we can.
  try {
    const text = await file.text();
    return { name, text };
  } catch {
    return { name, text: "" };
  }
}
