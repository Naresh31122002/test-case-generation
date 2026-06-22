/**
 * types/domain.ts
 *
 * Central type definitions for the TestSurge frontend.
 *
 * Two sections:
 *   1. Raw* types — mirror exact backend JSON shapes; used ONLY inside
 *      normalizer functions in lib/api.ts. Never pass Raw* types to components.
 *   2. Normalized domain types — clean camelCase shapes consumed by all React
 *      components and hooks. Every normalizer converts Raw* → domain type.
 *
 * Key contract reminders encoded here:
 *   - download_link is intentionally ABSENT from RawStory (broken backend route).
 *     downloadUrl on Story is always computed as /api/stories/testcases/download/<id>.
 *   - Backend priority values are title-case "High"/"Medium"/"Low".
 *   - Backend severity values are lowercase "high"/"medium"/"low".
 *   - impactedTestCases and impacted_test_cases_count both arrive on raw story
 *     responses and must be merged into impactedTestCasesCount: number.
 *   - Single-test endpoint returns test_steps (not steps); normalizers map to steps.
 *   - Scheduler routes (/next-reload, /trigger-reload) live on the main Flask app
 *     at port 5000, NOT a separate scheduler service.
 */

// ---------------------------------------------------------------------------
// SECTION 1 — Raw backend response shapes
// ---------------------------------------------------------------------------

/**
 * Raw story row as returned by the backend.
 * NOTE: download_link is intentionally omitted — it points to a non-existent
 * backend route. Use the computed downloadUrl on Story instead.
 */
export interface RawStory {
  id: string;
  description: string;
  project_id: string;
  /** May arrive as a numeric string from some endpoints. */
  test_case_count: number | string;
  test_case_generated?: boolean;
  test_case_created_time: string | null;
  embedding_timestamp: string | null;
  doc_content_text: string | null;
  document_content?: string | null;
  file_content?: string | null;
  /**
   * Either a structured object with story/test_cases keys, or a plain string
   * depending on how the story was ingested.
   */
  source: { story: string; test_cases: string } | string | null;
  /**
   * Both fields exist on raw story responses and must be merged during
   * normalization into a single impactedTestCasesCount: number.
   */
  impactedTestCases?: number | string;
  impacted_test_cases_count?: number | string;
  /** Kanban column status from backend */
  story_status?: 'in_review' | 'in_progress' | 'completed';
}

/**
 * Raw test case row as returned by list and single-test endpoints.
 * The single-test endpoint uses test_steps instead of steps; both are optional
 * so one interface covers both shapes.
 */
export interface RawTestCase {
  id?: string;
  test_case_id?: string;
  title: string;
  steps?: string[];
  test_steps?: string[];
  expected_result: string;
  priority: string;
  severity?: string;
  /** AI-generated feature group name e.g. "Login & Authentication" */
  group?: string;
  /** Approve/reject status stored in the test case JSON. */
  status?: string;
  /** Test Case Kanban execution column (Sprint 1 Phase 2). */
  tc_status?: 'todo' | 'in_progress' | 'done';
  /** Whether the test case is ready for automation (Phase 3 filter). */
  automation_ready?: boolean;
  /** Version number when this TC was introduced (1=original, 2=v2 upload, etc.) */
  version?: number;
}

/** Raw impact row from the test_case_impacts table. */
export interface RawImpact {
  impact_id: string;
  new_story_id: string;
  original_story_id: string;
  original_test_case_id: string;
  modified_test_case_id: string;
  impact_created_on: string;
  /** Lowercase severity: "high" | "medium" | "low" */
  impact_severity: string;
  /** May arrive as a numeric string. */
  impact_priority: number | string;
  impact_status: string;
  /** May be a pre-serialised JSON string or an already-parsed object. */
  impact_details: string | RawImpactDetails | null;
  /** May be a pre-serialised JSON string or an already-parsed object. */
  impact_analysis_json: string | RawImpactAnalysisJson | null;
  /** Joined field — present only on some query responses. */
  original_story_description?: string;
  /** Joined field — present on story-test-cases endpoint (alias for original_story_description). */
  impacted_story_description?: string;
  /** Joined field — present only on some query responses. */
  new_story_description?: string;
}

/** Shape of the parsed impact_details payload. */
export interface RawImpactDetails {
  modification_reason: string;
  severity_reason: string;
  changes: {
    title?: string;
    steps?: string[];
    expected_result?: string;
  };
}

