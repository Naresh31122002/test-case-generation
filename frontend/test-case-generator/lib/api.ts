// API Base URLs with fallbacks
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000";
const SCHEDULER_API_URL = process.env.NEXT_PUBLIC_SCHEDULER_API_URL || "http://127.0.0.1:5001";

// ─── Mock data (used when backend is unreachable) ────────────────────────────
const MOCK_STORIES: Story[] = [
  {
    id: "PROJ-101", project_id: "Alpha", description: "As a user I want to log in with email and password so that I can access my account securely.",
    doc_content_text: "The login page should accept an email and password. Validate both fields. On success redirect to dashboard. On failure show an error message. Lock account after 5 failed attempts.",
    created_on: "2025-04-10T09:15:00Z", test_case_count: 8, embedding_timestamp: "2025-04-10T09:30:00Z",
    test_case_created_time: "2025-04-10T09:45:00Z", impactedTestCases: 3,
  },
  {
    id: "PROJ-102", project_id: "Alpha", description: "As a user I want to reset my password via email so that I can regain access to my account.",
    doc_content_text: "User clicks Forgot Password, enters email, receives a reset link. Link expires in 24 hours. New password must be at least 8 characters and contain a number.",
    created_on: "2025-04-11T11:00:00Z", test_case_count: 6, embedding_timestamp: "2025-04-11T11:10:00Z",
    test_case_created_time: "2025-04-11T11:25:00Z", impactedTestCases: 2,
  },
  {
    id: "PROJ-103", project_id: "Beta", description: "As an admin I want to manage user roles so that I can control access to features.",
    doc_content_text: "Admin can assign roles: Viewer, Editor, Admin. Role changes take effect immediately. Admin cannot remove their own Admin role. Audit log is created for every role change.",
    created_on: "2025-04-12T14:00:00Z", test_case_count: 10, embedding_timestamp: "2025-04-12T14:15:00Z",
    test_case_created_time: "2025-04-12T14:30:00Z", impactedTestCases: 5,
  },
  {
    id: "PROJ-104", project_id: "Beta", description: "As a user I want to upload documents so that I can share files with my team.",
    doc_content_text: "Support PDF, DOCX and TXT. Max file size 20MB. Show upload progress. Virus scan on upload. Notify team members on successful upload.",
    created_on: "2025-04-13T10:00:00Z", test_case_count: 7, embedding_timestamp: "2025-04-13T10:20:00Z",
    test_case_created_time: "2025-04-13T10:35:00Z", impactedTestCases: 0,
  },
  {
    id: "PROJ-105", project_id: "Gamma", description: "As a user I want to search for stories by keyword so that I can quickly find relevant items.",
    doc_content_text: "Full-text search across story ID, description, and content. Results sorted by relevance. Search is debounced 300ms. No results state shows helpful message.",
    created_on: "2025-04-14T08:30:00Z", test_case_count: 5, embedding_timestamp: "2025-04-14T08:45:00Z",
    test_case_created_time: "2025-04-14T09:00:00Z", impactedTestCases: 1,
  },
  {
    id: "PROJ-106", project_id: "Gamma", description: "As a user I want to view my notification history so that I can review past alerts.",
    doc_content_text: "List all notifications ordered by date. Mark as read individually or all at once. Filter by type: info, warning, error. Notifications older than 30 days are archived.",
    created_on: "2025-04-15T13:00:00Z", test_case_count: 4, embedding_timestamp: "2025-04-15T13:10:00Z",
    test_case_created_time: "2025-04-15T13:20:00Z", impactedTestCases: 0,
  },
  {
    id: "PROJ-107", project_id: "Alpha", description: "As a user I want to export data to CSV so that I can analyse results in Excel.",
    doc_content_text: "Export button available on all table views. CSV includes all visible columns. Large exports (>1000 rows) are emailed as a download link. Progress indicator shown.",
    created_on: "2025-04-16T09:00:00Z", test_case_count: 3, embedding_timestamp: "2025-04-16T09:10:00Z",
    test_case_created_time: "2025-04-16T09:20:00Z", impactedTestCases: 2,
  },
  {
    id: "PROJ-108", project_id: "Beta", description: "As a user I want to filter results by date range so that I can focus on recent activity.",
    doc_content_text: "Date picker with from/to fields. Validate that from <= to. Persist filter in URL params. Clear button resets to all dates.",
    created_on: "2025-04-17T11:00:00Z", test_case_count: 6, embedding_timestamp: "2025-04-17T11:15:00Z",
    test_case_created_time: "2025-04-17T11:30:00Z", impactedTestCases: 1,
  },
];

