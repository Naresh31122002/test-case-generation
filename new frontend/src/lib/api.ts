// lib/api.ts
//
// TestSurge — all backend API calls with response normalization.
//
// Every method converts raw snake_case backend responses into clean camelCase
// domain types before returning. Components must import from this module and
// from @/types/domain — never from raw API shapes.
//
// Key contracts enforced here:
//   - download_link is NEVER read; downloadUrl is always computed.
//   - /api/stories/impacts/details/<id> is NEVER called (route collision bug).
//   - getNextReload / triggerReload call the MAIN Flask app, not a scheduler sidecar.
//   - All requests flow through apiClient which enforces credentials:'include'.

import { get, post, upload, del, ApiError } from './apiClient'
import type {
  Story,
  TestCase,
  TestCaseListResponse,
  RawStory,
  RawTestCase,
  RawImpact,
  RawImpactedTestCaseDetail,
  RawImpactEvent,
  RawStoryTestCaseImpacts,
  Impact,
  ImpactDetails,
  ImpactAnalysisJson,
  ImpactEvent,
  ImpactedTestCaseDetail,
  StoryTestCaseImpacts,
  StoryImpactSummary,
  ProjectImpactSummary,
  ProjectStorySummary,
  PaginatedResponse,
  UploadStoryResponse,
  NextReloadResponse,
  SearchResponse,
  ProjectsResponse,
} from '@/types/domain'

// Re-export domain types so existing imports from '@/lib/api' keep working
// while components are migrated to import directly from '@/types/domain'.
export type {
  Story,
  TestCase,
  TestCaseListResponse,
  Impact,
  ImpactDetails,
  ImpactAnalysisJson,
  ImpactEvent,
  ImpactedTestCaseDetail,
  StoryTestCaseImpacts,
  StoryImpactSummary,
  ProjectImpactSummary,
  ProjectStorySummary,
  PaginatedResponse,
  UploadStoryResponse,
  NextReloadResponse,
  SearchResponse,
  ProjectsResponse,
} from '@/types/domain'
export { ApiError } from './apiClient'

// ─── Mock data ────────────────────────────────────────────────────────────────
// Used when the backend is unreachable (sets window.__DEMO_MODE__ = true).
// Shapes match normalized domain types (camelCase), NOT raw backend shapes.

const MOCK_STORIES: Story[] = [
  {
    id: 'PROJ-101', projectId: 'Alpha',
    description: 'As a user I want to log in with email and password so that I can access my account securely.',
    docContentText: 'The login page should accept an email and password. Validate both fields. On success redirect to dashboard. On failure show an error message. Lock account after 5 failed attempts.',
    testCaseCount: 8, embeddingTimestamp: '2025-04-10T09:30:00Z', testCaseCreatedTime: '2025-04-10T09:45:00Z',
    impactedTestCasesCount: 3, downloadUrl: '/api/stories/testcases/download/PROJ-101',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'in_review',
  },
  {
    id: 'PROJ-102', projectId: 'Alpha',
    description: 'As a user I want to reset my password via email so that I can regain access to my account.',
    docContentText: 'User clicks Forgot Password, enters email, receives a reset link. Link expires in 24 hours. New password must be at least 8 characters and contain a number.',
    testCaseCount: 6, embeddingTimestamp: '2025-04-11T11:10:00Z', testCaseCreatedTime: '2025-04-11T11:25:00Z',
    impactedTestCasesCount: 2, downloadUrl: '/api/stories/testcases/download/PROJ-102',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'in_progress',
  },
  {
    id: 'PROJ-103', projectId: 'Beta',
    description: 'As an admin I want to manage user roles so that I can control access to features.',
    docContentText: 'Admin can assign roles: Viewer, Editor, Admin. Role changes take effect immediately. Admin cannot remove their own Admin role. Audit log is created for every role change.',
    testCaseCount: 10, embeddingTimestamp: '2025-04-12T14:15:00Z', testCaseCreatedTime: '2025-04-12T14:30:00Z',
    impactedTestCasesCount: 5, downloadUrl: '/api/stories/testcases/download/PROJ-103',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'completed',
  },
  {
    id: 'PROJ-104', projectId: 'Beta',
    description: 'As a user I want to upload documents so that I can share files with my team.',
    docContentText: 'Support PDF, DOCX and TXT. Max file size 20MB. Show upload progress. Virus scan on upload. Notify team members on successful upload.',
    testCaseCount: 7, embeddingTimestamp: '2025-04-13T10:20:00Z', testCaseCreatedTime: '2025-04-13T10:35:00Z',
    impactedTestCasesCount: 0, downloadUrl: '/api/stories/testcases/download/PROJ-104',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'in_review',
  },
  {
    id: 'PROJ-105', projectId: 'Gamma',
    description: 'As a user I want to search for stories by keyword so that I can quickly find relevant items.',
    docContentText: 'Full-text search across story ID, description, and content. Results sorted by relevance. Search is debounced 300ms. No results state shows helpful message.',
    testCaseCount: 5, embeddingTimestamp: '2025-04-14T08:45:00Z', testCaseCreatedTime: '2025-04-14T09:00:00Z',
    impactedTestCasesCount: 1, downloadUrl: '/api/stories/testcases/download/PROJ-105',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'in_progress',
  },
  {
    id: 'PROJ-106', projectId: 'Gamma',
    description: 'As a user I want to view my notification history so that I can review past alerts.',
    docContentText: 'List all notifications ordered by date. Mark as read individually or all at once. Filter by type: info, warning, error. Notifications older than 30 days are archived.',
    testCaseCount: 4, embeddingTimestamp: '2025-04-15T13:10:00Z', testCaseCreatedTime: '2025-04-15T13:20:00Z',
    impactedTestCasesCount: 0, downloadUrl: '/api/stories/testcases/download/PROJ-106',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'completed',
  },
  {
    id: 'PROJ-107', projectId: 'Alpha',
    description: 'As a user I want to export data to CSV so that I can analyse results in Excel.',
    docContentText: 'Export button available on all table views. CSV includes all visible columns. Large exports (>1000 rows) are emailed as a download link. Progress indicator shown.',
    testCaseCount: 3, embeddingTimestamp: '2025-04-16T09:10:00Z', testCaseCreatedTime: '2025-04-16T09:20:00Z',
    impactedTestCasesCount: 2, downloadUrl: '/api/stories/testcases/download/PROJ-107',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'in_review',
  },
  {
    id: 'PROJ-108', projectId: 'Beta',
    description: 'As a user I want to filter results by date range so that I can focus on recent activity.',
    docContentText: 'Date picker with from/to fields. Validate that from <= to. Persist filter in URL params. Clear button resets to all dates.',
    testCaseCount: 6, embeddingTimestamp: '2025-04-17T11:15:00Z', testCaseCreatedTime: '2025-04-17T11:30:00Z',
    impactedTestCasesCount: 1, downloadUrl: '/api/stories/testcases/download/PROJ-108',
    source: { story: 'mock', testCases: 'backend' }, storyStatus: 'in_progress',
  },
]

