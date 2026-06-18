# BACKEND_CONTRACT.md

Complete integration reference for the TestSurge / TestForge backend.
Derived from reading the source code directly — no assumptions.
Items flagged **UNCLEAR — needs confirmation** are genuinely ambiguous in the code.

---

## 1. Base URL & Environment Setup

| Environment | Base URL |
|---|---|
| Development (local) | `http://localhost:5000` |
| Production | **UNCLEAR — needs confirmation** (the `.env.production.template` references `FRONTEND_URL=https://testforge.kynetropo.com` but does not name the backend's own domain; the backend is likely hosted on Railway at a separate URL) |

All API routes are prefixed with `/api`.

**Runtime:** Python 3.x · Flask 3.0.2 · Gunicorn (production)

**Environment variables required at startup:**

```
POSTGRES_HOST, POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_PORT
GROQ_API_KEY                # LLM for test case generation
GROQ_API_KEY_IMPACT         # LLM for impact analysis (falls back to GROQ_API_KEY if unset)
GOOGLE_GENERATIVE_AI_API_KEY  # Google text-embedding-004 (embeddings)
LANCE_DB_PATH               # Path to LanceDB directory (default: ./data/lance_db)
TABLE_NAME_LANCE            # LanceDB table name (default: user_stories)
JWT_SECRET_KEY              # Must be a strong random secret in production
FLASK_ENV                   # "production" enables secure cookies
FRONTEND_URL                # Canonical frontend origin for CORS
VERCEL_URL                  # Optional: Vercel preview deploy origin for CORS
```

---

## 2. Authentication

### Mechanism

JWT-based authentication stored in **HTTP-only cookies** (not the Authorization header).

| Cookie | Purpose |
|---|---|
| `access_token_cookie` | Short-lived access token (15 minutes) |
| `refresh_token_cookie` | Long-lived refresh token (7 days) |

**Important for frontend:**
- All auth cookies are set via `Set-Cookie` by the server — the client never handles raw tokens.
- `JWT_COOKIE_SAMESITE = "Lax"` — cookies are sent on top-level navigations.
- `JWT_COOKIE_SECURE = True` **only** when `FLASK_ENV=production`. In dev, cookies are sent over plain HTTP.
- `JWT_COOKIE_CSRF_PROTECT = False` — no double-submit CSRF token is required.
- CORS is configured with `"supports_credentials": True`, so the frontend must send `credentials: "include"` on every fetch.

### Obtaining a Token (Login Flow)

`POST /api/auth/login` sets both cookies in the response headers. After that, the browser automatically includes them on subsequent requests to the same origin.

### Token Refresh Flow

`POST /api/auth/refresh` — requires the `refresh_token_cookie` to be present. Returns a new `access_token_cookie`. Should be called when any protected endpoint returns `401`.

### What counts as "authenticated"

Every route decorated with `@jwt_required()` reads `user_id` (a UUID string) from the JWT identity. This `user_id` is used to scope all database queries — users cannot see each other's data.

---

## 3. API Routes

### 3.1 Auth Routes — `/api/auth`

---

#### `POST /api/auth/register`

Create a new account.

**Request body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "minimum8chars"
}
```

**Success — 201:**
```json
{
  "message": "Account created",
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Email and password are required"}` | Either field empty |
| 400 | `{"error": "Password must be at least 8 characters"}` | Password too short |
| 409 | `{"error": "Email already registered: user@example.com"}` | Duplicate email |

---

#### `POST /api/auth/login`

Authenticate and receive JWT cookies.

**Request body (JSON):**
```json
{
  "email": "user@example.com",
  "password": "yourpassword"
}
```

**Success — 200** (also sets `access_token_cookie` and `refresh_token_cookie` in response headers):
```json
{
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Email and password are required"}` | Either field empty |
| 401 | `{"error": "Invalid credentials"}` | Wrong email or password |

---

#### `POST /api/auth/logout`

Clears JWT cookies. Requires a valid access token.

**Success — 200:**
```json
{ "message": "Logged out" }
```

---

#### `GET /api/auth/me`

Get the currently authenticated user's profile.

**Success — 200:**
```json
{
  "user": {
    "user_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com"
  }
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 404 | `{"error": "User not found"}` | JWT valid but user deleted from DB |
| 401 | (flask-jwt-extended default) | Missing/expired access token |

---

#### `POST /api/auth/refresh`

Exchange a valid refresh token for a new access token. Requires `refresh_token_cookie`.

**Success — 200** (also sets a new `access_token_cookie`):
```json
{ "message": "Token refreshed" }
```

---

### 3.2 Stories Routes — `/api/stories`

All routes require a valid `access_token_cookie`.

---

#### `GET /api/stories/`

List stories with pagination, filtering, and sorting.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | `1` | 1-based page number |
| `per_page` | int | `10` | Results per page |
| `sort_order` | string | `"desc"` | `"asc"` or `"desc"` (by `created_on`) |
| `project_id` | string | — | Filter to a specific project |

**Success — 200:**
```json
{
  "stories": [
    {
      "id": "STORY-001",
      "description": "AI-generated summary of the story",
      "project_id": "my-project",
      "test_case_json": { "test_cases": [...] },
      "test_case_generated": true,
      "test_case_created_time": "2024-01-15T10:30:00",
      "source": { "story": "backend", "test_cases": "llm" },
      "impacted_test_cases_count": 3,
      "test_case_count": 25,
      "document_content": "raw text content of the uploaded document",
      "file_content": null,
      "download_link": "/api/stories/download/STORY-001",
      "embedding_timestamp": "2024-01-15T10:25:00",
      "doc_content_text": "full extracted text of the document",
      "impactedTestCases": 3
    }
  ],
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 10,
    "total_pages": 5
  }
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Invalid sort_order. Must be \"asc\" or \"desc\""}` | Bad sort_order value |
| 500 | `{"error": "<message>"}` | Database error |

> **Note:** The `stories` array objects contain both `impacted_test_cases_count` and `impactedTestCases` — they hold the same value. The `impacted_test_cases_count` key is removed from the dict and re-emitted as `impactedTestCases` by the normalization logic in `get_stories()`.

---

#### `GET /api/stories/<story_id>`

Fetch a single story by its ID.

**Path parameter:** `story_id` — the string ID assigned at upload time (e.g. `"STORY-001"`).

**Success — 200:**
```json
{
  "id": "STORY-001",
  "description": "AI-generated summary",
  "document_content": "full extracted text of the document",
  "test_case_count": 25,
  "download_link": "/api/stories/download/STORY-001",
  "test_case_created_time": "2024-01-15T10:30:00",
  "embedding_timestamp": "2024-01-15T10:25:00",
  "project_id": "my-project",
  "source": {
    "story": "backend",
    "test_cases": "llm"
  }
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Story ID is required"}` | Empty story_id path param |
| 404 | `{"error": "Story not found: STORY-001"}` | Not found for this user |
| 500 | `{"error": "<message>"}` | Database error |

---

#### `POST /api/stories/upload`

Upload a new user story. Triggers test case generation and impact analysis synchronously (test cases) and asynchronously (impact analysis in a background thread).

**Request format:** `multipart/form-data`

| Field | Type | Required | Notes |
|---|---|---|---|
| `project_id` | string | Yes | Groups stories into a project |
| `story_id` | string | Yes | User-chosen ID, must be unique per user |
| `content` | string | Conditional | Required if no `file` uploaded |
| `file` | file | Conditional | `.pdf`, `.docx`, or `.txt`; required if no `content` |
| `source` | string | No | Defaults to `"backend"` |

**Success — 200:**
```json
{
  "message": "Story uploaded and test cases generated successfully",
  "story_id": "STORY-001",
  "project_id": "my-project",
  "description": "AI-generated description of the story",
  "test_cases_generated": true,
  "file_processed": true,
  "source": "backend"
}
```

Or if test case generation failed (still 200):
```json
{
  "message": "Story uploaded but test case generation failed",
  "story_id": "STORY-001",
  "project_id": "my-project",
  "description": "...",
  "test_cases_generated": false,
  "file_processed": true,
  "source": "backend"
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Project ID, Story ID, and either Content or File are required"}` | Missing required fields |
| 400 | `{"error": "File type .xyz not supported. Allowed: .pdf, .docx, .txt"}` | Invalid file type |
| 400 | `{"error": "Could not extract text from the uploaded file"}` | Empty extraction |
| 409 | `{"error": "Story with ID \"STORY-001\" already exists"}` | Duplicate story_id for this user |
| 500 | `{"error": "..."}` | Database or LLM error |

---

#### `GET /api/stories/<story_id>/testcases`

Get all test cases for a story.

**Success — 200:**
```json
{
  "storyID": "STORY-001",
  "storyDescription": "AI-generated summary",
  "project_id": "my-project",
  "testcases": [
    {
      "id": "STORY-001-TC1",
      "title": "Verify successful login with valid credentials",
      "steps": [
        "Step 1: Navigate to the login page",
        "Step 2: Enter valid email and password",
        "Step 3: Click the login button"
      ],
      "expected_result": "User is authenticated and redirected to the dashboard",
      "priority": "High"
    }
  ]
}
```

Returns `testcases: []` (not 404) when the story exists but has no test cases.

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 500 | `{"error": "Internal server error", "details": "..."}` | Database error |

---

#### `GET /api/stories/testcases/download/<story_id>`

Download test cases as an Excel file (`.xlsx`).

**Success — 200:** Binary response with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` and `Content-Disposition: attachment; filename="test_cases_<story_id>.xlsx"`

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 404 | `{"error": "Story not found with ID: STORY-001"}` | Story not found |
| 404 | `{"error": "No test cases found for story ID: STORY-001"}` | No test case row |
| 500 | `{"error": "Failed to generate Excel file", "details": "..."}` | Excel generation error |

> **Note:** The route path is `/api/stories/testcases/download/<story_id>` but the `download_link` field in story objects says `/api/stories/download/<story_id>`. These **do not match** — the download link in story responses points to a non-existent route. **UNCLEAR — needs confirmation** which one is authoritative.

---

#### `GET /api/stories/<story_id>/test-cases/<test_case_id>`

Get a single test case from a story.

**Path parameters:** `story_id`, `test_case_id` (the `id` field inside the test case object, e.g. `"STORY-001-TC1"`)

**Success — 200:**
```json
{
  "id": "STORY-001-TC1",
  "title": "Verify successful login with valid credentials",
  "test_steps": [
    "Step 1: Navigate to the login page",
    "Step 2: Enter valid email and password"
  ],
  "expected_result": "User is authenticated and redirected",
  "priority": "medium",
  "severity": "medium"
}
```

> **Note:** The field is named `test_steps` here, but `steps` everywhere else. **UNCLEAR — needs confirmation** whether this inconsistency is intentional.

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 404 | `{"error": "Test case TC1 not found in story STORY-001"}` | Not found |
| 500 | `{"error": "..."}` | Database error |

---

#### `GET /api/stories/projects`

Get unique project IDs for the current user.

**Success — 200:**
```json
{
  "projects": ["my-project", "another-project"]
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 500 | `{"error": "..."}` | Database error |

---

#### `POST /api/stories/search`

Vector similarity search across the user's stories.

**Request body (JSON):**
```json
{
  "query": "user authentication flow",
  "limit": 5
}
```

`limit` defaults to `5` if omitted; values less than 1 are reset to `5`.

**Success — 200:**
```json
{
  "stories": [
    {
      "id": "STORY-001",
      "description": "AI-generated summary",
      "document_content": "...",
      "story_content": "...",
      "content": "...",
      "test_case_count": 25,
      "impactedTestCases": 3,
      "download_link": "/api/stories/download/STORY-001",
      "test_case_created_time": "2024-01-15T10:30:00",
      "test_case_json": { "test_cases": [...] },
      "similarity_score": 0.123,
      "source": { "story": "backend", "test_cases": "llm" }
    }
  ]
}
```

Or `{"stories": [], "message": "No matching stories found"}` when empty.

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Query is required"}` | Missing `query` key |
| 400 | `{"error": "Query cannot be empty"}` | Blank query string |
| 500 | `{"error": "..."}` | Search error |

---

#### `POST /api/stories/rag-chat`

Retrieve similar test cases and use them as RAG context to generate new test cases for a user story description.

**Request body (JSON):**
```json
{
  "query": "As a user I want to reset my password via email"
}
```

**Success — 200:**
```json
{
  "testCases": [
    {
      "id": "TC001",
      "title": "Verify password reset email is sent",
      "steps": ["Step 1: ...", "Step 2: ..."],
      "expected_result": "User receives a password reset email",
      "priority": "High"
    }
  ]
}
```

Or if LLM returns unparseable output (still 200):
```json
{
  "raw": "<raw LLM output>",
  "error": "Failed to parse LLM output as JSON",
  "details": "..."
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Query is required"}` | Missing `query` key |
| 404 | `{"error": "No relevant test cases found."}` | No similar stories in DB |
| 500 | `{"error": "...", "details": "..."}` | LLM or retrieval error |

---

#### `GET /api/stories/next-reload`

Get the time the scheduler is next expected to run (used for UI polling).

**Success — 200:**
```json
{
  "next_reload": "2024-01-15T10:35:00",
  "source": "file"
}
```

Or when the `next_reload.txt` file does not exist:
```json
{
  "next_reload": "2024-01-15T10:35:00",
  "source": "fallback"
}
```

**Error — 500:**
```json
{
  "error": "Failed to read next reload time",
  "details": "...",
  "fallback_next_reload": "2024-01-15T10:35:00"
}
```

---

#### `POST /api/stories/trigger-reload`

Manually trigger the background scheduler pipeline (embedding generation + test case generation + impact analysis).

**Success — 200:**
```json
{ "message": "Scheduler triggered successfully" }
```

**Error — 500:**
```json
{ "error": "..." }
```

---

### 3.3 Impact Analysis Routes — `/api/stories/impacts/...`

---

#### `GET /api/stories/impacts/<project_id>`

All active and inactive impacts in a project.

**Success — 200:**
```json
{
  "project_id": "my-project",
  "total_impacts": 5,
  "impacts": [
    {
      "impact_id": "uuid",
      "new_story_id": "STORY-002",
      "original_story_id": "STORY-001",
      "original_test_case_id": "STORY-001-TC3",
      "modified_test_case_id": "STORY-001-TC3-mod-1",
      "impact_created_on": "2024-01-15T11:00:00",
      "similarity_score": 0.85,
      "impact_analysis_json": { ... },
      "original_story_description": "Story description text"
    }
  ]
}
```

---

#### `GET /api/stories/impacts/story/<story_id>`

All impacts where this story either caused or received impact.

**Success — 200:**
```json
{
  "story_id": "STORY-001",
  "total_impacts": 3,
  "caused_impacts": [ { ...impact object... } ],
  "received_impacts": [ { ...impact object... } ]
}
```

> **Terminology:** `caused_impacts` = stories where `new_story_id == story_id` (this story was uploaded and modified others). `received_impacts` = stories where `original_story_id == story_id` (this story's test cases were modified by a newer story).

---

#### `GET /api/stories/impacts/details/<impact_id>`

**UNCLEAR — needs confirmation:** There are **two routes** that share the path pattern `/api/stories/impacts/details/<id>`:
- `get_impact_details(impact_id)` — looks up `test_case_impacts` by `impact_id`
- `get_story_impact_details(story_id)` — looks up test case impact details by `story_id`; requires `?project_id=`

Because Flask registers routes in order, the first registered route wins when both patterns match. The actual resolution depends on registration order in the file (line 858 registers `get_impact_details` first, line 1205 registers `get_story_impact_details` second). **UNCLEAR — needs confirmation.** The frontend should use the route that returns what it needs and be aware both exist at the same path.

**`get_impact_details` — Success 200:**
```json
{
  "impact_id": "uuid",
  "project_id": "my-project",
  "new_story_id": "STORY-002",
  "original_story_id": "STORY-001",
  "original_test_case_id": "STORY-001-TC3",
  "modified_test_case_id": "STORY-001-TC3-mod-1",
  "original_run_id": "uuid",
  "impact_created_on": "...",
  "similarity_score": 0.85,
  "impact_analysis_json": { ... },
  "impact_status": "active",
  "impact_type": "modification",
  "impact_severity": "high",
  "impact_priority": 5,
  "impact_details": { ... },
  "original_story_description": "...",
  "original_test_cases": { "test_cases": [...] },
  "new_story_description": "...",
  "new_test_cases": { "test_cases": [...] }
}
```

**`get_story_impact_details` — requires `?project_id=` — Success 200:**
```json
{
  "story_id": "STORY-001",
  "story_description": "...",
  "total_test_cases": 25,
  "impacted_test_cases_count": 3,
  "impact_percentage": 12.0,
  "severity_summary": { "high": 1, "medium": 2, "low": 0 },
  "test_cases": [
    {
      "test_case_id": "STORY-001-TC1",
      "title": "...",
      "expected_result": "...",
      "steps": [...],
      "is_impacted": true,
      "highest_severity": "high",
      "impacts": [...]
    }
  ]
}
```

---

#### `GET /api/stories/impacts/summary/<project_id>`

Aggregated impact summary for all stories in a project.

**Success — 200:**
```json
{
  "project_id": "my-project",
  "total_stories": 10,
  "stories_with_impacts": 4,
  "summaries": [
    {
      "project_id": "my-project",
      "story_id": "STORY-001",
      "story_description": "...",
      "test_case_json": { ... },
      "test_case_generated_on": "...",
      "total_impacts": 5,
      "has_caused_impacts": true,
      "has_received_impacts": true
    }
  ]
}
```

---

#### `GET /api/stories/impacts/story-test-cases/<story_id>`

Per-test-case impact breakdown for a story, grouped by which other story caused the impact.

**Requires query param:** `?project_id=my-project`

**Success — 200:**
```json
{
  "story_id": "STORY-001",
  "story_description": "...",
  "total_test_cases": "25",
  "impacted_test_cases_count": "3",
  "impact_percentage": "12.0",
  "impacted_test_cases": [
    {
      "test_case_id": "STORY-001-TC1",
      "original_title": "Verify login",
      "original_expected_result": "User logs in",
      "original_steps": "[\"Step 1: ...\"]",
      "impacts": [
        {
          "impact_id": "uuid",
          "impacting_story_id": "STORY-002",
          "impacting_story_description": "...",
          "impact_created_on": "2024-01-15T11:00:00",
          "impact_severity": "high",
          "impact_priority": "5",
          "impact_details": "...",
          "impact_analysis_json": "{ ... }"
        }
      ]
    }
  ],
  "severity_summary": { "high": "1", "medium": "2", "low": "0" }
}
```

> **Note:** Most numeric values in this response are **strings** (e.g. `"25"`, `"3"`, `"12.0"`), unlike other endpoints which return numbers. This appears to be intentional defensive `str()` casting in the code.

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "project_id is required as query parameter"}` | Missing project_id |
| 404 | `{"error": "Story not found"}` | Story not in DB for this user |

---

#### `POST /api/stories/impacts/analyze`

Manually trigger impact analysis for a single story.

**Request body (JSON):**
```json
{
  "story_id": "STORY-001",
  "project_id": "my-project"
}
```

**Success — 200:**
```json
{
  "message": "Impact analysis triggered successfully",
  "story_id": "STORY-001",
  "project_id": "my-project"
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "Both story_id and project_id are required"}` | Missing fields |
| 500 | `{"error": "..."}` | LLM or DB error |

---

#### `POST /api/stories/impacts/analyze-project`

Trigger impact analysis for **all** stories in a project (runs in a background thread).

**Request body (JSON):**
```json
{
  "project_id": "my-project"
}
```

**Success — 202:**
```json
{
  "message": "Impact analysis started for 10 stories in background",
  "project_id": "my-project",
  "stories_queued": 10
}
```

Or when no stories exist yet (200):
```json
{
  "message": "No stories with test cases found in project",
  "project_id": "my-project",
  "stories_queued": 0
}
```

**Errors:**

| Status | Body | Condition |
|---|---|---|
| 400 | `{"error": "project_id is required"}` | Missing field |
| 500 | `{"error": "..."}` | DB error |

---

## 4. Core Data Models

### 4.1 PostgreSQL Tables

#### `users`

| Column | Type | Notes |
|---|---|---|
| `user_id` | `UUID` PK | Auto-generated via `uuid_generate_v4()` |
| `email` | `TEXT` UNIQUE NOT NULL | Stored lowercase-trimmed |
| `password_hash` | `TEXT` NOT NULL | bcrypt hash |
| `created_on` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` |
| `last_login` | `TIMESTAMP` | Updated on each login |

---

#### `test_cases`

Stores one row per user story (not per individual test case). The full test case list lives in `test_case_json`.

| Column | Type | Notes |
|---|---|---|
| `project_id` | `TEXT` | User-supplied project group |
| `run_id` | `UUID` PK | Auto-generated, used for `ON CONFLICT` UPSERT |
| `story_id` | `TEXT` NOT NULL | User-supplied story identifier (e.g. `"STORY-001"`) |
| `story_description` | `TEXT` | AI-generated summary |
| `created_on` | `TIMESTAMP` | When test cases were generated |
| `test_case_json` | `JSONB` | Full test case payload (see schema below) |
| `total_test_cases` | `INTEGER` | Count of test cases in `test_case_json` |
| `total_impacted_test_cases` | `INTEGER` | Default 0 |
| `impacted_test_cases_count` | `INTEGER` | Count of test cases with active impacts |
| `last_impact_update_time` | `TIMESTAMP` | When impacts were last updated |
| `test_case_generated` | `BOOLEAN` | `TRUE` once generation succeeds |
| `impacted_test_case_generated` | `BOOLEAN` | Default `FALSE` |
| `source` | `TEXT` | `'backend'` or `'llm'` or `'jira'` |
| `inputs` | `JSONB` | Original inputs: `{"story_description": ..., "main_text": ..., "project_id": ..., "content": ..., "file_content": ...}` |
| `has_impacts` | `BOOLEAN` | Default `FALSE` |
| `latest_impact_id` | `UUID` | FK to `test_case_impacts` |
| `user_id` | `UUID` FK → `users.user_id` ON DELETE CASCADE | Scopes row to a user |

**Unique constraint:** `(story_id, user_id)` — a story_id must be unique per user.

---

#### `test_case_json` JSONB Schema

The `test_case_json` column stores a single JSON object:

```json
{
  "storyID": "STORY-001",
  "storyDescription": "AI-generated summary",
  "generated_on": "2024-01-15T10:30:00Z",
  "total_test_cases": 25,
  "test_cases": [
    {
      "id": "STORY-001-TC1",
      "title": "Verify successful login with valid credentials",
      "steps": [
        "Step 1: Navigate to the login page",
        "Step 2: Enter valid email address in the email field",
        "Step 3: Enter valid password in the password field",
        "Step 4: Click the Login button"
      ],
      "expected_result": "User is authenticated and redirected to the dashboard",
      "priority": "High"
    }
  ]
}
```

**Test case ID format:** `"<story_id>-TC<n>"` where `n` is a sequential integer starting at 1.

**Priority values:** `"High"`, `"Medium"`, `"Low"` (title case, strictly).

**Categories generated:** positive, negative, boundary, security, performance (mixed together in `test_cases` array — not tagged by category in the stored JSON).

---

#### `test_case_impacts`

| Column | Type | Notes |
|---|---|---|
| `impact_id` | `UUID` PK | Auto-generated |
| `project_id` | `TEXT` NOT NULL | |
| `new_story_id` | `TEXT` NOT NULL | The story that caused the impact |
| `original_story_id` | `TEXT` NOT NULL | The story whose test case was modified |
| `original_test_case_id` | `TEXT` NOT NULL | ID of the affected test case |
| `modified_test_case_id` | `TEXT` NOT NULL | Format: `"<original_test_case_id>-mod-<n>"` |
| `original_run_id` | `UUID` NOT NULL | FK → `test_cases.run_id` |
| `impact_created_on` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` |
| `source` | `TEXT` | Always `'llm'` for automated runs |
| `similarity_score` | `FLOAT` | Cosine distance score from LanceDB |
| `impact_analysis_json` | `JSONB` NOT NULL | Full LLM analysis output (see below) |
| `previous_impact_id` | `UUID` | FK → self, for chaining impact versions |
| `impact_version` | `INT` | Default 1 |
| `impact_status` | `TEXT` | `'active'` or `'inactive'` (check constraint) |
| `impact_type` | `TEXT` NOT NULL | `'modification'`, `'deletion'`, or `'addition'` (check constraint) |
| `impact_severity` | `TEXT` NOT NULL | `'high'`, `'medium'`, or `'low'` (check constraint) |
| `impact_priority` | `INTEGER` | 1–5 scale (`high`→5, `medium`→3, `low`→1) |
| `impact_details` | `JSONB` | `{"modification_reason": ..., "severity_reason": ..., "changes": {"title": ..., "steps": [...], "expected_result": ...}}` |
| `user_id` | `UUID` FK → `users.user_id` | Added via migration |

**`impact_analysis_json` object shape (stored per-impact):**
```json
{
  "original_test_case_id": "STORY-001-TC3",
  "modification_reason": "The new story introduces a new authentication step that affects this test case",
  "impact_severity": "high",
  "severity_reason": "Core authentication flow is impacted",
  "modified_test_case": {
    "id": "STORY-001-TC3-mod-1",
    "title": "Updated test case title",
    "steps": ["Step 1: ...", "Step 2: ..."],
    "expected_result": "Updated expected result",
    "priority": "High"
  }
}
```

---

#### `impact_history`

Audit trail for status changes on impacts.

| Column | Type | Notes |
|---|---|---|
| `history_id` | `UUID` PK | |
| `impact_id` | `UUID` FK → `test_case_impacts` | |
| `change_timestamp` | `TIMESTAMP` | Default `CURRENT_TIMESTAMP` |
| `changed_by` | `TEXT` | `'system'` for automated runs |
| `previous_status` | `TEXT` | `null` on creation |
| `new_status` | `TEXT` | `'active'` on creation |
| `change_reason` | `TEXT` | `'Initial impact analysis creation'` |
| `user_id` | `UUID` FK → `users.user_id` | Added via migration |

---

### 4.2 LanceDB Table — `user_stories` (default name)

Vector store for semantic search and embedding lookups.

| Column | Type | Notes |
|---|---|---|
| `user_id` | `string` | User scope |
| `project_id` | `string` | Project group |
| `vector` | `list<float32>[768]` | Google text-embedding-004 embedding |
| `storyID` | `string` | Primary identifier (matches PostgreSQL `story_id`) |
| `storyDescription` | `string` | AI-generated summary |
| `test_case_content` | `string` | Empty string currently (legacy field) |
| `filename` | `string` | Saved filename |
| `original_path` | `string` | Upload path before processing |
| `doc_content_text` | `string` | Full extracted text of the document |
| `embedding_timestamp` | `timestamp[us]` | When the embedding was created |
| `source` | `string` | `'backend'`, `'jira'`, etc. |

> **Note on casing:** PostgreSQL uses snake_case for `story_id`, `story_description`, `project_id`. LanceDB uses camelCase for `storyID`, `storyDescription` but snake_case for `project_id`, `doc_content_text`, `user_id`. The `GET /api/stories/` response normalizes both into snake_case for the `description` and `id` fields.

---

### 4.3 Database Views

#### `impact_metrics`
Aggregates `test_case_impacts` against `test_cases` per story. Fields: `story_id`, `project_id`, `story_description`, `total_test_cases`, `impacted_test_cases`, `total_impacts`, `last_impact_date`, `impact_types`, `highest_priority`, `high_severity_count`, `medium_severity_count`, `low_severity_count`, `impact_percentage`.

#### `test_case_impact_summary`
Union of stories that caused and received impacts. Fields: `project_id`, `story_id`, `story_description`, `test_case_json`, `test_case_generated_on`, `total_impacts`, `has_caused_impacts`, `has_received_impacts`.

---

## 5. Naming Mismatches & Inconsistencies

The following gaps exist between what the backend returns and what a frontend "Story", "Test Case", or "Coverage" model would likely want:

| Location | Backend name | Expected frontend name | Notes |
|---|---|---|---|
| LanceDB | `storyID` | `story_id` | camelCase in storage, snake_case in API responses |
| LanceDB | `storyDescription` | `description` | camelCase in storage; API normalizes to `description` |
| `GET /api/stories/` response | `impactedTestCases` AND `impacted_test_cases_count` | one field | Both keys exist and hold the same value; one should be removed |
| `GET /api/stories/<id>/test-cases/<tc_id>` | `test_steps` | `steps` | All other endpoints use `steps`; this one uses `test_steps` |
| `/api/stories/download/<id>` | Referenced in `download_link` field | — | **Route does not exist**; actual download route is `/api/stories/testcases/download/<id>` |
| `story-test-cases` response | `total_test_cases`, `impacted_test_cases_count`, `impact_percentage` as strings | as numbers | Defensive `str()` casting produces `"25"` instead of `25` |
| `test_case_impacts.impact_severity` | lowercase `"high"`, `"medium"`, `"low"` | — | But `modified_test_case.priority` is title-case `"High"`, `"Medium"`, `"Low"` |
| `GET /api/stories/impacts/details/<id>` | Two different handlers registered at the same path | — | Path collision; see Section 3.3 |
| No explicit "coverage" concept | `impact_percentage` in story-test-cases endpoint | "coverage" or "impact coverage" | There is no `GET /coverage` endpoint; coverage data lives inside impact endpoints |
| No "change request" model | Impact analysis inferred from story similarity | — | "Change requests" must be modeled as impact events; there is no explicit CR/PR concept |
| No story "version" concept | `impact_version` on impacts only | — | Stories themselves are not versioned; re-uploading the same `story_id` does an UPSERT |

---

## 6. Pagination, Filtering, and Sorting

### Pagination

Used by `GET /api/stories/` only. Pattern:

| Query param | Type | Default | Notes |
|---|---|---|---|
| `page` | int | `1` | 1-based |
| `per_page` | int | `10` | Page size |

Response includes:
```json
{
  "pagination": {
    "total": 42,
    "page": 1,
    "per_page": 10,
    "total_pages": 5
  }
}
```

`DatabaseService.get_recent_stories()` also has `from_date` and `to_date` parameters, but **no route exposes these as query params currently**.

### Filtering

- `GET /api/stories/?project_id=my-project` — filter by project
- All routes implicitly filter by `user_id` from the JWT cookie

### Sorting

- `GET /api/stories/?sort_order=asc|desc` — sorts by `created_on` in PostgreSQL query

### No Pagination on Other Endpoints

Impact listing endpoints (`/impacts/<project_id>`, `/impacts/story/<story_id>`) return **all results without pagination**. This could be a performance issue for large datasets.

---

## 7. WebSocket / Real-Time Features

**There are no WebSocket or server-sent events in this backend.**

Real-time behavior is simulated via **polling**:
- `GET /api/stories/next-reload` — returns the ISO timestamp when the scheduler will next run (written to `next_reload.txt` by the scheduler process)
- Frontend should poll this endpoint and refresh the story list after the reload time passes
- Scheduler runs every **5 minutes**

Impact analysis and test case generation after upload run in **background daemon threads** — the upload endpoint returns `200` immediately. There is no notification mechanism; the frontend must poll or refresh to see results.

---

## 8. CORS Configuration

Configured in `app/__init__.py`. Applied to all `/api/*` routes.

**Allowed origins (built at startup):**

| Origin | Source |
|---|---|
| `http://localhost:3000` | Always allowed (hardcoded) |
| `http://127.0.0.1:3000` | Always allowed (hardcoded) |
| Value of `FRONTEND_URL` env var | Added when set (e.g. `https://testforge.kynetropo.com`) |
| `https://www.kynetropo.com` | Added when `FRONTEND_URL` contains `kynetropo.com` |
| `https://<VERCEL_URL>` | Added when `VERCEL_URL` env var is set |

**Allowed methods:** `GET`, `POST`, `PUT`, `DELETE`, `OPTIONS`

**Allowed headers:** `Content-Type`, `Authorization`

**Credentials:** `supports_credentials: True` — the frontend **must** use `credentials: "include"` (or equivalent) on all requests, otherwise cookies will not be sent and all protected endpoints will return 401.

**No wildcard origins.** `*` is never used because credentials require an explicit origin list.

> **RESOLVED:** In development mode (`FLASK_ENV=development` or `DEV_BYPASS_AUTH=1`), all `http://localhost:*` and `http://127.0.0.1:*` origins are allowed via regex. This means any dev port (3000–3999 etc.) works without updating the allowed list.

---

## 9. New Endpoints Added Post-Initial-Contract

These endpoints were added during v1 implementation and are not in the original sections above.

### 9.1 Story Version History

#### `GET /api/stories/<story_id>/versions`

Return all saved versions for a story, newest first.

**Success — 200:**
```json
{
  "story_id": "STORY-001",
  "versions": [
    {
      "version_id": "uuid",
      "version_number": 2,
      "description": "OAuth Login Flow",
      "file_name": null,
      "created_on": "2024-01-15T11:00:00",
      "run_id": "uuid"
    }
  ]
}
```

---

#### `POST /api/stories/<story_id>/regenerate`

Delete existing test cases and re-run the full test generation pipeline for an existing story. Uses stored content from LanceDB.

**Request body:** empty `{}`

**Success — 202:**
```json
{
  "message": "Test regeneration started",
  "story_id": "STORY-001",
  "project_id": "default"
}
```

Impact analysis is also re-triggered after generation completes (background thread).

**Errors:**

| Status | Condition |
|---|---|
| 404 | Story not found |
| 404 | Story content not in vector store |

---

#### `POST /api/stories/<story_id>/upload-version`

Upload a new version of an existing story. Archives the current content to `story_versions`, generates a new AI description and short title, updates LanceDB, deletes old test cases, and re-runs generation in the background.

**Request format:** `multipart/form-data`

| Field | Type | Required |
|---|---|---|
| `content` | string | Conditional — required if no `file` |
| `file` | file | Conditional — `.pdf`, `.docx`, `.txt` |
| `source` | string | No — defaults to `"frontend"` |

**Success — 202:**
```json
{
  "message": "New version uploaded. Test regeneration started.",
  "story_id": "STORY-001",
  "version_number": 2,
  "description": "OAuth Login Flow"
}
```

**Errors:**

| Status | Condition |
|---|---|
| 400 | Neither content nor file provided |
| 400 | Unsupported file type |
| 404 | Story not found |

---

### 9.2 Review Endpoints

#### `POST /api/stories/impacts/<impact_id>/review`

Accept, reject, or edit a single impact. Persists to `impact_status` column and writes to `impact_history`.

**Request body (JSON):**
```json
{
  "action": "accept",
  "edited_test_case": null
}
```

`action` must be `"accept"`, `"reject"`, or `"edit"`. `edited_test_case` is required only when `action = "edit"`.

**Success — 200:**
```json
{
  "impact_id": "uuid",
  "new_status": "accepted",
  "message": "Impact review recorded"
}
```

---

#### `POST /api/stories/impacts/batch-review`

Submit reviews for multiple impacts at once (partial-acceptance workflow).

**Request body (JSON):**
```json
{
  "project_id": "my-project",
  "new_story_id": "STORY-002",
  "reviews": [
    { "impact_id": "uuid", "action": "accept" },
    { "impact_id": "uuid", "action": "reject" },
    { "impact_id": "uuid", "action": "edit", "edited_test_case": { ... } }
  ]
}
```

**Success — 202:**
```json
{
  "message": "Review submitted",
  "accepted": 7,
  "rejected": 2,
  "edited": 1,
  "change_request_status": "approved"
}
```

`change_request_status` is `"approved"` if ≥1 was accepted, `"rejected"` if all were rejected.

---

#### `GET /api/stories/changes`

List change requests (impacts grouped by `new_story_id`), filterable by review status.

**Query parameters:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `project_id` | string | — | Filter to a project |
| `status` | string | `"all"` | `"pending"`, `"approved"`, `"rejected"`, `"all"` |
| `page` | int | `1` | |
| `per_page` | int | `20` | |

**Success — 200:**
```json
{
  "changes": [
    {
      "change_id": "STORY-002",
      "new_story_id": "STORY-002",
      "new_story_description": "OAuth Login Update",
      "project_id": "default",
      "created_on": "2024-01-15T11:00:00",
      "stories_affected": 3,
      "tests_affected": 18,
      "overall_severity": "high",
      "status": "pending"
    }
  ],
  "pagination": { "total": 5, "page": 1, "per_page": 20, "total_pages": 1 }
}
```

Status derivation: `pending` = all impacts still `active`, `approved` = ≥1 `accepted`, `rejected` = all `rejected`.

---

### 9.3 Updated Route

#### `GET /api/stories/impacts/story-details/<story_id>`

**Previously** registered as `/impacts/details/<story_id>` — this caused a route collision with `GET /impacts/details/<impact_id>`. **Renamed** to `/impacts/story-details/<story_id>` to resolve the collision.

Requires `?project_id=` query parameter. Returns full test-case-level impact breakdown for a story (same response shape as documented in §3.3 `get_story_impact_details`).

---

## 10. Database Schema Updates

### 10.1 story_versions Table (new)

```sql
CREATE TABLE story_versions (
    version_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    story_id       TEXT NOT NULL,
    user_id        UUID REFERENCES users(user_id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    content        TEXT,
    description    TEXT,
    file_name      TEXT,
    created_on     TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    run_id         UUID REFERENCES test_cases(run_id) ON DELETE SET NULL,
    CONSTRAINT uq_story_version UNIQUE (story_id, user_id, version_number)
);
```

Each row represents one saved version of a story. When `POST /<story_id>/upload-version` is called, the current content is archived here before replacement.

### 10.2 test_case_impacts.impact_status Constraint Updated

**Before:** `CHECK (impact_status IN ('active', 'inactive'))`
**After:** `CHECK (impact_status IN ('active', 'inactive', 'accepted', 'rejected'))`

The `accepted` and `rejected` values are written by the review endpoints. The DDL-per-request workaround has been removed — the constraint is correct in the schema definition.

### 10.3 New Index

```sql
CREATE INDEX idx_test_case_impacts_new_story_user
ON test_case_impacts(new_story_id, user_id);
```

Improves performance of the `GET /api/stories/changes` query which groups by `new_story_id` and filters by `user_id`.

---

## 11. Security Changes

### 11.1 Production Guards in `__init__.py`

Two startup checks abort the process if misconfigured:

```python
# Fatal if DEV_BYPASS_AUTH is enabled in production
if is_production and is_dev_bypass:
    sys.exit(1)

# Fatal if JWT secret is missing or uses the default value
if is_production and (not jwt_secret or jwt_secret == "dev-secret-change-in-production"):
    sys.exit(1)
```

### 11.2 Security Headers

All API responses include:

| Header | Value |
|---|---|
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` (production only) |

### 11.3 JWT Cookie Configuration

```python
app.config["JWT_COOKIE_HTTPONLY"] = True   # explicitly set (was implicit default)
app.config["JWT_COOKIE_SECURE"] = is_production  # boolean, not fragile string compare
```

### 11.4 Cross-User Data Isolation Fix

`store_impact_analysis()` in `impact_analyzer.py` previously fetched `run_id` without scoping by `user_id`, creating a potential cross-user data leak. Fixed — query now includes `AND user_id = %s` when `user_id` is available.