const MOCK_TEST_CASES: Record<string, TestCase[]> = {
  "PROJ-101": [
    { test_case_id: "TC-101-01", title: "Login with valid credentials", priority: "high", isImpacted: true, steps: ["Navigate to /login", "Enter valid email: test@example.com", "Enter valid password: Pass@123", "Click Login button"], expected_result: "User is redirected to the dashboard. Welcome message displayed." },
    { test_case_id: "TC-101-02", title: "Login with invalid password", priority: "high", isImpacted: true, steps: ["Navigate to /login", "Enter valid email: test@example.com", "Enter wrong password: wrongpass", "Click Login button"], expected_result: "Error message shown: 'Invalid email or password'. User stays on login page." },
    { test_case_id: "TC-101-03", title: "Login with empty fields", priority: "medium", steps: ["Navigate to /login", "Leave email and password empty", "Click Login button"], expected_result: "Validation errors shown for both fields. Form not submitted." },
    { test_case_id: "TC-101-04", title: "Account lockout after 5 failed attempts", priority: "high", steps: ["Navigate to /login", "Enter valid email", "Enter wrong password 5 times consecutively", "Attempt 6th login"], expected_result: "Account locked message shown. User cannot log in until unlocked." },
    { test_case_id: "TC-101-05", title: "Login with invalid email format", priority: "low", steps: ["Navigate to /login", "Enter malformed email: notanemail", "Enter any password", "Click Login button"], expected_result: "Email validation error shown. Form not submitted." },
    { test_case_id: "TC-101-06", title: "Remember me functionality", priority: "medium", steps: ["Navigate to /login", "Enter valid credentials", "Check 'Remember me'", "Click Login", "Close browser and reopen"], expected_result: "User session persists. User is automatically logged in." },
    { test_case_id: "TC-101-07", title: "Login page accessibility", priority: "low", steps: ["Navigate to /login", "Use tab key to navigate through form", "Submit using keyboard Enter"], expected_result: "All form fields and button are keyboard accessible. No traps." },
    { test_case_id: "TC-101-08", title: "Redirect after login", priority: "medium", steps: ["Navigate to a protected URL while logged out", "Enter valid credentials on login page", "Click Login"], expected_result: "User is redirected to the originally requested URL after login." },
  ],
  "PROJ-102": [
    { test_case_id: "TC-102-01", title: "Password reset with valid email", priority: "high", steps: ["Navigate to /forgot-password", "Enter registered email: test@example.com", "Click Send Reset Link"], expected_result: "Success message shown. Reset email sent." },
    { test_case_id: "TC-102-02", title: "Password reset with unknown email", priority: "medium", steps: ["Navigate to /forgot-password", "Enter unregistered email: nobody@test.com", "Click Send Reset Link"], expected_result: "Generic success message shown (no email enumeration). No email sent." },
    { test_case_id: "TC-102-03", title: "Reset link expiry after 24 hours", priority: "high", steps: ["Request a password reset", "Wait 25 hours", "Click the reset link in email"], expected_result: "Error page shown: 'Reset link has expired'. User prompted to request a new one." },
    { test_case_id: "TC-102-04", title: "Set new password successfully", priority: "high", steps: ["Click valid reset link", "Enter new password: NewPass@456", "Confirm password", "Click Reset Password"], expected_result: "Password updated. User redirected to login. Old password no longer works." },
    { test_case_id: "TC-102-05", title: "Weak new password rejected", priority: "medium", steps: ["Click valid reset link", "Enter weak password: 1234", "Click Reset Password"], expected_result: "Validation error: 'Password must be at least 8 characters with a number'." },
    { test_case_id: "TC-102-06", title: "Reset link can only be used once", priority: "medium", steps: ["Use a reset link to change password", "Click the same reset link again"], expected_result: "Error: 'Reset link already used'. User cannot reuse the link." },
  ],
  "PROJ-103": [
    { test_case_id: "TC-103-01", title: "Admin assigns Viewer role", priority: "medium", steps: ["Login as Admin", "Navigate to User Management", "Select a user", "Assign Viewer role", "Save"], expected_result: "Role updated. Audit log entry created. User sees limited features." },
    { test_case_id: "TC-103-02", title: "Admin assigns Editor role", priority: "medium", steps: ["Login as Admin", "Navigate to User Management", "Select a user", "Assign Editor role", "Save"], expected_result: "Role updated. Audit log entry created. User gains edit permissions." },
    { test_case_id: "TC-103-03", title: "Admin cannot remove own Admin role", priority: "high", steps: ["Login as Admin", "Navigate to own user profile in management", "Attempt to change own role to Viewer"], expected_result: "Error shown: 'Cannot change your own Admin role'. Change blocked." },
    { test_case_id: "TC-103-04", title: "Role change takes effect immediately", priority: "high", steps: ["Admin changes a logged-in user's role to Viewer", "User attempts to access an Editor-only feature"], expected_result: "User sees permission denied message without needing to log out and back in." },
    { test_case_id: "TC-103-05", title: "Audit log created for role change", priority: "medium", steps: ["Admin changes a user's role", "Navigate to Audit Log"], expected_result: "New entry shows: who changed, which user, from role, to role, timestamp." },
    { test_case_id: "TC-103-06", title: "Non-admin cannot access user management", priority: "high", steps: ["Login as Editor", "Navigate to /admin/users"], expected_result: "Access denied. Redirected to dashboard with error message." },
    { test_case_id: "TC-103-07", title: "Bulk role assignment", priority: "low", steps: ["Login as Admin", "Select multiple users via checkboxes", "Assign Viewer role in bulk", "Confirm"], expected_result: "All selected users updated. Single audit log entry per user created." },
    { test_case_id: "TC-103-08", title: "Role filter in user list", priority: "low", steps: ["Navigate to User Management", "Filter by role: Admin"], expected_result: "Only Admin users shown in the list." },
    { test_case_id: "TC-103-09", title: "View role history for a user", priority: "low", steps: ["Navigate to a user's profile in management", "Click Role History tab"], expected_result: "All past role changes with timestamps and changed-by admin shown." },
    { test_case_id: "TC-103-10", title: "Assign Admin role to a user", priority: "high", steps: ["Login as Admin", "Select a Viewer user", "Assign Admin role", "Save"], expected_result: "User gains Admin role. They can now manage other users." },
  ],
};