const MOCK_TEST_CASES: Record<string, TestCase[]> = {
  'PROJ-101': [
    { id: 'TC-101-01', title: 'Login with valid credentials', priority: 'High', steps: ['Navigate to /login', 'Enter valid email: test@example.com', 'Enter valid password: Pass@123', 'Click Login button'], expectedResult: 'User is redirected to the dashboard. Welcome message displayed.' },
    { id: 'TC-101-02', title: 'Login with invalid password', priority: 'High', steps: ['Navigate to /login', 'Enter valid email: test@example.com', 'Enter wrong password: wrongpass', 'Click Login button'], expectedResult: "Error message shown: 'Invalid email or password'. User stays on login page." },
    { id: 'TC-101-03', title: 'Login with empty fields', priority: 'Medium', steps: ['Navigate to /login', 'Leave email and password empty', 'Click Login button'], expectedResult: 'Validation errors shown for both fields. Form not submitted.' },
    { id: 'TC-101-04', title: 'Account lockout after 5 failed attempts', priority: 'High', steps: ['Navigate to /login', 'Enter valid email', 'Enter wrong password 5 times consecutively', 'Attempt 6th login'], expectedResult: 'Account locked message shown. User cannot log in until unlocked.' },
    { id: 'TC-101-05', title: 'Login with invalid email format', priority: 'Low', steps: ['Navigate to /login', 'Enter malformed email: notanemail', 'Enter any password', 'Click Login button'], expectedResult: 'Email validation error shown. Form not submitted.' },
    { id: 'TC-101-06', title: 'Remember me functionality', priority: 'Medium', steps: ['Navigate to /login', 'Enter valid credentials', "Check 'Remember me'", 'Click Login', 'Close browser and reopen'], expectedResult: 'User session persists. User is automatically logged in.' },
    { id: 'TC-101-07', title: 'Login page accessibility', priority: 'Low', steps: ['Navigate to /login', 'Use tab key to navigate through form', 'Submit using keyboard Enter'], expectedResult: 'All form fields and button are keyboard accessible. No traps.' },
    { id: 'TC-101-08', title: 'Redirect after login', priority: 'Medium', steps: ['Navigate to a protected URL while logged out', 'Enter valid credentials on login page', 'Click Login'], expectedResult: 'User is redirected to the originally requested URL after login.' },
  ],
  'PROJ-102': [
    { id: 'TC-102-01', title: 'Password reset with valid email', priority: 'High', steps: ['Navigate to /forgot-password', 'Enter registered email: test@example.com', 'Click Send Reset Link'], expectedResult: 'Success message shown. Reset email sent.' },
    { id: 'TC-102-02', title: 'Password reset with unknown email', priority: 'Medium', steps: ['Navigate to /forgot-password', 'Enter unregistered email: nobody@test.com', 'Click Send Reset Link'], expectedResult: 'Generic success message shown (no email enumeration). No email sent.' },
    { id: 'TC-102-03', title: 'Reset link expiry after 24 hours', priority: 'High', steps: ['Request a password reset', 'Wait 25 hours', 'Click the reset link in email'], expectedResult: "Error page shown: 'Reset link has expired'. User prompted to request a new one." },
    { id: 'TC-102-04', title: 'Set new password successfully', priority: 'High', steps: ['Click valid reset link', 'Enter new password: NewPass@456', 'Confirm password', 'Click Reset Password'], expectedResult: 'Password updated. User redirected to login. Old password no longer works.' },
    { id: 'TC-102-05', title: 'Weak new password rejected', priority: 'Medium', steps: ['Click valid reset link', 'Enter weak password: 1234', 'Click Reset Password'], expectedResult: "Validation error: 'Password must be at least 8 characters with a number'." },
    { id: 'TC-102-06', title: 'Reset link can only be used once', priority: 'Medium', steps: ['Use a reset link to change password', 'Click the same reset link again'], expectedResult: "Error: 'Reset link already used'. User cannot reuse the link." },
  ],
  'PROJ-103': [
    { id: 'TC-103-01', title: 'Admin assigns Viewer role', priority: 'Medium', steps: ['Login as Admin', 'Navigate to User Management', 'Select a user', 'Assign Viewer role', 'Save'], expectedResult: 'Role updated. Audit log entry created. User sees limited features.' },
    { id: 'TC-103-02', title: 'Admin assigns Editor role', priority: 'Medium', steps: ['Login as Admin', 'Navigate to User Management', 'Select a user', 'Assign Editor role', 'Save'], expectedResult: 'Role updated. Audit log entry created. User gains edit permissions.' },
    { id: 'TC-103-03', title: 'Admin cannot remove own Admin role', priority: 'High', steps: ['Login as Admin', 'Navigate to own user profile in management', 'Attempt to change own role to Viewer'], expectedResult: "Error shown: 'Cannot change your own Admin role'. Change blocked." },
    { id: 'TC-103-04', title: 'Role change takes effect immediately', priority: 'High', steps: ["Admin changes a logged-in user's role to Viewer", 'User attempts to access an Editor-only feature'], expectedResult: 'User sees permission denied message without needing to log out and back in.' },
    { id: 'TC-103-05', title: 'Audit log created for role change', priority: 'Medium', steps: ["Admin changes a user's role", 'Navigate to Audit Log'], expectedResult: 'New entry shows: who changed, which user, from role, to role, timestamp.' },
    { id: 'TC-103-06', title: 'Non-admin cannot access user management', priority: 'High', steps: ['Login as Editor', 'Navigate to /admin/users'], expectedResult: 'Access denied. Redirected to dashboard with error message.' },
    { id: 'TC-103-07', title: 'Bulk role assignment', priority: 'Low', steps: ['Login as Admin', 'Select multiple users via checkboxes', 'Assign Viewer role in bulk', 'Confirm'], expectedResult: 'All selected users updated. Single audit log entry per user created.' },
    { id: 'TC-103-08', title: 'Role filter in user list', priority: 'Low', steps: ['Navigate to User Management', 'Filter by role: Admin'], expectedResult: 'Only Admin users shown in the list.' },
    { id: 'TC-103-09', title: 'View role history for a user', priority: 'Low', steps: ["Navigate to a user's profile in management", 'Click Role History tab'], expectedResult: 'All past role changes with timestamps and changed-by admin shown.' },
    { id: 'TC-103-10', title: 'Assign Admin role to a user', priority: 'High', steps: ['Login as Admin', 'Select a Viewer user', 'Assign Admin role', 'Save'], expectedResult: 'User gains Admin role. They can now manage other users.' },
  ],
}