/** Shape of the parsed impact_analysis_json payload. */
export interface RawImpactAnalysisJson {
  original_test_case_id: string;
  modification_reason: string;
  impact_severity: string;
  severity_reason?: string;
  modified_test_case: {
    id: string;
    title: string;
    steps: string[];
    expected_result: string;
    priority: string;
  };
}

/** Per-test-case detail inside the /impacts/story-test-cases/<id> response. */
export interface RawImpactedTestCaseDetail {
  test_case_id: string;
  original_title: string;
  original_expected_result: string;
  /** Backend may return a plain string or a proper array. */
  original_steps: string | string[];
  impacts: RawImpactEvent[];
}

/** A single impact event nested inside a RawImpactedTestCaseDetail. */
export interface RawImpactEvent {
  impact_id: string;
  impacting_story_id: string;
  impacting_story_description: string;
  impact_created_on: string | null;
  /** Lowercase severity: "high" | "medium" | "low" */
  impact_severity: string;
  /** May arrive as a numeric string. */
  impact_priority: string | number;
  impact_details: string | RawImpactDetails | null;
  impact_analysis_json: string | RawImpactAnalysisJson | null;
}

/**
 * Top-level response shape from /impacts/story-test-cases/<storyId>.
 * All numeric summary fields may arrive as strings.
 */
export interface RawStoryTestCaseImpacts {
  story_id: string;
  story_description: string;
  total_test_cases: string | number;
  impacted_test_cases_count: string | number;
  impact_percentage: string | number;
  severity_summary: {
    high: string | number;
    medium: string | number;
    low: string | number;
    [key: string]: string | number;
  };
  impacted_test_cases: RawImpactedTestCaseDetail[];
}

// ---------------------------------------------------------------------------
// SECTION 2 — Normalized domain types
// ---------------------------------------------------------------------------

/**
 * A story after normalization.
 *
 * downloadUrl is ALWAYS a computed value: `/api/stories/testcases/download/<id>`.
 * The raw download_link field from the backend points to a non-existent route
 * and is never read.
 */
export interface Story {
  id: string;
  description: string;
  projectId: string;
  testCaseCount: number;
  /**
   * Merged from raw impactedTestCases + impacted_test_cases_count.
   * Both fields may exist on the raw response; normalizer coerces the first
   * defined non-null value to number.
   */
  impactedTestCasesCount: number;
  testCaseCreatedTime: string | null;
  embeddingTimestamp: string | null;
  docContentText: string | null;
  /** Always normalized to the structured form regardless of raw shape. */
  source: { story: string; testCases: string };
  /**
   * Computed at normalization time as `/api/stories/testcases/download/<id>`.
   * Never sourced from the raw download_link field.
   */
  downloadUrl: string;
  /** Kanban column: in_review | in_progress | completed. Default: in_review */
  storyStatus: 'in_review' | 'in_progress' | 'completed';
}

/**
 * A test case after normalization.
 *
 * priority is title-case ("High"/"Medium"/"Low") — exactly as the backend sends it.
 * severity is lowercase ("high"/"medium"/"low") — exactly as the backend sends it.
 */
export interface TestCase {
  id: string;
  title: string;
  /**
   * Normalized from either steps (list endpoint) or test_steps (single-test
   * endpoint). Always an array after normalization.
   */
  steps: string[];
  expectedResult: string;
  /** Title-case as sent by backend: "High" | "Medium" | "Low" */
  priority: 'High' | 'Medium' | 'Low';
  /**
   * Lowercase as sent by backend: "high" | "medium" | "low".
   * Present only from the single-test endpoint.
   */
  severity?: 'high' | 'medium' | 'low';
  /** AI-generated feature group e.g. "Login & Authentication" */
  group?: string;
  /** Approve/reject status: "Approved" | "Pending" | "Rejected". */
  status?: 'Approved' | 'Pending' | 'Rejected';
  /** Test Case Kanban execution column (Sprint 1 Phase 2). */
  tcStatus?: 'todo' | 'in_progress' | 'done';
  /** Whether the test case is ready for automation. */
  automationReady?: boolean;
  /** Version number when this TC was introduced (1=original, 2=v2 upload, etc.) */
  version?: number;
}

/** Response shape for the test cases list endpoint (normalized). */
export interface TestCaseListResponse {
  storyId: string;
  description: string;
  projectId: string;
  testCases: TestCase[];
}

/** Normalized analysis JSON attached to an impact record. */
export interface ImpactAnalysisJson {
  originalTestCaseId: string;
  modificationReason: string;
  /** Lowercase: "high" | "medium" | "low" */
  impactSeverity: string;
  severityReason: string;
  modifiedTestCase: {
    id: string;
    title: string;
    steps: string[];
    expectedResult: string;
    priority: string;
  };
}

