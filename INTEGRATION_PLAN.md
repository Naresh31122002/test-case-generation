# INTEGRATION_PLAN.md

Reconciliation of SPEC.md (frontend design) against BACKEND_CONTRACT.md (existing backend).
Produced before any integration code is written — review and approve this first.

---

## Gap 1 — Coverage tab: per-category breakdown & named coverage gaps

**What SPEC wants (§7.3):**
- Overall coverage % ring
- Per-type bars: Functional 100% · Negative 85% · Boundary 70% · Security 60% · Accessibility 30%
- Named coverage gaps list: Session Timeout, Rate Limiting, Token Expiry, etc.
- "Generate Missing Tests" CTA

**What the backend actually has:**
- `impacted_test_cases_count` / `impact_percentage` — fraction of test cases that were modified by a newer story. This is an *impact* metric, not a *coverage* metric. The two are different concepts.
- `test_case_json.test_cases[]` — flat list of test cases. Each has `id`, `title`, `steps`, `expected_result`, `priority`. **No `category` or `type` field is stored.**
- The backend generator produces categories internally (positive, negative, boundary, security, performance) but does not label them in the output.
- No coverage-gap analysis endpoint exists anywhere.

**Why option (a) — derive from existing data — is not viable for v1:**
- Categories are not persisted on test cases. Heuristic keyword classification (e.g. match "security", "injection" → Security) would be fragile and wrong ~20–30% of the time.
- Named gaps (Session Timeout, Rate Limiting) require a dedicated LLM call that doesn't exist. They cannot be derived from titles or step text reliably.
- `impact_percentage` measures how many tests were *changed by a newer story*, which is unrelated to how many *scenarios are untested*.

**Decision: option (b) — v1 frontend-only mock for coverage tab, with a specific v2 upgrade path.**

### V1 implementation

**What to render for v1:**

1. **Overall coverage %** — compute as a heuristic: `Math.round((test_case_count / expectedCountForComplexity) * 100)` capped at 100, where `expectedCountForComplexity` is a fixed lookup (low → 23, medium → 40, high → 60). This gives a rough "how full is the test suite" number. Label it clearly as an estimate in tooltip text: "Approximate — based on test count vs. expected range."

2. **Per-type bars** — derive by running a one-pass keyword classifier over `testcases[].title` client-side at render time:

   ```ts
   function inferCategory(title: string): TestCategory {
     const t = title.toLowerCase();
     if (/\b(security|auth|inject|xss|csrf|permission|privilege|token|bypass)\b/.test(t)) return 'security';
     if (/\b(boundary|limit|max|min|overflow|empty|null|zero|exceed)\b/.test(t)) return 'boundary';
     if (/\b(invalid|fail|error|reject|wrong|missing|incorrect|denied|not found)\b/.test(t)) return 'negative';
     if (/\b(performance|load|response.?time|concurrent|throughput|timeout|latency)\b/.test(t)) return 'performance';
     return 'functional';
   }
   ```

   Coverage per type = `(classified count / expected count for that type)` × 100, capped at 100. Mark this with a `(estimated)` badge in the UI so QA engineers are not misled.

3. **Named coverage gaps** — **do not attempt to derive these from existing data**. Replace the gap list with a static prompt panel:

   > "Detailed coverage gap analysis is not yet available. Use the AI assistant below to ask 'What test scenarios are missing for this story?' — the assistant can suggest gaps based on the story content."

   This is honest, not empty, and points users to the working RAG assistant.

4. **"Generate Missing Tests" button** — keep the button. On click, send the query `"What test cases are missing for this story: <story_description>"` to `POST /api/stories/rag-chat` and append the returned tests to the test list. This is not perfect (it generates from similar stories, not a true gap analysis) but it is functional and grounded in real backend behavior.

### V2 upgrade path

The backend needs one new endpoint: `GET /api/stories/<story_id>/coverage?project_id=X` which calls an LLM with the story content + existing test cases and returns:

```json
{
  "overall_percentage": 72,
  "by_type": { "functional": 95, "negative": 80, "boundary": 65, "security": 55, "performance": 40 },
  "gaps": [
    { "id": "gap-1", "title": "Session Timeout", "severity": "medium", "type": "security" }
  ]
}
```