// Default test cases for stories not explicitly mocked
const MOCK_DEFAULT_TC: TestCase[] = [
  { test_case_id: "TC-DEFAULT-01", title: "Happy path — primary workflow", priority: "high", steps: ["Set up preconditions", "Execute primary user action", "Verify expected outcome"], expected_result: "Feature works as described in the story." },
  { test_case_id: "TC-DEFAULT-02", title: "Validation — empty required fields", priority: "medium", steps: ["Leave all required fields blank", "Submit the form"], expected_result: "Validation errors shown for each required field." },
  { test_case_id: "TC-DEFAULT-03", title: "Boundary value — maximum input length", priority: "low", steps: ["Enter input at maximum allowed length", "Submit"], expected_result: "System accepts input without error." },
  { test_case_id: "TC-DEFAULT-04", title: "Error state — network failure", priority: "medium", steps: ["Disconnect network", "Attempt the primary action"], expected_result: "Friendly error message shown. No data corruption." },
];

const MOCK_IMPACT_DATA: Record<string, any> = {
  "PROJ-101": {
    total_test_cases: "24", impacted_test_cases_count: "3", impact_percentage: "12.5",
    severity_summary: { high: "1", medium: "1", low: "1" },
    impacted_test_cases: [
      {
        test_case_id: "TC-099-01", original_title: "Login session timeout validation",
        impacts: [{
          impact_severity: "high", impact_priority: "high",
          impacting_story_id: "PROJ-101", impacting_story_description: "Login with email and password",
          impact_details: "Session management must be updated to support the new secure login flow.",
          impact_created_on: "2025-04-10T10:00:00Z",
          impact_analysis_json: JSON.stringify({
            modification_reason: "The new secure login flow introduces token-based sessions, which changes how session timeouts are validated.",
            modified_test_case: {
              title: "Login session timeout — token-based validation",
              priority: "High",
              steps: ["Login with valid credentials", "Wait for session token expiry (30 min)", "Attempt to access a protected resource"],
              expected_result: "User receives 401 response. Redirected to login page with session-expired message.",
            }
          }),
        }],
        original_steps: ["Login with valid credentials", "Wait 30 minutes without activity", "Attempt any action"],
        original_expected_result: "Session expired message shown, redirected to login.",
      },
      {
        test_case_id: "TC-099-02", original_title: "Multi-device login behaviour",
        impacts: [{
          impact_severity: "medium", impact_priority: "medium",
          impacting_story_id: "PROJ-101", impacting_story_description: "Login with email and password",
          impact_details: "New login flow must handle concurrent device sessions differently.",
          impact_created_on: "2025-04-10T10:05:00Z",
          impact_analysis_json: JSON.stringify({
            modification_reason: "Secure login now tracks device fingerprints, which affects multi-device session handling.",
            modified_test_case: {
              title: "Multi-device login — device fingerprint tracking",
              priority: "Medium",
              steps: ["Login on Device A", "Login on Device B with same credentials", "Check active sessions on Device A"],
              expected_result: "Device A session remains active. Both devices shown in active sessions list.",
            }
          }),
        }],
        original_steps: ["Login on device A", "Login on device B", "Check session on device A"],
        original_expected_result: "Both sessions active, or oldest session invalidated based on config.",
      },
      {
        test_case_id: "TC-099-03", original_title: "Password field masking on login",
        impacts: [{
          impact_severity: "low", impact_priority: "low",
          impacting_story_id: "PROJ-101", impacting_story_description: "Login with email and password",
          impact_details: "Show/hide toggle for password field added in new design.",
          impact_created_on: "2025-04-10T10:10:00Z",
          impact_analysis_json: JSON.stringify({
            modification_reason: "New login UI includes a show/hide password toggle which changes the masking test steps.",
            modified_test_case: {
              title: "Password field masking with show/hide toggle",
              priority: "Low",
              steps: ["Navigate to login page", "Type in password field", "Verify characters are masked by default", "Click show/hide toggle", "Verify password is now visible"],
              expected_result: "Password is masked by default. Toggle correctly reveals and re-masks the password.",
            }
          }),
        }],
        original_steps: ["Navigate to login", "Type in password field", "Verify masking"],
        original_expected_result: "Password characters are masked with dots.",
      },
    ],
  },
};