const MOCK_DEFAULT_TC: TestCase[] = [
  { id: 'TC-DEFAULT-01', title: 'Happy path — primary workflow', priority: 'High', steps: ['Set up preconditions', 'Execute primary user action', 'Verify expected outcome'], expectedResult: 'Feature works as described in the story.' },
  { id: 'TC-DEFAULT-02', title: 'Validation — empty required fields', priority: 'Medium', steps: ['Leave all required fields blank', 'Submit the form'], expectedResult: 'Validation errors shown for each required field.' },
  { id: 'TC-DEFAULT-03', title: 'Boundary value — maximum input length', priority: 'Low', steps: ['Enter input at maximum allowed length', 'Submit'], expectedResult: 'System accepts input without error.' },
  { id: 'TC-DEFAULT-04', title: 'Error state — network failure', priority: 'Medium', steps: ['Disconnect network', 'Attempt the primary action'], expectedResult: 'Friendly error message shown. No data corruption.' },
]

const MOCK_IMPACT_DATA: StoryTestCaseImpacts = {
  storyId: 'PROJ-101',
  description: 'As a user I want to log in with email and password so that I can access my account securely.',
  totalTestCases: 24,
  impactedTestCasesCount: 3,
  impactPercentage: 12.5,
  severitySummary: { high: 1, medium: 1, low: 1 },
  testCases: [
    {
      testCaseId: 'TC-099-01', originalTitle: 'Login session timeout validation',
      originalExpectedResult: 'Session expired message shown, redirected to login.',
      originalSteps: ['Login with valid credentials', 'Wait 30 minutes without activity', 'Attempt any action'],
      impacts: [{
        impactId: '', impactingStoryId: 'PROJ-101', impactingStoryDescription: 'Login with email and password',
        createdOn: '2025-04-10T10:00:00Z', severity: 'high', priority: 1,
        details: 'Session management must be updated to support the new secure login flow.',
        analysisJson: JSON.stringify({ modification_reason: 'The new secure login flow introduces token-based sessions, which changes how session timeouts are validated.', modified_test_case: { title: 'Login session timeout — token-based validation', priority: 'High', steps: ['Login with valid credentials', 'Wait for session token expiry (30 min)', 'Attempt to access a protected resource'], expected_result: 'User receives 401 response. Redirected to login page with session-expired message.' } }),
      }],
    },
    {
      testCaseId: 'TC-099-02', originalTitle: 'Multi-device login behaviour',
      originalExpectedResult: 'Both sessions active, or oldest session invalidated based on config.',
      originalSteps: ['Login on device A', 'Login on device B', 'Check session on device A'],
      impacts: [{
        impactId: '', impactingStoryId: 'PROJ-101', impactingStoryDescription: 'Login with email and password',
        createdOn: '2025-04-10T10:05:00Z', severity: 'medium', priority: 2,
        details: 'New login flow must handle concurrent device sessions differently.',
        analysisJson: JSON.stringify({ modification_reason: 'Secure login now tracks device fingerprints, which affects multi-device session handling.', modified_test_case: { title: 'Multi-device login — device fingerprint tracking', priority: 'Medium', steps: ['Login on Device A', 'Login on Device B with same credentials', 'Check active sessions on Device A'], expected_result: 'Device A session remains active. Both devices shown in active sessions list.' } }),
      }],
    },
    {
      testCaseId: 'TC-099-03', originalTitle: 'Password field masking on login',
      originalExpectedResult: 'Password characters are masked with dots.',
      originalSteps: ['Navigate to login', 'Type in password field', 'Verify masking'],
      impacts: [{
        impactId: '', impactingStoryId: 'PROJ-101', impactingStoryDescription: 'Login with email and password',
        createdOn: '2025-04-10T10:10:00Z', severity: 'low', priority: 3,
        details: 'Show/hide toggle for password field added in new design.',
        analysisJson: JSON.stringify({ modification_reason: 'New login UI includes a show/hide password toggle which changes the masking test steps.', modified_test_case: { title: 'Password field masking with show/hide toggle', priority: 'Low', steps: ['Navigate to login page', 'Type in password field', 'Verify characters are masked by default', 'Click show/hide toggle', 'Verify password is now visible'], expected_result: 'Password is masked by default. Toggle correctly reveals and re-masks the password.' } }),
      }],
    },
  ],
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function activateMockMode() {
  if (typeof window !== 'undefined') (window as any).__DEMO_MODE__ = true
}

function tryParseJsonArray(val: string): string[] {
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// ─── Normalizers (internal — never exported to components) ────────────────────

function normalizePriority(p: unknown): 'High' | 'Medium' | 'Low' {
  const s = String(p ?? '').toLowerCase()
  if (s === 'high') return 'High'
  if (s === 'low') return 'Low'
  return 'Medium'
}

function normalizeStory(raw: RawStory): Story {
  const src = raw.source
  const source: { story: string; testCases: string } =
    src !== null && src !== undefined && typeof src === 'object' && 'story' in (src as object)
      ? { story: (src as any).story, testCases: (src as any).test_cases ?? 'backend' }
      : { story: String(src ?? 'backend'), testCases: 'backend' }

  return {
    id: String(raw.id),
    description: raw.description ?? '',
    projectId: raw.project_id ?? '',
    testCaseCount: Number(raw.test_case_count ?? 0),
    // Both field names exist on raw stories; merge into one normalized number.
    impactedTestCasesCount: Number(raw.impactedTestCases ?? raw.impacted_test_cases_count ?? 0),
    testCaseCreatedTime: raw.test_case_created_time ?? null,
    embeddingTimestamp: raw.embedding_timestamp ?? null,
    docContentText: raw.doc_content_text ?? raw.document_content ?? null,
    source,
    // ALWAYS computed — never sourced from raw.download_link (broken backend route).
    downloadUrl: '/api/stories/testcases/download/' + String(raw.id),
    storyStatus: (raw.story_status as any) ?? 'in_review',
  }
}

function normalizeTestCase(raw: RawTestCase): TestCase {
  return {
    id: String(raw.id ?? raw.test_case_id ?? ''),
    title: raw.title,
    // test_steps is the alias on the single-test endpoint; steps is used by the list endpoint.
    steps: Array.isArray(raw.steps)
      ? raw.steps
      : Array.isArray(raw.test_steps)
      ? raw.test_steps
      : [],
    expectedResult: raw.expected_result ?? '',
    priority: normalizePriority(raw.priority),
    severity:
      raw.severity !== undefined
        ? (String(raw.severity).toLowerCase() as 'high' | 'medium' | 'low')
        : undefined,
  }
}

function normalizeImpactAnalysisJson(raw: unknown): ImpactAnalysisJson | null {
  try {
    const obj: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj === null || typeof obj !== 'object') return null
    const r = obj as Record<string, unknown>
    const mt = (r.modified_test_case ?? r.modifiedTestCase) as Record<string, unknown> | undefined
    if (!mt) return null
    return {
      originalTestCaseId: String(r.original_test_case_id ?? r.originalTestCaseId ?? ''),
      modificationReason: String(r.modification_reason ?? r.modificationReason ?? ''),
      impactSeverity: String(r.impact_severity ?? r.impactSeverity ?? ''),
      severityReason: String(r.severity_reason ?? r.severityReason ?? ''),
      modifiedTestCase: {
        id: String(mt.id ?? ''),
        title: String(mt.title ?? ''),
        steps: Array.isArray(mt.steps) ? (mt.steps as string[]) : [],
        expectedResult: String(mt.expected_result ?? mt.expectedResult ?? ''),
        priority: String(mt.priority ?? 'Medium'),
      },
    }
  } catch {
    return null
  }
}

function normalizeImpactDetails(raw: unknown): ImpactDetails {
  try {
    const obj: unknown = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (obj === null || typeof obj !== 'object') {
      return { modificationReason: '', severityReason: '', changes: {} }
    }
    const r = obj as Record<string, unknown>
    const ch = (r.changes ?? {}) as Record<string, unknown>
    return {
      modificationReason: String(r.modification_reason ?? r.modificationReason ?? ''),
      severityReason: String(r.severity_reason ?? r.severityReason ?? ''),
      changes: {
        title: ch.title !== undefined ? String(ch.title) : undefined,
        steps: Array.isArray(ch.steps) ? (ch.steps as string[]) : undefined,
        expectedResult:
          ch.expected_result !== undefined
            ? String(ch.expected_result)
            : ch.expectedResult !== undefined
            ? String(ch.expectedResult)
            : undefined,
      },
    }
  } catch {
    return { modificationReason: '', severityReason: '', changes: {} }
  }
}

function normalizeImpact(raw: RawImpact): Impact {
  return {
    impactId: String(raw.impact_id ?? ''),
    newStoryId: String(raw.new_story_id ?? ''),
    originalStoryId: String(raw.original_story_id ?? ''),
    originalTestCaseId: String(raw.original_test_case_id ?? ''),
    modifiedTestCaseId: String(raw.modified_test_case_id ?? ''),
    createdOn: raw.impact_created_on ?? '',
    severity: (String(raw.impact_severity ?? 'low').toLowerCase()) as 'high' | 'medium' | 'low',
    priority: Number(raw.impact_priority ?? 0),
    status: raw.impact_status === 'active' ? 'active' : 'inactive',
    impactDetails: normalizeImpactDetails(raw.impact_details),
    analysisJson: raw.impact_analysis_json
      ? normalizeImpactAnalysisJson(raw.impact_analysis_json)
      : null,
    originalStoryDescription: raw.original_story_description,
    newStoryDescription: raw.new_story_description,
  }
}

function normalizeImpactEvent(raw: RawImpactEvent): ImpactEvent {
  return {
    impactId: String(raw.impact_id ?? ''),
    impactingStoryId: String(raw.impacting_story_id ?? ''),
    impactingStoryDescription: raw.impacting_story_description ?? '',
    createdOn: raw.impact_created_on ?? null,
    severity: (String(raw.impact_severity ?? 'low').toLowerCase()) as 'high' | 'medium' | 'low',
    priority: Number(raw.impact_priority ?? 0),
    details: String(raw.impact_details ?? ''),
    analysisJson:
      typeof raw.impact_analysis_json === 'object' && raw.impact_analysis_json !== null
        ? JSON.stringify(raw.impact_analysis_json)
        : String(raw.impact_analysis_json ?? ''),
  }
}

function normalizeImpactedTestCaseDetail(raw: RawImpactedTestCaseDetail): ImpactedTestCaseDetail {
  return {
    testCaseId: String(raw.test_case_id),
    originalTitle: raw.original_title,
    originalExpectedResult: raw.original_expected_result,
    originalSteps: Array.isArray(raw.original_steps)
      ? raw.original_steps
      : tryParseJsonArray(raw.original_steps as string),
    impacts: (raw.impacts ?? []).map(normalizeImpactEvent),
  }
}

function normalizeStoryTestCaseImpacts(raw: RawStoryTestCaseImpacts): StoryTestCaseImpacts {
  return {
    storyId: String(raw.story_id ?? ''),
    description: raw.story_description ?? '',
    totalTestCases: Number(raw.total_test_cases ?? 0),
    impactedTestCasesCount: Number(raw.impacted_test_cases_count ?? 0),
    impactPercentage: Number(raw.impact_percentage ?? 0),
    severitySummary: {
      high: Number(raw.severity_summary?.high ?? 0),
      medium: Number(raw.severity_summary?.medium ?? 0),
      low: Number(raw.severity_summary?.low ?? 0),
    },
    // Field is testCases (not impactedTestCases) — see StoryTestCaseImpacts in domain.ts.
    testCases: (raw.impacted_test_cases ?? []).map(normalizeImpactedTestCaseDetail),
  }
}

function normalizePaginatedStories(raw: {
  stories: RawStory[]
  pagination: Record<string, unknown>
}): PaginatedResponse<Story> {
  const p = raw.pagination
  return {
    data: raw.stories.map(normalizeStory),
    pagination: {
      total: Number(p.total ?? 0),
      page: Number(p.page ?? 1),
      perPage: Number(p.per_page ?? 10),
      totalPages:
        p.total_pages != null
          ? Number(p.total_pages)
          : Math.ceil(Number(p.total ?? 0) / Number(p.per_page ?? 10)),
    },
  }
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  async getStories(
    page = 1,
    perPage = 10,
    from_date?: string,
    to_date?: string,
    project_id?: string,
    sort_order: 'desc' | 'asc' = 'desc',
  ): Promise<PaginatedResponse<Story>> {
    try {
      let url = `/api/stories/?page=${page}&per_page=${perPage}&sort_order=${sort_order}`
      if (from_date) url += `&from_date=${encodeURIComponent(from_date)}`
      if (to_date) url += `&to_date=${encodeURIComponent(to_date)}`
      if (project_id) url += `&project_id=${encodeURIComponent(project_id)}`
      const data = await get<{ stories: RawStory[]; pagination: Record<string, unknown> }>(url)
      return normalizePaginatedStories(data)
    } catch (error: any) {
      if (error?.message === 'BACKEND_UNREACHABLE') {
        activateMockMode()
        let stories = [...MOCK_STORIES]
        if (project_id) stories = stories.filter((s) => s.projectId === project_id)
        if (sort_order === 'asc') {
          stories.sort((a, b) =>
            (a.testCaseCreatedTime ?? '').localeCompare(b.testCaseCreatedTime ?? ''),
          )
        } else {
          stories.sort((a, b) =>
            (b.testCaseCreatedTime ?? '').localeCompare(a.testCaseCreatedTime ?? ''),
          )
        }
        const start = (page - 1) * perPage
        const paged = stories.slice(start, start + perPage)
        return {
          data: paged,
          pagination: {
            total: stories.length, page, perPage,
            totalPages: Math.ceil(stories.length / perPage),
          },
        }
      }
      throw error
    }
  },

  async getStory(storyId: string): Promise<Story> {
    try {
      const data = await get<RawStory>(`/api/stories/${storyId}`)
      return normalizeStory(data)
    } catch (error: any) {
      if (error?.message === 'BACKEND_UNREACHABLE') {
        activateMockMode()
        const found = MOCK_STORIES.find((s) => s.id === storyId)
        if (found) return found
        throw new ApiError(404, { error: 'Story not found' })
      }
      throw error
    }
  },

  async searchStories(query: string, limit = 3): Promise<SearchResponse> {
    try {
      const data = await post<{ stories: RawStory[] }>(`/api/stories/search`, {
        query,
        limit,
      })
      return { stories: data.stories.map(normalizeStory) }
    } catch (error: any) {
      if (error?.message === 'BACKEND_UNREACHABLE') {
        activateMockMode()
        const q = query.toLowerCase()
        const matches = MOCK_STORIES.filter(
          (s) =>
            s.id.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            (s.docContentText ?? '').toLowerCase().includes(q),
        ).slice(0, limit)
        return { stories: matches }
      }
      throw error
    }
  },

  async getTestCases(storyId: string): Promise<TestCaseListResponse> {
    try {
      const data = await get<any>(`/api/stories/${storyId}/testcases`)
      return {
        storyId: String(data.storyID ?? storyId),
        description: data.storyDescription ?? '',
        projectId: data.project_id ?? '',
        testCases: (data.testcases ?? []).map(normalizeTestCase),
      }
    } catch (error: any) {
      if (error?.message === 'BACKEND_UNREACHABLE') {
        activateMockMode()
        const story = MOCK_STORIES.find((s) => s.id === storyId)
        const tcs = MOCK_TEST_CASES[storyId] ?? MOCK_DEFAULT_TC
        return {
          storyId,
          description: story?.description ?? '',
          projectId: story?.projectId ?? '',
          testCases: tcs,
        }
      }
      throw error
    }
  },

  async getSingleTestCase(storyId: string, testCaseId: string): Promise<TestCase> {
    // normalizeTestCase handles the test_steps → steps alias from the single-test endpoint.
    const data = await get<RawTestCase>(
      `/api/stories/${storyId}/test-cases/${testCaseId}`,
    )
    return normalizeTestCase(data)
  },

  async getProjects(): Promise<ProjectsResponse> {
    try {
      const data = await get<ProjectsResponse>(`/api/stories/projects`)
      return data
    } catch (error: any) {
      if (error?.message === 'BACKEND_UNREACHABLE') {
        activateMockMode()
        const projects = Array.from(new Set(MOCK_STORIES.map((s) => s.projectId)))
        return { projects }
      }
      throw error
    }
  },

  async uploadStory(formData: FormData): Promise<UploadStoryResponse> {
    const data = await upload<any>(`/api/stories/upload`, formData)
    return {
      storyId: String(data.story_id ?? data.storyId ?? ''),
      projectId: String(data.project_id ?? data.projectId ?? ''),
      description: String(data.description ?? ''),
      testCasesGenerated: Boolean(data.test_cases_generated ?? data.testCasesGenerated ?? false),
      fileProcessed: Boolean(data.file_processed ?? data.fileProcessed ?? false),
      source: String(data.source ?? 'backend'),
      message: String(data.message ?? ''),
    }
  },

  async ragChat(query: string): Promise<{ testCases: TestCase[] }> {
    const data = await post<any>(`/api/stories/rag-chat`, { query })
    const raw: unknown[] = data.testCases ?? data.test_cases ?? []
    return { testCases: raw.map((tc) => normalizeTestCase(tc as RawTestCase)) }
  },

  /** Permanently delete a story (and its test cases / impacts / vector),
   *  scoped to the current workspace on the backend. */
  async deleteStory(storyId: string): Promise<void> {
    await del<any>(`/api/stories/${encodeURIComponent(storyId)}`)
  },

  async getStoryImpacts(storyId: string): Promise<StoryImpactSummary> {
    const data = await get<any>(`/api/stories/impacts/story/${storyId}`)
    return {
      storyId: String(data.story_id ?? storyId),
      totalImpacts: Number(data.total_impacts ?? 0),
      causedImpacts: (data.caused_impacts ?? []).map(normalizeImpact),
      receivedImpacts: (data.received_impacts ?? []).map(normalizeImpact),
    }
  },

  async getStoryTestCaseImpacts(
    storyId: string,
    projectId: string,
  ): Promise<StoryTestCaseImpacts> {
    try {
      const data = await get<RawStoryTestCaseImpacts>(
        `/api/stories/impacts/story-test-cases/${storyId}?project_id=${encodeURIComponent(projectId)}`,
      )
      return normalizeStoryTestCaseImpacts(data)
    } catch (error: any) {
      if (error?.message === 'BACKEND_UNREACHABLE') {
        activateMockMode()
        if (storyId === 'PROJ-101') return MOCK_IMPACT_DATA
        return {
          storyId, description: '',
          totalTestCases: 0, impactedTestCasesCount: 0,
          impactPercentage: 0, severitySummary: { high: 0, medium: 0, low: 0 },
          testCases: [],
        }
      }
      throw error
    }
  },

  async getProjectImpacts(
    projectId: string,
  ): Promise<{ projectId: string; totalImpacts: number; impacts: Impact[] }> {
    const data = await get<any>(`/api/stories/impacts/${projectId}`)
    return {
      projectId: String(data.project_id ?? projectId),
      totalImpacts: Number(data.total_impacts ?? 0),
      impacts: (data.impacts ?? []).map(normalizeImpact),
    }
  },

  async getProjectImpactSummary(projectId: string): Promise<ProjectImpactSummary> {
    const data = await get<any>(`/api/stories/impacts/summary/${projectId}`)
    const summaries: ProjectStorySummary[] = (data.summaries ?? data.stories ?? []).map(
      (r: any): ProjectStorySummary => ({
        storyId: String(r.story_id ?? r.storyId ?? ''),
        projectId: String(r.project_id ?? r.projectId ?? ''),
        description: String(r.description ?? r.story_description ?? ''),
        testCaseGeneratedOn: r.test_case_generated_on ?? r.testCaseGeneratedOn ?? null,
        totalImpacts: Number(r.total_impacts ?? r.totalImpacts ?? 0),
        hasCausedImpacts: Boolean(r.has_caused_impacts ?? r.hasCausedImpacts ?? false),
        hasReceivedImpacts: Boolean(r.has_received_impacts ?? r.hasReceivedImpacts ?? false),
      }),
    )
    return {
      projectId: String(data.project_id ?? projectId),
      totalStories: Number(data.total_stories ?? summaries.length),
      storiesWithImpacts: Number(data.stories_with_impacts ?? 0),
      summaries,
    }
  },

  async triggerImpactAnalysis(
    storyId: string,
    projectId: string,
  ): Promise<{ message: string }> {
    return post<{ message: string }>(`/api/stories/impacts/analyze`, {
      story_id: storyId,
      project_id: projectId,
    })
  },

  /** Calls the MAIN Flask app — NOT a separate scheduler service. */
  async getNextReload(): Promise<NextReloadResponse> {
    const data = await get<any>(`/api/stories/next-reload`)
    return {
      nextReload: String(data.next_reload ?? data.fallback_next_reload ?? ''),
      source: data.source === 'file' ? 'file' : 'fallback',
    }
  },

  /** Calls the MAIN Flask app — NOT a separate scheduler service. */
  async triggerReload(): Promise<{ message: string }> {
    return post<{ message: string }>(`/api/stories/trigger-reload`, {})
  },

  async updateStoryStatus(
    storyId: string,
    status: 'in_review' | 'in_progress' | 'completed'
  ): Promise<{ story_id: string; status: string }> {
    return post(`/api/stories/${storyId}/status`, { status })
  },

  async getStoryQuality(storyId: string): Promise<{
    overall_score: number;
    completeness: number;
    clarity: number;
    testability: number;
    issues: Array<{ title: string; description: string; area: string }>;
    risk_areas: Array<{ area: string; severity: string; description: string }>;
    recommendations: string[];
  }> {
    return get(`/api/stories/${storyId}/quality`)
  },

  async generateStoriesFromRequirements(
    formData: FormData
  ): Promise<{
    stories: Array<{
      id: string;
      title: string;
      narrative: string;
      acceptance_criteria: string[];
      status: string;
    }>;
    source_length: number;
    project_id: string;
  }> {
    return upload(`/api/stories/generate-from-requirements`, formData)
  },

  // ── Version history & regeneration ────────────────────────────────────────

  async getStoryVersions(storyId: string): Promise<{
    story_id: string;
    versions: Array<{ version_id: string; version_number: number; description: string | null; created_on: string; run_id: string | null }>;
  }> {
    return get(`/api/stories/${storyId}/versions`)
  },

  async regenerateTests(storyId: string): Promise<{ message: string; story_id: string }> {
    return post(`/api/stories/${storyId}/regenerate`, {})
  },

  async approveTestCase(storyId: string, testCaseId: string, status: 'Approved' | 'Pending' | 'Rejected' = 'Approved'): Promise<{ test_case_id: string; status: string }> {
    return post(`/api/stories/${storyId}/testcases/${testCaseId}/status`, { status })
  },

  async updateTestCase(storyId: string, testCaseId: string, data: {
    title?: string; steps?: string[]; expected_result?: string; priority?: string;
  }): Promise<{ test_case_id: string; updated: boolean }> {
    const { request } = await import('./apiClient')
    return request(`/api/stories/${storyId}/testcases/${testCaseId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async deleteTestCase(storyId: string, testCaseId: string): Promise<{ deleted: string; remaining: number }> {
    const { request } = await import('./apiClient')
    return request(`/api/stories/${storyId}/testcases/${testCaseId}`, { method: 'DELETE' })
  },

  async regenerateSingleTestCase(
    storyId: string,
    testCaseId: string,
    instructions?: string,
    file?: File,
  ): Promise<{ test_case_id: string; test_case: any }> {
    if (instructions || file) {
      const fd = new FormData()
      if (instructions) fd.append('instructions', instructions)
      if (file) fd.append('file', file)
      return upload(`/api/stories/${storyId}/testcases/${testCaseId}/regenerate`, fd)
    }
    return post(`/api/stories/${storyId}/testcases/${testCaseId}/regenerate`, {})
  },

  async bulkRegenerateTestCases(
    storyId: string,
    testCaseIds: string[],
    instructions?: string,
    file?: File,
  ): Promise<{ updated: string[]; test_cases: any[] }> {
    const fd = new FormData()
    testCaseIds.forEach((id) => fd.append('test_case_ids', id))
    if (instructions) fd.append('instructions', instructions)
    if (file) fd.append('file', file)
    return upload(`/api/stories/${storyId}/testcases/bulk-regenerate`, fd)
  },

  async refineTestCase(
    storyId: string,
    testCaseId: string,
    opts: {
      instructions: string;
      current_title: string;
      current_steps: string[];
      current_expected: string;
      current_priority: string;
      file?: File;
    }
  ): Promise<{ test_case_id: string; test_case: any }> {
    if (opts.file) {
      const fd = new FormData()
      fd.append('instructions', opts.instructions)
      fd.append('current_title', opts.current_title)
      fd.append('current_steps', JSON.stringify(opts.current_steps))
      fd.append('current_expected', opts.current_expected)
      fd.append('current_priority', opts.current_priority)
      fd.append('file', opts.file)
      return upload(`/api/stories/${storyId}/testcases/${testCaseId}/refine`, fd)
    }
    return post(`/api/stories/${storyId}/testcases/${testCaseId}/refine`, {
      instructions: opts.instructions,
      current_title: opts.current_title,
      current_steps: opts.current_steps,
      current_expected: opts.current_expected,
      current_priority: opts.current_priority,
    })
  },

  async uploadNewVersion(storyId: string, formData: FormData): Promise<{
    message: string; story_id: string; version_number: number; description: string;
  }> {
    return upload(`/api/stories/${storyId}/upload-version`, formData)
  },

  // ── Review endpoints (INTEGRATION_PLAN Gap 2) ──────────────────────────────

  async reviewImpact(
    impactId: string,
    action: 'accept' | 'reject' | 'edit',
    editedTestCase?: { title: string; steps: string[]; expected_result: string; priority: string }
  ): Promise<{ impact_id: string; new_status: string; message: string }> {
    return post(`/api/stories/impacts/${impactId}/review`, {
      action,
      edited_test_case: editedTestCase,
    })
  },

  async batchReviewImpacts(
    projectId: string,
    newStoryId: string,
    reviews: Array<{ impact_id: string; action: 'accept' | 'reject' | 'edit'; edited_test_case?: object }>
  ): Promise<{ message: string; accepted: number; rejected: number; edited: number; change_request_status: string }> {
    return post(`/api/stories/impacts/batch-review`, {
      project_id: projectId,
      new_story_id: newStoryId,
      reviews,
    })
  },

  async getChanges(params?: {
    projectId?: string;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    page?: number;
    perPage?: number;
  }): Promise<{
    changes: Array<{
      change_id: string;
      new_story_id: string;
      new_story_description: string;
      project_id: string;
      created_on: string;
      stories_affected: number;
      tests_affected: number;
      overall_severity: string;
      status: 'pending' | 'approved' | 'rejected';
    }>;
    pagination: { total: number; page: number; per_page: number; total_pages: number };
  }> {
    const q = new URLSearchParams()
    if (params?.projectId) q.set('project_id', params.projectId)
    if (params?.status) q.set('status', params.status)
    if (params?.page) q.set('page', String(params.page))
    if (params?.perPage) q.set('per_page', String(params.perPage))
    const qs = q.toString()
    return get(`/api/stories/changes${qs ? '?' + qs : ''}`)
  },
}