Build the Coverage tab so that v2 simply swaps the heuristic computation for this endpoint response — same shape, same components.

### Additional mismatch flagged

SPEC names 5 test types: Functional, Negative, Boundary, Security, **Accessibility**.
Backend generates: positive, negative, boundary, security, **performance**.

**Accessibility does not exist in the backend.** Performance exists in the backend but not in SPEC §7.3's breakdown bars.

**Decision:** Map `performance` → "Performance" in the UI and add it as a 6th bar. Remove "Accessibility" from Coverage tab in v1 — do not show a bar for a type that is never generated. Note this in SPEC as an in-scope change from the original design.

---

## Gap 2 — Changes screen: Accept/Reject/Edit workflow

**⚠ Highest-risk gap in this entire reconciliation.**

**What SPEC wants (§8):**
- `/changes` list: Change Requests grouped by story, filterable by Pending/Approved/Rejected
- `/changes/:id` review page: per-test Accept/Reject/Edit actions
- **Partial acceptance**: accept 7, reject 2, edit 1 in one submission
- On submit: accepted tests become active, rejected keep original, story version increments
- Change Request status → Approved (partial OK) or Rejected (all rejected)

**What the backend actually has:**
- `test_case_impacts` table with `impact_status` = `'active'` or `'inactive'` — binary flag, no accept/reject semantic
- `impact_history` table — logs `previous_status` / `new_status` / `change_reason`, but only `'active'` and `'inactive'` values have been used
- No endpoint to toggle or batch-review impact status
- No "Change Request" concept as an entity
- No version-bump mechanism

**Why frontend-only stub is not sufficient here:**

The Changes screen is a primary navigation item in the sidebar (§3). Showing it as non-functional in v1 would damage the product's core "approval center" pitch. A frontend-only state (React `useState`) resets on reload and is unusable by teams. This gap needs **minimal backend endpoints before the Changes screen can ship**.

### Smallest backend change required

Add three endpoints (proposed as a backend task, not frontend work):

**1. `POST /api/stories/impacts/<impact_id>/review`**

```json
// Request
{
  "action": "accept" | "reject" | "edit",
  "edited_test_case": {               // only required when action = "edit"
    "title": "string",
    "steps": ["string"],
    "expected_result": "string",
    "priority": "High" | "Medium" | "Low"
  }
}

// Response 200
{
  "impact_id": "uuid",
  "new_status": "accepted" | "rejected",
  "message": "Impact review recorded"
}
```

Backend implementation: extend `impact_status` CHECK constraint to include `'accepted'` and `'rejected'`; write to `impact_history` with `changed_by = user_id`, `change_reason = "user_review"`.

**2. `POST /api/stories/impacts/batch-review`**

```json
// Request
{
  "project_id": "my-project",
  "new_story_id": "STORY-002",   // the "change request" = all impacts from this story
  "reviews": [
    { "impact_id": "uuid", "action": "accept" },
    { "impact_id": "uuid", "action": "reject" },
    { "impact_id": "uuid", "action": "edit", "edited_test_case": { ... } }
  ]
}

// Response 202
{
  "message": "Review submitted",
  "accepted": 7,
  "rejected": 2,
  "edited": 1,
  "change_request_status": "approved"  // "approved" if ≥1 accepted, "rejected" if all rejected
}
```

**3. `GET /api/stories/changes`** (new list endpoint)

```
// Query: ?project_id=my-project&status=pending|approved|rejected|all&page=1&per_page=20

// Response 200
{
  "changes": [
    {
      "change_id": "STORY-002",       // the new_story_id, used as the change request ID
      "new_story_id": "STORY-002",
      "new_story_description": "OAuth Login Update",
      "project_id": "my-project",
      "created_on": "2024-01-15T11:00:00",
      "stories_affected": 3,
      "tests_affected": 18,
      "overall_severity": "high",
      "status": "pending",            // derived: if all impacts active+unreviewed → pending, etc.
      "impacts": [...]
    }
  ],
  "pagination": { "total": 5, "page": 1, "per_page": 20, "total_pages": 1 }
}
```

### V1 interim while backend is not yet ready

