// Generates clean story IDs like PRJ-001, EXP-002, etc.
// Format: 3-letter code from project name + 3-digit zero-padded counter
// Counter is persisted in localStorage per project so IDs are always unique.

const COUNTER_KEY_PREFIX = "testsurge:story-counter:";

function projectCode(projectId: string): string {
  // Take the first 3 meaningful letters from the project ID/name
  // e.g. "auth-platform" -> "AUT", "ecommerce" -> "ECO", "proj-abc123" -> "PRJ"
  const clean = projectId
    .replace(/[^a-zA-Z0-9]/g, " ")
    .trim()
    .split(/\s+/);

  let letters = "";
  for (const word of clean) {
    letters += word.replace(/[^a-zA-Z]/g, "");
    if (letters.length >= 3) break;
  }

  // Pad to exactly 3 letters, uppercase
  letters = letters.toUpperCase().slice(0, 3);
  while (letters.length < 3) letters += "X";
  return letters;
}

function nextCounter(key: string): number {
  try {
    const stored = localStorage.getItem(key);
    const current = stored ? parseInt(stored, 10) : 0;
    const next = current + 1;
    localStorage.setItem(key, String(next));
    return next;
  } catch {
    // localStorage unavailable (SSR) — use timestamp-based fallback
    return Math.floor(Date.now() / 1000) % 1000 || 1;
  }
}

export function makeStoryId(projectId = "PRJ"): string {
  const code = projectCode(projectId);
  const key = `${COUNTER_KEY_PREFIX}${code}`;
  const num = nextCounter(key);
  return `${code}-${String(num).padStart(3, "0")}`;
}