/** Normalized details payload attached to an impact record. */
export interface ImpactDetails {
  modificationReason: string;
  severityReason: string;
  changes: {
    title?: string;
    steps?: string[];
    expectedResult?: string;
  };
}

/** A fully normalized impact row. */
export interface Impact {
  impactId: string;
  newStoryId: string;
  originalStoryId: string;
  originalTestCaseId: string;
  modifiedTestCaseId: string;
  createdOn: string;
  /** Lowercase as sent by backend: "high" | "medium" | "low" */
  severity: 'high' | 'medium' | 'low';
  /** Always coerced to number during normalization. */
  priority: number;
  status: 'active' | 'inactive';
  impactDetails: ImpactDetails;
  analysisJson: ImpactAnalysisJson | null;
  /** Joined field — only present when the backend query includes story joins. */
  originalStoryDescription?: string;
  /** Joined field — only present when the backend query includes story joins. */
  newStoryDescription?: string;
}

/**
 * A single impact event nested inside an ImpactedTestCaseDetail.
 *
 * analysisJson is intentionally kept as a raw JSON string rather than a parsed
 * object because the backend may embed varying schemas inside this field.
 * Parse with JSON.parse() and cast to ImpactAnalysisJson when a structured form
 * is needed.
 */
export interface ImpactEvent {
  impactId: string;
  impactingStoryId: string;
  impactingStoryDescription: string;
  createdOn: string | null;
  /** Lowercase: "high" | "medium" | "low" */
  severity: 'high' | 'medium' | 'low';
  /** Coerced to number during normalization. */
  priority: number;
  details: string;
  /**
   * Kept as a raw JSON string from the backend. The schema inside may vary;
   * use JSON.parse() and cast to ImpactAnalysisJson when structured access is needed.
   */
  analysisJson: string;
}

/** Per-test-case detail in the /impacts/story-test-cases/<id> response (normalized). */
export interface ImpactedTestCaseDetail {
  testCaseId: string;
  originalTitle: string;
  originalExpectedResult: string;
  /** Always an array after normalization, even when the backend returns a string. */
  originalSteps: string[];
  impacts: ImpactEvent[];
}

/** Top-level normalized response from /impacts/story-test-cases/<storyId>. */
export interface StoryTestCaseImpacts {
  storyId: string;
  description: string;
  totalTestCases: number;
  impactedTestCasesCount: number;
  impactPercentage: number;
  severitySummary: {
    high: number;
    medium: number;
    low: number;
  };
  /** All test cases for this story, each annotated with its impact events. */
  testCases: ImpactedTestCaseDetail[];
}

/** Normalized response from /impacts/story/<storyId>. */
export interface StoryImpactSummary {
  storyId: string;
  totalImpacts: number;
  /** Impacts this story caused on other stories' test cases. */
  causedImpacts: Impact[];
  /** Impacts this story's test cases received from other stories. */
  receivedImpacts: Impact[];
}

/** A single story entry inside a ProjectImpactSummary. */
export interface ProjectStorySummary {
  projectId: string;
  storyId: string;
  description: string;
  testCaseGeneratedOn: string | null;
  totalImpacts: number;
  hasCausedImpacts: boolean;
  hasReceivedImpacts: boolean;
}

/** Normalized response from /impacts/summary/<projectId>. */
export interface ProjectImpactSummary {
  projectId: string;
  totalStories: number;
  storiesWithImpacts: number;
  summaries: ProjectStorySummary[];
}

/** Generic paginated wrapper used by endpoints that support pagination. */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    /** camelCase — maps from raw per_page field. */
    perPage: number;
    totalPages: number;
  };
}

/** Normalized response from the story upload endpoint. */
export interface UploadStoryResponse {
  storyId: string;
  projectId: string;
  description: string;
  testCasesGenerated: boolean;
  fileProcessed: boolean;
  source: string;
  message: string;
}

/**
 * Normalized response from GET /api/stories/next-reload.
 * NOTE: This endpoint is on the MAIN Flask app (same port as all other routes),
 * not a separate scheduler service.
 */
export interface NextReloadResponse {
  /** ISO 8601 datetime string for the next scheduled reload. */
  nextReload: string;
  /** Whether the schedule came from a config file or a fallback default. */
  source: 'file' | 'fallback';
}

/** Normalized response from the story search endpoint. */
export interface SearchResponse {
  stories: Story[];
}

/** Normalized response from the projects list endpoint. */
export interface ProjectsResponse {
  projects: string[];
}