Build the Changes UI components in full, but gate the `/changes` route with a banner:

> "Change review is in development. Impact analysis data is available on each story's Impact tab."

Link from each story's Impact tab to the Changes page with pre-filled `?story_id=X`. This gives QA leads a usable path without a dead /changes route.

Do NOT silently leave the Changes route at 404 — that makes the product feel broken.

### Frontend mapping of existing data to Change Requests (without new backend endpoints)

Until the new endpoints ship, `/changes` can be partially populated using:
- `GET /api/stories/impacts/<project_id>` — groups impacts by `new_story_id` to form change request cards
- Status derived as: if all impacts for that `new_story_id` have `impact_status = 'inactive'` → "Inactive"; otherwise → "Pending"
- The review actions (Accept/Reject) will be no-ops until the new endpoint ships — render them as disabled buttons with tooltip "Review coming in next release"

---

## Gap 3 — Story version history

**What SPEC wants (§7.4, §8.4):**
- Version chips: v1 May 1 / v2 May 14 (current)
- Click any version → see tests, coverage, diff as of that version
- On Change Request submission → version increments for affected stories

**What the backend has:**
- Re-upload hits `ON CONFLICT (story_id, user_id) DO UPDATE` — old story content and test cases are **overwritten with no history**
- `test_case_impacts` has `impact_version` (integer, starts at 1, increments per chain) and `previous_impact_id` — but this tracks test case modification chains, not story content versions
- No `story_versions` table, no archived content

**Cannot reconstruct full version history from existing data.** The LanceDB record for a story is also overwritten on re-upload.

**Decision: drop full story version history from v1.**

What to show instead:

**In the Story Workspace header (§7):** Remove "v2 · Updated 2h ago" version chip. Replace with just "Updated 2h ago" (relative time from `test_case_created_time`).

**In the Impact tab version selector chips (§7.4):** Remove "v1 May 1 / v2 May 14" version picker. Replace with a single "Impact Analysis" label. Show the impact summary for the current version only.

**In Change Review page (§8.4):** Remove the version history table entirely. Replace with "Impact timeline" — a chronological list of impact events derived from `test_case_impacts.impact_created_on` grouped by `new_story_id`. This shows *when* each cross-story event happened without needing versioned story content.

**Version bump language:** Remove all references to "story version increments" from the UI. On Change Request approval, the confirmation message reads "Changes applied to test suite" not "Story updated to v3."

**V2 upgrade path:** Add a `story_versions` table to the backend (story_id, version_number, content_snapshot, created_on, created_by). The upload endpoint upserts current + inserts a new version row. Version selector chips then read from this table. This is additive and backward-compatible.

---

## Gap 4 — Authentication: credentials-include, cookie-only

**Decision: confirmed, no deviation.**

The API client module (`lib/api.ts` or `lib/apiClient.ts`) must:

1. Set `credentials: 'include'` on **every** request — without exception. This is the only way the `access_token_cookie` and `refresh_token_cookie` are sent.

2. Never read, write, or reference `localStorage`, `sessionStorage`, or `document.cookie` for auth tokens. The browser manages cookies; the frontend never touches them directly.

3. Never set `Authorization: Bearer ...` header. The backend does not read it — JWT is cookie-only.

4. Implement a **401 interceptor**: on any `401` response, call `POST /api/auth/refresh` (which also uses the cookie), then retry the original request once. If the refresh call itself returns `401`, redirect to `/login`.

5. The base URL should come from an env variable (`NEXT_PUBLIC_API_URL`) so it works locally against `http://localhost:5000` and in production against the deployed backend URL.

**Example canonical client setup (for reference — not final code):**

