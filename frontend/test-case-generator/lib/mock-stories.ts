// Shared mock story/impact data referenced by detail pages when backend is unreachable.
// Import this only in catch blocks after detecting __DEMO_MODE__.

export const MOCK_STORY_MAP: Record<string, {
  description: string;
  doc_content_text: string;
  project_id: string;
}> = {
  "PROJ-101": {
    description: "As a user I want to log in with email and password so that I can access my account securely.",
    doc_content_text: "The login page should accept an email and password. Validate both fields. On success redirect to dashboard. On failure show an error message. Lock account after 5 failed attempts.",
    project_id: "Alpha",
  },
  "PROJ-102": {
    description: "As a user I want to reset my password via email so that I can regain access to my account.",
    doc_content_text: "User clicks Forgot Password, enters email, receives a reset link. Link expires in 24 hours. New password must be at least 8 characters and contain a number.",
    project_id: "Alpha",
  },
  "PROJ-103": {
    description: "As an admin I want to manage user roles so that I can control access to features.",
    doc_content_text: "Admin can assign roles: Viewer, Editor, Admin. Role changes take effect immediately. Admin cannot remove their own Admin role. Audit log is created for every role change.",
    project_id: "Beta",
  },
  "PROJ-104": {
    description: "As a user I want to upload documents so that I can share files with my team.",
    doc_content_text: "Support PDF, DOCX and TXT. Max file size 20MB. Show upload progress. Virus scan on upload. Notify team members on successful upload.",
    project_id: "Beta",
  },
  "PROJ-105": {
    description: "As a user I want to search for stories by keyword so that I can quickly find relevant items.",
    doc_content_text: "Full-text search across story ID, description, and content. Results sorted by relevance. Search is debounced 300ms. No results state shows helpful message.",
    project_id: "Gamma",
  },
  "PROJ-106": {
    description: "As a user I want to view my notification history so that I can review past alerts.",
    doc_content_text: "List all notifications ordered by date. Mark as read individually or all at once. Filter by type: info, warning, error. Notifications older than 30 days are archived.",
    project_id: "Gamma",
  },
  "PROJ-107": {
    description: "As a user I want to export data to CSV so that I can analyse results in Excel.",
    doc_content_text: "Export button available on all table views. CSV includes all visible columns. Large exports (>1000 rows) are emailed as a download link. Progress indicator shown.",
    project_id: "Alpha",
  },
  "PROJ-108": {
    description: "As a user I want to filter results by date range so that I can focus on recent activity.",
    doc_content_text: "Date picker with from/to fields. Validate that from <= to. Persist filter in URL params. Clear button resets to all dates.",
    project_id: "Beta",
  },
};

export const MOCK_IMPACT_MAP: Record<string, any> = {
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
            modified_test_case: { title: "Login session timeout — token-based validation", priority: "High", steps: ["Login with valid credentials", "Wait for session token expiry (30 min)", "Attempt to access a protected resource"], expected_result: "User receives 401. Redirected to login with session-expired message." },
          }),
        }],
      },
      {
        test_case_id: "TC-099-02", original_title: "Multi-device login behaviour",
        impacts: [{
          impact_severity: "medium", impact_priority: "medium",
          impacting_story_id: "PROJ-101", impacting_story_description: "Login with email and password",
          impact_details: "New login flow must handle concurrent device sessions differently.",
          impact_created_on: "2025-04-10T10:05:00Z",
          impact_analysis_json: JSON.stringify({
            modification_reason: "Secure login now tracks device fingerprints, affecting multi-device session handling.",
            modified_test_case: { title: "Multi-device login — device fingerprint tracking", priority: "Medium", steps: ["Login on Device A", "Login on Device B with same credentials", "Check active sessions on Device A"], expected_result: "Both devices shown in active sessions list." },
          }),
        }],
      },
      {
        test_case_id: "TC-099-03", original_title: "Password field masking on login",
        impacts: [{
          impact_severity: "low", impact_priority: "low",
          impacting_story_id: "PROJ-101", impacting_story_description: "Login with email and password",
          impact_details: "Show/hide toggle for password field added in new design.",
          impact_created_on: "2025-04-10T10:10:00Z",
          impact_analysis_json: JSON.stringify({
            modification_reason: "New login UI includes a show/hide password toggle which changes masking test steps.",
            modified_test_case: { title: "Password field masking with show/hide toggle", priority: "Low", steps: ["Navigate to login page", "Type in password field", "Verify characters are masked", "Click show/hide toggle", "Verify password is visible"], expected_result: "Toggle correctly reveals and re-masks the password." },
          }),
        }],
      },
    ],
  },
};