const isMockMode = () => {
  return typeof window !== "undefined" && (window as any).__DEMO_MODE__ === true;
};

// ─── Helper ──────────────────────────────────────────────────────────────────
const fetchWithErrorHandling = async (url: string, options: RequestInit = {}) => {
  const makeRequest = () =>
    fetch(url, {
      ...options,
      credentials: "include",
      headers: { "Content-Type": "application/json", ...options.headers },
    });

  try {
    let response = await makeRequest();

    // 401 → try refreshing the access token once, then retry
    if (response.status === 401) {
      try {
        const { refreshAccessToken } = await import("@/lib/auth");
        const refreshed = await refreshAccessToken();
        if (refreshed) {
          response = await makeRequest();
        }
      } catch {
        // refresh import failed — fall through to redirect
      }
      if (response.status === 401) {
        if (typeof window !== "undefined") {
          window.location.href = "/login";
        }
        throw new Error("Session expired");
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response;
  } catch (error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      throw new Error("BACKEND_UNREACHABLE");
    }
    throw error;
  }
};

// ─── Interfaces ──────────────────────────────────────────────────────────────
export interface Story {
  id: string;
  description: string;
  doc_content_text: string | null;
  created_on: string;
  test_case_count: number;
  embedding_timestamp: string | null;
  test_case_created_time: string | null;
  project_id: string;
  title?: string;
  summary?: string;
  impactedTestCases?: number;
  source?: { story: string; test_cases: string };
}

export interface TestCase {
  test_case_id?: string;
  id?: string;
  title: string;
  description?: string;
  steps?: string[];
  expected_result?: string;
  expected_results?: string[];
  priority?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
  original_version?: TestCase;
  isImpacted?: boolean;
  impacted?: boolean;
}

export interface ImpactedTestCase extends TestCase {
  similarity_score: number;
  original_test_case?: TestCase;
}

export interface TestCaseResponse {
  storyID: string;
  storyDescription: string | null;
  project_id?: string;
  testcases: TestCase[];
}

export interface ImpactAnalysisResponse {
  story_id: string;
  impacted_test_cases: ImpactedTestCase[];
  total_impacted: number;
}

// ─── API ─────────────────────────────────────────────────────────────────────
export const api = {
  getStories: async (page = 1, perPage = 10, from_date?: string, to_date?: string, project_id?: string, sort_order: "desc" | "asc" = "desc") => {
    try {
      let url = `${API_BASE_URL}/api/stories/?page=${page}&per_page=${perPage}&sort_order=${sort_order}`;
      if (from_date) url += `&from_date=${encodeURIComponent(from_date)}`;
      if (to_date) url += `&to_date=${encodeURIComponent(to_date)}`;
      if (project_id) url += `&project_id=${encodeURIComponent(project_id)}`;
      const response = await fetchWithErrorHandling(url);
      const data = await response.json();
      if (!data.stories || !Array.isArray(data.stories) || !data.pagination) throw new Error("Invalid response format");
      return data;
    } catch (error: any) {
      if (error?.message === "BACKEND_UNREACHABLE" || String(error?.message).includes("BACKEND_UNREACHABLE")) {
        if (typeof window !== "undefined") (window as any).__DEMO_MODE__ = true;
        let stories = [...MOCK_STORIES];
        if (project_id) stories = stories.filter(s => s.project_id === project_id);
        if (sort_order === "asc") stories.sort((a, b) => new Date(a.created_on).getTime() - new Date(b.created_on).getTime());
        else stories.sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());
        const start = (page - 1) * perPage;
        const paged = stories.slice(start, start + perPage);
        return { stories: paged, pagination: { page, per_page: perPage, total: stories.length } };
      }
      throw error;
    }
  },

  searchStories: async (query: string, limit = 3) => {
    try {
      const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/stories/search`, { method: "POST", body: JSON.stringify({ query, limit }) });
      return response.json();
    } catch (error: any) {
      if (error?.message === "BACKEND_UNREACHABLE") {
        const q = query.toLowerCase();
        const matches = MOCK_STORIES.filter(s =>
          s.id.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || (s.doc_content_text || "").toLowerCase().includes(q)
        ).slice(0, limit);
        return { stories: matches };
      }
      throw error;
    }
  },

  getTestCases: async (storyId: string) => {
    try {
      const url = `${API_BASE_URL}/api/stories/${storyId}/testcases`;
      const response = await fetchWithErrorHandling(url);
      return response.json();
    } catch (error: any) {
      if (error?.message === "BACKEND_UNREACHABLE") {
        const story = MOCK_STORIES.find(s => s.id === storyId);
        const tcs = MOCK_TEST_CASES[storyId] || MOCK_DEFAULT_TC;
        return { testcases: tcs, storyDescription: story?.description || null };
      }
      throw error;
    }
  },

  getProjects: async () => {
    try {
      const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/stories/projects`);
      return response.json();
    } catch (error: any) {
      if (error?.message === "BACKEND_UNREACHABLE") {
        const projects = [...new Set(MOCK_STORIES.map(s => s.project_id))];
        return { projects };
      }
      throw error;
    }
  },

  getStoryImpacts: async (storyId: string): Promise<ImpactAnalysisResponse> => {
    const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/stories/impacts/story/${storyId}`);
    return response.json();
  },

  getImpactDetails: async (impactId: string) => {
    const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/stories/impacts/details/${impactId}`);
    return response.json();
  },

  getImpactSummary: async (projectId: string) => {
    const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/stories/impacts/summary/${projectId}`);
    return response.json();
  },

  fetchImpactedTestCases: async (storyId: string, projectId: string) => {
    try {
      const response = await fetchWithErrorHandling(`${API_BASE_URL}/api/stories/impacts/story-test-cases/${storyId}?project_id=${projectId}`);
      return response.json();
    } catch (error: any) {
      if (error?.message === "BACKEND_UNREACHABLE") {
        return MOCK_IMPACT_DATA[storyId] || {
          total_test_cases: "10", impacted_test_cases_count: "0", impact_percentage: "0",
          severity_summary: { high: "0", medium: "0", low: "0" },
          impacted_test_cases: [],
        };
      }
      throw error;
    }
  },

  getNextReload: async () => {
    const response = await fetchWithErrorHandling(`${SCHEDULER_API_URL}/api/scheduler/next-reload`);
    return response.text();
  },

  triggerReload: async () => {
    const response = await fetchWithErrorHandling(`${SCHEDULER_API_URL}/api/scheduler/trigger`, { method: "POST" });
    return response.json();
  },
};