```ts
// lib/apiClient.ts
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',                        // REQUIRED — never remove
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (res.status === 401) {
    await fetch(`${BASE}/api/auth/refresh`, { method: 'POST', credentials: 'include' });
    return request(path, init);                    // retry once
  }
  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

For file uploads (`POST /api/stories/upload`, which is `multipart/form-data`): do not set `Content-Type` manually — let the browser set it with the correct boundary. Do keep `credentials: 'include'`.

---

## Gap 5 — Broken download_link field

**The `download_link` field returned in every story object points to `/api/stories/download/<story_id>` — this route does not exist.** The actual working download route is `/api/stories/testcases/download/<story_id>`.

**Decision: ignore `download_link` entirely; never use it.**

In the API client's story response normalizer, strip `download_link` from the normalized Story type and replace it with a computed property:

```ts
function normalizeStory(raw: RawStory): Story {
  return {
    // ... other fields
    downloadUrl: `/api/stories/testcases/download/${raw.id}`,  // computed, not from field
    // download_link is intentionally dropped — it is wrong in the backend response
  };
}
```

The Export tab (`/stories/:id/export`) and Exports page (`/exports`) must call the correct URL directly, never the `download_link` field.

---

## Gap 6 — Route collision at /impacts/details/<id>

**Two different handlers share the same Flask route pattern — do not use this route.**

- `GET /api/stories/impacts/details/<impact_id>` (impact-level detail — requires an impact UUID)
- `GET /api/stories/impacts/details/<story_id>` (story-level detail — requires `?project_id=`)

Flask resolves this by registering whichever was defined first in the file. The behavior is unpredictable and may change if the backend is refactored.

**Decision: never call `/api/stories/impacts/details/...` from the frontend.**

Use these routes instead:

| What you need | Route to use |
|---|---|
| All impacts for a story (both directions) | `GET /api/stories/impacts/story/<story_id>` |
| Per-test-case impact breakdown for a story | `GET /api/stories/impacts/story-test-cases/<story_id>?project_id=X` |
| All impacts in a project | `GET /api/stories/impacts/<project_id>` |
| Summary view for a project | `GET /api/stories/impacts/summary/<project_id>` |

If individual impact record detail is genuinely needed (e.g. to show a full diff), the data is already embedded inside the `impact_analysis_json` field of each impact object returned by the above routes — no separate detail call is required.

---

## Gap 7 — Field normalization layer

All raw backend responses pass through a normalization layer in the API client before any component sees them. Components never import raw API types — only normalized types from `types/domain.ts`.

### Normalized `Story` type

| Frontend field | Source | Transformation |
|---|---|---|
| `id` | `raw.id` | string, as-is |
| `description` | `raw.description` | string |
| `projectId` | `raw.project_id` | camelCase rename |
| `testCaseCount` | `raw.test_case_count` | `Number(raw.test_case_count)` — ensure number |
| `impactedTestCasesCount` | `raw.impactedTestCases ?? raw.impacted_test_cases_count ?? 0` | coerce to number; only one field on normalized type |
| `testCaseCreatedTime` | `raw.test_case_created_time` | ISO string |
| `embeddingTimestamp` | `raw.embedding_timestamp` | ISO string or null |
| `docContentText` | `raw.doc_content_text` | string or null |
| `source` | `raw.source` | `{ story: string; testCases: string }` |
| `downloadUrl` | computed | `/api/stories/testcases/download/${raw.id}` — NOT from `raw.download_link` |
| ~~`download_link`~~ | dropped | never exposed |
| ~~`impactedTestCases`~~ | dropped | merged into `impactedTestCasesCount` |
| ~~`impacted_test_cases_count`~~ | dropped | merged into `impactedTestCasesCount` |

### Normalized `TestCase` type

All endpoints that return test cases must produce this shape after normalization:

```ts
interface TestCase {
  id: string;                  // "STORY-001-TC1"
  title: string;
  steps: string[];             // always array — normalizer handles the "test_steps" alias
  expectedResult: string;      // camelCase from "expected_result"
  priority: 'High' | 'Medium' | 'Low';
  severity?: 'High' | 'Medium' | 'Low';  // present only from single-test endpoint
}
```

The single-test endpoint (`/stories/:id/test-cases/:tc_id`) returns `test_steps` — normalize to `steps` in the client before any component sees it.

### Normalized `TestCaseList` response (from `GET /api/stories/:id/testcases`)

```ts
interface TestCaseListResponse {
  storyId: string;             // from "storyID"
  description: string;         // from "storyDescription"
  projectId: string;           // from "project_id"
  testCases: TestCase[];       // from "testcases" array
}
```

### Normalized `Impact` type

```ts
interface Impact {
  impactId: string;
  newStoryId: string;
  originalStoryId: string;
  originalTestCaseId: string;
  modifiedTestCaseId: string;
  createdOn: string;           // ISO
  severity: 'high' | 'medium' | 'low';    // lowercase — backend stores lowercase
  priority: number;            // 1–5, always number
  status: 'active' | 'inactive';
  impactDetails: {
    modificationReason: string;
    severityReason: string;
    changes: { title: string; steps: string[]; expectedResult: string };
  };
  analysisJson: ImpactAnalysisJson;
}
```

### Normalized `StoryTestCaseImpacts` response (from `story-test-cases` endpoint)

This endpoint returns string-typed numbers — all coerced on normalization:

```ts
interface StoryTestCaseImpacts {
  storyId: string;
  description: string;
  totalTestCases: number;                // Number("25") → 25
  impactedTestCasesCount: number;        // Number("3") → 3
  impactPercentage: number;              // Number("12.0") → 12
  severitySummary: { high: number; medium: number; low: number };
  testCases: ImpactedTestCase[];
}
```

### Normalized pagination

All paginated responses normalize to:

```ts
interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    perPage: number;
    totalPages: number;
  };
}
```

The stories list uses `stories` key; map it to `data` in the normalizer.

---

## Gap 8 — Polling strategy (no WebSocket/SSE)

### What needs polling

Two separate async processes run in the backend after a story upload:
1. **Test case generation** — synchronous in the upload handler, but can be slow (10–30 seconds). The upload response already has `test_cases_generated: true/false`. However, the upload itself may timeout or the check may be done before generation completes.
2. **Impact analysis** — runs in a **background daemon thread** after test cases are generated. Upload returns `200` immediately; results appear seconds to minutes later. No notification mechanism exists.

### Decision: per-story polling hook on the workspace page

Do not implement a global background poller. Implement a `useStoryPolling(storyId)` hook that activates contextually:

**Trigger conditions:** polling starts automatically when:
- User navigates to `/stories/:id` and `testCaseCount === 0`  
- User navigates to `/stories/:id` and `impactedTestCasesCount === 0` AND `testCaseCount > 0` (tests exist but impact not yet run)
- User just completed the Create Story wizard (pass a `?analyzing=true` query param)

**What to poll:** `GET /api/stories/<story_id>` — cheapest call, returns both `testCaseCount` and `impactedTestCasesCount`. When test cases appear, also fetch `GET /api/stories/<story_id>/testcases` to populate the Tests tab.

**Interval:** 4 seconds. This is fast enough to feel responsive, not aggressive enough to hammer the server.

**Timeout:** stop polling after 120 seconds regardless of result. Show a non-blocking notice: "Analysis is taking longer than expected. Refresh to check for updates." Do not show an error toast — the job may still complete.

**Stop conditions:**
- `testCaseCount > 0` AND (`impactedTestCasesCount > 0` OR 60 seconds have elapsed since test cases appeared)
- Hard timeout at 120 seconds
- User navigates away (cleanup in `useEffect` return)

**Progress UI:** while polling, show the "Analyzing…" status chip (animated pulse dot per §5). Show "Generating tests…" label when `testCaseCount === 0`, "Analyzing impact…" when tests exist but impact count is still 0. When both are present, stop polling and swap to the "Ready" or "Impact Detected" chip.

**Scheduler-level refresh (stories list page):** also poll `GET /api/stories/next-reload` on the `/stories` page at a 60-second interval. When `Date.now() > Date.parse(next_reload)`, refetch the stories list silently (no visual jump — update in place). This keeps Jira-synced stories appearing without manual refresh. This poller lives in the Stories page component only, not globally.

### Implementation location

```
hooks/
  useStoryPolling.ts         — per-story polling hook (workspace page)
  useSchedulerSync.ts        — next-reload polling hook (stories list page only)
```

Components import these hooks and do not contain polling logic directly.

### What NOT to poll

Do not add polling to the `/changes` page, `/coverage` page, or `/exports` page. Data on those pages is static until the user takes an action. A manual refresh button is sufficient.

---

## Additional gaps found (not in the 8 items)

These were discovered during reconciliation and need design decisions:

### A. Story quality score has no backend equivalent

SPEC §6.3 and §7.1 show a quality score (87/100), Completeness/Clarity/Testability bars, and AI-generated issues.

The backend has no quality analysis endpoint. `/api/stories/upload` returns a description but no quality metrics.

**Decision for v1:** the Create Story step 3 "analysis complete" screen should use the RAG chat endpoint (`POST /api/stories/rag-chat`) with a prompt like `"Analyze this story for quality: <content>"` to get AI feedback. The quality score ring (87/100) and precise sub-scores (Completeness 80%, Clarity 95%) have no data source — render them as static placeholders or remove them from v1. The issues list can be populated from the RAG response text. Flag this as requiring a dedicated `/api/stories/<story_id>/quality` endpoint in v2.

### B. SPEC's test type "Accessibility" is not generated by the backend

SPEC §6.2 includes Accessibility as a test type checkbox. Backend generates: positive, negative, boundary, security, performance.

**Decision:** Remove the Accessibility checkbox from Step 2 of Create Story in v1. Add Performance in its place (matching the backend). Note it in the UI: "Accessibility testing — coming in a future update."

### C. Story card "Coverage" ring on the stories list has no data source

SPEC §5 shows a coverage ring on each story card alongside test count. The `GET /api/stories/` response returns `test_case_count` and `impactedTestCasesCount` but no coverage percentage.

**Decision:** Use the heuristic coverage % described in Gap 1 (test count vs. expected count), computed client-side from the `test_case_count` field. This is an approximation but gives the UI the number it needs for the ring.

### D. Compare screen (`/compare`) has no backend compare endpoint

SPEC §10 describes a side-by-side story comparison. The backend has `POST /api/stories/search` (vector similarity) but no dedicated compare endpoint.

**Decision:** The Compare screen fetches each story's test cases independently via `GET /api/stories/<id>/testcases` for Story A and Story B. Client-side diff logic (title matching + substring similarity) populates "Only in A," "Only in B," "Similar in Both." Delta cards (Added/Removed/Coverage Delta) are computed locally. No backend changes needed for v1.

### E. Inline AI assistant — not all prompts have matching endpoints

SPEC §13 places AI input boxes on Overview, Tests, Coverage, Impact, and Changes. The only backend AI endpoint is `POST /api/stories/rag-chat` (returns test cases from similar stories).

**Decision:** All AI assistant inputs in v1 send to `/api/stories/rag-chat`. The query is prefixed with context based on location (e.g., Coverage tab: `"What test cases are missing for this story: <description>"`). This is not a perfect fit — the endpoint returns test case objects, not free-form analysis. Display the returned test cases in a result card. Dedicated per-context LLM endpoints are v2 scope.

### F. Export formats beyond Excel are not implemented in the backend

SPEC §7.5 lists Playwright, Cypress, PyTest, BDD, Selenium, Postman. The backend only exports Excel (`.xlsx`) via `GET /api/stories/testcases/download/<story_id>`.

**Decision:** The Export tab in v1 only shows one format card: "Excel (.xlsx)" which uses the backend endpoint. All other format cards (Playwright, Cypress, etc.) are rendered as disabled chips with "In development" tooltip. The code preview block shows a generic JSON representation of the test cases.

---

## Implementation order

Based on risk and dependency:

| Phase | Work | Blocking? |
|---|---|---|
| 1 | API client with credentials, normalizers, 401 refresh (Gap 4, 7) | Yes — everything depends on this |
| 2 | Stories list + Create Story wizard (no Changes, no Coverage analysis) | No |
| 3 | Story Workspace: Overview, Tests, Export tabs | No |
| 4 | Polling hook (Gap 8) | No — enhances UX |
| 5 | Impact tab using `story-test-cases` and `impacts/story` routes (Gap 6) | No |
| 6 | Coverage tab with heuristic approximation (Gap 1) | No |
| 7 | Changes — banner/interim view using existing impact data (Gap 2) | No |
| 8 | **Backend: review endpoints** (Gap 2 — 3 new endpoints) | **Blocks full Changes screen** |
| 9 | Changes — full review page once backend endpoints are ready | Blocked on phase 8 |
| 10 | Version history — drop in v1, design backend table in parallel | N/A for v1 |
