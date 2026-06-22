export type StoryStatus = "Draft" | "Analyzing" | "Ready" | "Impact Detected";
export type ChangeStatus = "Pending" | "Approved" | "Rejected";

export interface ChangeRequest {
  id: string;
  title: string;
  storyId: string;
  status: ChangeStatus;
  storiesAffected: number;
  testsAffected: number;
  impactScore: "High" | "Medium" | "Low";
  createdAt: string;
  affectedStories: AffectedStory[];
}

export interface AffectedStory {
  storyId: string;
  storyTitle: string;
  modifications: number;
  diffLines: DiffLine[];
}
export type TestType = "Functional" | "Negative" | "Boundary" | "Security" | "Accessibility" | "Performance";
export type Severity = "High" | "Medium" | "Low";
export type TestStatus = "Approved" | "Pending" | "Regenerating" | "Rejected";
export type Priority = "P1" | "P2" | "P3";

export interface Story {
  id: string;
  title: string;
  status: StoryStatus;
  coverage: number;
  testCount: number;
  impactCount: number;
  lastUpdated: string;
  type: "Functional" | "OAuth" | "Security";
  version: string;
  content: string;
  acceptanceCriteria: string[];
  qualityScore: number;
  qualityBreakdown: { completeness: number; clarity: number; testability: number };
  qualityIssues: { title: string; description: string; area: string }[];
  riskAreas: { area: string; severity: Severity; description: string }[];
  aiRecommendations: string[];
  /** Computed download URL — present when story comes from real API data. */
  downloadUrl?: string;
  /** Kanban column status — in_review | in_progress | completed */
  kanbanStatus?: 'in_review' | 'in_progress' | 'completed';
}

export interface TestCase {
  id: string;
  storyId: string;
  title: string;
  type: TestType;
  priority: Priority;
  status: TestStatus;
  steps: string[];
  expectedResult: string;
  preconditions?: string[];
  aiReview?: string;
  /** AI-generated feature group e.g. "Login & Authentication" */
  group?: string;
  /** Version number when this test case was introduced (1 = original, 2 = added in v2 upload, etc.) */
  version?: number;
}

export interface CoverageGap {
  id: string;
  storyId: string;
  title: string;
  description: string;
  type: TestType;
  severity: "missing" | "partial";
}

export interface ImpactedTest {
  id: string;
  storyId: string;
  title: string;
  impactType: "Modify Existing" | "Create New Test" | "Deprecate" | "Merge";
  severity: Severity;
  reason: string;
  aiConfidence: number;
  aiReason: string;
  diffLines: DiffLine[];
  accepted?: boolean;
  rejected?: boolean;
}

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  lineNum: number;
  content: string;
}

export const stories: Story[] = [
  {
    id: "LOGIN-001",
    title: "Email and Password Login",
    status: "Ready",
    coverage: 91,
    testCount: 23,
    impactCount: 5,
    lastUpdated: "2h ago",
    type: "Functional",
    version: "v2",
    content: `As a registered user, I want to log in with my email and password so that I can access my account.

Acceptance Criteria:
- User can enter their email and password on the login page
- Valid credentials redirect the user to their dashboard
- Invalid credentials display an error message: "Invalid email or password"
- After 3 failed attempts, the account is locked for 15 minutes
- A "Forgot Password" link is visible on the login page`,
    acceptanceCriteria: [
      "User can enter their email and password on the login page",
      "Valid credentials redirect the user to their dashboard",
      "Invalid credentials display an error message: \"Invalid email or password\"",
      "After 3 failed attempts, the account is locked for 15 minutes",
      "A \"Forgot Password\" link is visible on the login page",
    ],
    qualityScore: 87,
    qualityBreakdown: { completeness: 80, clarity: 95, testability: 63 },
    qualityIssues: [
      { title: "Missing acceptance criteria for error states", description: "No criteria for what happens when the server is unavailable.", area: "Completeness" },
      { title: "User role is ambiguous", description: "Which type of user? Admin, guest, or standard account?", area: "Clarity" },
      { title: "No definition of post-lockout behavior", description: "What happens after 15 minutes? Does it auto-unlock or require manual reset?", area: "Testability" },
    ],
    riskAreas: [
      { area: "Authentication bypass", severity: "High", description: "No brute force protection beyond lockout specified" },
      { area: "Session management", severity: "Medium", description: "Token expiry not defined" },
      { area: "Error messaging", severity: "Low", description: "Error copy not specified — could leak account existence" },
    ],
    aiRecommendations: [
      "Add acceptance criteria for: account lockout after 3 failed attempts including unlock mechanism",
      "Specify what happens to existing session when user logs in on a new device",
      "Define error message copy — use generic \"Invalid email or password\" to avoid account enumeration",
    ],
  },
  {
    id: "AUTH-010",
    title: "OAuth Login with Google and GitHub",
    status: "Impact Detected",
    coverage: 48,
    testCount: 12,
    impactCount: 18,
    lastUpdated: "1d ago",
    type: "OAuth",
    version: "v1",
    content: `As a user, I want to log in using my Google or GitHub account so that I don't need to manage a separate password.

Acceptance Criteria:
- A "Continue with Google" button is shown on the login page
- A "Continue with GitHub" button is shown on the login page
- Clicking either button redirects to the OAuth provider
- On success, user is redirected to dashboard with session established`,
    acceptanceCriteria: [
      "A \"Continue with Google\" button is shown on the login page",
      "A \"Continue with GitHub\" button is shown on the login page",
      "Clicking either button redirects to the OAuth provider",
      "On success, user is redirected to dashboard with session established",
    ],
    qualityScore: 64,
    qualityBreakdown: { completeness: 55, clarity: 80, testability: 50 },
    qualityIssues: [
      { title: "Missing error handling for OAuth failure", description: "What happens when Google/GitHub denies the auth request?", area: "Completeness" },
      { title: "No account linking behavior defined", description: "What if the OAuth email matches an existing password account?", area: "Completeness" },
    ],
    riskAreas: [
      { area: "Token handling", severity: "High", description: "OAuth tokens are not covered — expiry and refresh undefined" },
      { area: "Account takeover", severity: "High", description: "No spec for handling email collision between OAuth and password accounts" },
    ],
    aiRecommendations: [
      "Define behavior when OAuth provider denies authorization",
      "Specify account linking rules when OAuth email matches existing account",
      "Add acceptance criteria for OAuth token refresh and session expiry",
    ],
  },
  {
    id: "AUTH-002",
    title: "User Registration",
    status: "Ready",
    coverage: 78,
    testCount: 18,
    impactCount: 0,
    lastUpdated: "3d ago",
    type: "Functional",
    version: "v1",
    content: `As a new user, I want to create an account so that I can access the platform.`,
    acceptanceCriteria: [
      "User can enter name, email, and password",
      "Email must be unique in the system",
      "Password must be at least 8 characters",
      "Confirmation email is sent after registration",
    ],
    qualityScore: 72,
    qualityBreakdown: { completeness: 70, clarity: 85, testability: 60 },
    qualityIssues: [
      { title: "No password strength requirements beyond length", description: "Minimum 8 chars is defined but complexity rules are not.", area: "Completeness" },
    ],
    riskAreas: [
      { area: "Email enumeration", severity: "Medium", description: "Error for duplicate email could confirm account existence" },
    ],
    aiRecommendations: [
      "Define password complexity requirements (uppercase, number, symbol)",
      "Specify registration rate limiting to prevent spam accounts",
    ],
  },
  {
    id: "AUTH-003",
    title: "Password Reset Flow",
    status: "Ready",
    coverage: 85,
    testCount: 14,
    impactCount: 2,
    lastUpdated: "5d ago",
    type: "Functional",
    version: "v3",
    content: `As a user who forgot their password, I want to reset it via email so that I can regain account access.`,
    acceptanceCriteria: [
      "User can request a password reset from the login page",
      "Reset email is sent within 2 minutes",
      "Reset link expires after 1 hour",
      "New password must differ from the last 3 passwords",
    ],
    qualityScore: 82,
    qualityBreakdown: { completeness: 85, clarity: 90, testability: 70 },
    qualityIssues: [],
    riskAreas: [
      { area: "Link reuse", severity: "Low", description: "Whether reset links are single-use is not specified" },
    ],
    aiRecommendations: [
      "Confirm reset links are invalidated after first use",
      "Specify behavior if user requests multiple resets in quick succession",
    ],
  },
  {
    id: "PROFILE-003",
    title: "User Settings & Profile",
    status: "Analyzing",
    coverage: 55,
    testCount: 8,
    impactCount: 0,
    lastUpdated: "6h ago",
    type: "Functional",
    version: "v1",
    content: `As a logged-in user, I want to update my profile and account settings so that my information stays current.`,
    acceptanceCriteria: [
      "User can update display name and avatar",
      "User can change email (requires re-verification)",
      "User can change password",
      "Changes are saved with a success confirmation",
    ],
    qualityScore: 60,
    qualityBreakdown: { completeness: 55, clarity: 70, testability: 55 },
    qualityIssues: [
      { title: "Avatar upload format and size limits not defined", description: "No spec for accepted formats or file size maximums.", area: "Completeness" },
      { title: "Re-verification flow for email change is vague", description: "Which email gets the verification link — old or new address?", area: "Clarity" },
    ],
    riskAreas: [
      { area: "Account takeover via email change", severity: "High", description: "Email change flow without old-email confirmation is risky" },
    ],
    aiRecommendations: [
      "Send verification to both old and new email on address change",
      "Define avatar accepted formats: JPG, PNG, GIF, max 5MB",
    ],
  },
  {
    id: "PAYMENT-001",
    title: "Checkout and Payment",
    status: "Draft",
    coverage: 62,
    testCount: 16,
    impactCount: 0,
    lastUpdated: "1w ago",
    type: "Security",
    version: "v1",
    content: `As a customer, I want to complete a purchase with my credit card so that I can access premium features.`,
    acceptanceCriteria: [
      "User can enter credit card details",
      "Payment is processed securely via Stripe",
      "Successful payment shows a confirmation screen",
      "Failed payment shows a descriptive error",
    ],
    qualityScore: 58,
    qualityBreakdown: { completeness: 50, clarity: 75, testability: 48 },
    qualityIssues: [
      { title: "No refund or cancellation policy defined", description: "Story doesn't cover what happens post-purchase.", area: "Completeness" },
      { title: "PCI compliance requirements not mentioned", description: "Card data handling approach is undefined.", area: "Completeness" },
    ],
    riskAreas: [
      { area: "PCI DSS compliance", severity: "High", description: "Card handling must go through Stripe Elements — direct card data collection is prohibited" },
      { area: "Double-charge prevention", severity: "Medium", description: "Retry behavior on failed payments not specified" },
    ],
    aiRecommendations: [
      "Specify Stripe Elements usage — never handle raw card data",
      "Define idempotency keys for payment requests to prevent double-charges",
      "Add acceptance criteria for refund and subscription cancellation flows",
    ],
  },
];

export type KanbanCol = "In Review" | "In Progress" | "Completed";

export const testCases: TestCase[] = [
  // LOGIN-001 — mix of all statuses
  { id: "TC-001", storyId: "LOGIN-001", title: "Successful login with valid credentials", type: "Functional", priority: "P1", status: "Approved", steps: ["Navigate to /login", "Enter valid email: user@example.com", "Enter valid password: CorrectPass1!", "Click 'Log In'"], expectedResult: "User is redirected to /dashboard. Session cookie is set.", preconditions: ["User account exists and is active"], aiReview: "This test covers the primary happy path. Consider adding a check that the session token is present in cookies." },
  { id: "TC-002", storyId: "LOGIN-001", title: "Login fails with wrong password", type: "Negative", priority: "P1", status: "Approved", steps: ["Navigate to /login", "Enter valid email", "Enter incorrect password", "Click 'Log In'"], expectedResult: "Error message: 'Invalid email or password' is displayed. User stays on /login.", aiReview: "Good coverage. Verify the error does not distinguish between wrong email vs wrong password (enumeration risk)." },
  { id: "TC-003", storyId: "LOGIN-001", title: "Login fails with unregistered email", type: "Negative", priority: "P2", status: "Approved", steps: ["Navigate to /login", "Enter email not in system", "Enter any password", "Click 'Log In'"], expectedResult: "Same error message as wrong password: 'Invalid email or password'.", aiReview: "Critical: confirm error copy is identical to TC-002 to prevent account enumeration." },
  { id: "TC-004", storyId: "LOGIN-001", title: "Account locks after 3 failed attempts", type: "Boundary", priority: "P1", status: "Approved", steps: ["Submit wrong credentials 2 times", "Verify account not yet locked", "Submit wrong credentials a 3rd time", "Attempt to log in again with correct credentials"], expectedResult: "4th attempt is blocked. Message: 'Account locked for 15 minutes'.", aiReview: "Add a test for the exact 3rd attempt boundary — failure on attempt 2 should not lock." },
  { id: "TC-005", storyId: "LOGIN-001", title: "Empty email field validation", type: "Negative", priority: "P2", status: "Approved", steps: ["Navigate to /login", "Leave email blank", "Enter any password", "Click 'Log In'"], expectedResult: "Inline validation error shown. Form does not submit." },
  { id: "TC-006", storyId: "LOGIN-001", title: "Empty password field validation", type: "Negative", priority: "P2", status: "Regenerating", steps: ["Navigate to /login", "Enter valid email", "Leave password blank", "Click 'Log In'"], expectedResult: "Inline validation error shown. Form does not submit." },
  { id: "TC-007", storyId: "LOGIN-001", title: "Password field is masked by default", type: "Security", priority: "P2", status: "Regenerating", steps: ["Navigate to /login", "Enter any text in password field", "Observe field rendering"], expectedResult: "Password input renders as dots/asterisks. No plaintext visible." },
  { id: "TC-008", storyId: "LOGIN-001", title: "Login form is not vulnerable to SQL injection", type: "Security", priority: "P1", status: "Approved", steps: ["Enter ' OR 1=1; -- in the email field", "Enter any password", "Submit the form"], expectedResult: "Login fails with standard error. No database error exposed." },
  { id: "TC-009", storyId: "LOGIN-001", title: "Forgot password link is visible", type: "Functional", priority: "P3", status: "Pending", steps: ["Navigate to /login"], expectedResult: "'Forgot Password' link is visible on the login page." },
  { id: "TC-010", storyId: "LOGIN-001", title: "Keyboard-only login flow", type: "Accessibility", priority: "P2", status: "Pending", steps: ["Navigate to /login using keyboard only", "Tab to email, enter value", "Tab to password, enter value", "Tab to Login button, press Enter"], expectedResult: "User can complete the login flow without using a mouse." },
  // AUTH-002 — Registration
  { id: "TC-011", storyId: "AUTH-002", title: "Successful user registration", type: "Functional", priority: "P1", status: "Approved", steps: ["Navigate to /register", "Enter name, valid email, and password", "Click 'Create Account'"], expectedResult: "Account created. Confirmation email sent. User redirected to onboarding." },
  { id: "TC-012", storyId: "AUTH-002", title: "Registration with duplicate email", type: "Negative", priority: "P1", status: "Approved", steps: ["Attempt to register with an email already in the system"], expectedResult: "Error: 'An account with this email already exists'." },
  { id: "TC-013", storyId: "AUTH-002", title: "Password too short rejected", type: "Boundary", priority: "P2", status: "Pending", steps: ["Enter a 7-character password during registration", "Submit the form"], expectedResult: "Inline error: 'Password must be at least 8 characters'." },
  { id: "TC-014", storyId: "AUTH-002", title: "Registration confirmation email delivered", type: "Functional", priority: "P2", status: "Pending", steps: ["Complete registration", "Check inbox of provided email"], expectedResult: "Email received within 2 minutes with a verification link." },
  // AUTH-003 — Password Reset
  { id: "TC-015", storyId: "AUTH-003", title: "Password reset email is sent", type: "Functional", priority: "P1", status: "Approved", steps: ["Click 'Forgot Password' on login page", "Enter registered email", "Submit"], expectedResult: "Reset email sent within 2 minutes." },
  { id: "TC-016", storyId: "AUTH-003", title: "Reset link expires after 1 hour", type: "Boundary", priority: "P1", status: "Regenerating", steps: ["Request a password reset", "Wait 61 minutes", "Click the reset link"], expectedResult: "Link is expired. User shown: 'This link has expired. Request a new one.'" },
  { id: "TC-017", storyId: "AUTH-003", title: "Cannot reuse last 3 passwords", type: "Security", priority: "P2", status: "Pending", steps: ["Reset password to a password used in the last 3 resets"], expectedResult: "Error: 'You cannot reuse a recent password'." },
  // AUTH-010 — OAuth
  { id: "TC-018", storyId: "AUTH-010", title: "OAuth redirect to Google", type: "Functional", priority: "P1", status: "Pending", steps: ["Click 'Continue with Google' on login page"], expectedResult: "Browser redirects to accounts.google.com OAuth consent screen." },
  { id: "TC-019", storyId: "AUTH-010", title: "OAuth success creates session", type: "Functional", priority: "P1", status: "Pending", steps: ["Complete Google OAuth flow", "Grant permissions"], expectedResult: "User redirected to /dashboard with valid session." },
  { id: "TC-020", storyId: "AUTH-010", title: "OAuth cancellation handled gracefully", type: "Negative", priority: "P2", status: "Regenerating", steps: ["Click 'Continue with Google'", "Cancel the OAuth flow", "Return to app"], expectedResult: "User returned to login page with no error exposed." },
  // PAYMENT-001
  { id: "TC-021", storyId: "PAYMENT-001", title: "Successful payment with valid card", type: "Functional", priority: "P1", status: "Approved", steps: ["Add item to cart", "Enter valid Stripe test card 4242 4242 4242 4242", "Submit payment"], expectedResult: "Payment confirmed. Confirmation screen shown. Order recorded." },
  { id: "TC-022", storyId: "PAYMENT-001", title: "Declined card shows error", type: "Negative", priority: "P1", status: "Approved", steps: ["Enter declined card number 4000 0000 0000 0002", "Submit payment"], expectedResult: "Error: 'Your card was declined. Please try a different payment method.'" },
  { id: "TC-023", storyId: "PAYMENT-001", title: "Raw card data never sent to server", type: "Security", priority: "P1", status: "Pending", steps: ["Open network tab", "Submit payment form", "Inspect POST requests"], expectedResult: "No request contains raw card number. All card data handled by Stripe.js." },
];

export const coverageGaps: CoverageGap[] = [
  { id: "CG-001", storyId: "LOGIN-001", title: "Session timeout behavior", description: "No test covers what happens when the session expires mid-use.", type: "Security", severity: "missing" },
  { id: "CG-002", storyId: "LOGIN-001", title: "Rate limiting on login endpoint", description: "Brute force beyond the 3-attempt lockout (e.g., distributed attacks) is not tested.", type: "Security", severity: "missing" },
  { id: "CG-003", storyId: "LOGIN-001", title: "Login with max-length email", description: "Email at the 254-character RFC limit has no boundary test.", type: "Boundary", severity: "missing" },
  { id: "CG-004", storyId: "LOGIN-001", title: "Login while already logged in", description: "Behavior when a second login is attempted without logging out first is uncovered.", type: "Functional", severity: "partial" },
  { id: "CG-005", storyId: "LOGIN-001", title: "ARIA roles on form inputs", description: "Form labels and error associations for screen readers are not tested.", type: "Accessibility", severity: "missing" },
  { id: "CG-006", storyId: "LOGIN-001", title: "Concurrent login from two devices", description: "No test for two sessions being active simultaneously.", type: "Functional", severity: "missing" },
];

export const changeRequests: ChangeRequest[] = [
  {
    id: "CR-001",
    title: "OAuth Login Update",
    storyId: "AUTH-010",
    status: "Pending",
    storiesAffected: 3,
    testsAffected: 18,
    impactScore: "High",
    createdAt: "2h ago",
    affectedStories: [
      {
        storyId: "LOGIN-001",
        storyTitle: "Email and Password Login",
        modifications: 8,
        diffLines: [
          { type: "unchanged", lineNum: 1, content: "Given I am on the login page" },
          { type: "removed",   lineNum: 2, content: "And I click 'Log In'" },
          { type: "added",     lineNum: 2, content: "And I click 'Log In' (email/password flow only)" },
          { type: "added",     lineNum: 3, content: "# See TC-OAuth-001 for OAuth path" },
          { type: "unchanged", lineNum: 4, content: "Then I am redirected to the dashboard" },
        ],
      },
      {
        storyId: "AUTH-002",
        storyTitle: "User Registration",
        modifications: 6,
        diffLines: [
          { type: "unchanged", lineNum: 1, content: "Given I am on the registration page" },
          { type: "added",     lineNum: 2, content: "And I see 'Continue with Google' option" },
          { type: "added",     lineNum: 3, content: "And I see 'Continue with GitHub' option" },
          { type: "unchanged", lineNum: 4, content: "When I complete registration" },
        ],
      },
      {
        storyId: "AUTH-003",
        storyTitle: "Password Reset Flow",
        modifications: 4,
        diffLines: [
          { type: "unchanged", lineNum: 1, content: "Given the user has an OAuth-linked account" },
          { type: "added",     lineNum: 2, content: "Then password reset should offer OAuth re-auth option" },
          { type: "removed",   lineNum: 3, content: "Then standard email reset flow is used" },
        ],
      },
    ],
  },
  {
    id: "CR-002",
    title: "MFA Login Requirement",
    storyId: "LOGIN-001",
    status: "Pending",
    storiesAffected: 2,
    testsAffected: 9,
    impactScore: "Medium",
    createdAt: "1d ago",
    affectedStories: [
      {
        storyId: "LOGIN-001",
        storyTitle: "Email and Password Login",
        modifications: 5,
        diffLines: [
          { type: "unchanged", lineNum: 1, content: "When I enter valid credentials" },
          { type: "added",     lineNum: 2, content: "And I am prompted for MFA code" },
          { type: "added",     lineNum: 3, content: "And I enter the correct 6-digit TOTP code" },
          { type: "unchanged", lineNum: 4, content: "Then I am redirected to /dashboard" },
        ],
      },
      {
        storyId: "AUTH-003",
        storyTitle: "Password Reset Flow",
        modifications: 4,
        diffLines: [
          { type: "unchanged", lineNum: 1, content: "When the reset link is clicked" },
          { type: "added",     lineNum: 2, content: "And MFA verification is required before password change" },
        ],
      },
    ],
  },
  {
    id: "CR-003",
    title: "Payment Method Expansion",
    storyId: "PAYMENT-001",
    status: "Approved",
    storiesAffected: 1,
    testsAffected: 6,
    impactScore: "Low",
    createdAt: "3d ago",
    affectedStories: [
      {
        storyId: "PAYMENT-001",
        storyTitle: "Checkout and Payment",
        modifications: 6,
        diffLines: [
          { type: "unchanged", lineNum: 1, content: "Given I am on the checkout page" },
          { type: "added",     lineNum: 2, content: "And I can select PayPal as payment method" },
          { type: "added",     lineNum: 3, content: "And I can select Apple Pay as payment method" },
          { type: "unchanged", lineNum: 4, content: "When I submit payment" },
        ],
      },
    ],
  },
  {
    id: "CR-004",
    title: "Profile Avatar Upload Limits",
    storyId: "PROFILE-003",
    status: "Rejected",
    storiesAffected: 1,
    testsAffected: 3,
    impactScore: "Low",
    createdAt: "5d ago",
    affectedStories: [
      {
        storyId: "PROFILE-003",
        storyTitle: "User Settings & Profile",
        modifications: 3,
        diffLines: [
          { type: "removed",   lineNum: 1, content: "User can upload any image as avatar" },
          { type: "added",     lineNum: 1, content: "User can upload JPG, PNG, GIF up to 5MB" },
          { type: "added",     lineNum: 2, content: "Images exceeding 5MB are rejected with an error" },
        ],
      },
    ],
  },
];

export const impactedTests: ImpactedTest[] = [
  {
    id: "IT-001", storyId: "LOGIN-001", title: "Successful login with valid credentials",
    impactType: "Modify Existing", severity: "High",
    reason: "OAuth adds a second authentication path — the single step flow must now branch.",
    aiConfidence: 96, aiReason: "OAuth introduces an additional authentication flow. Original email/password login still exists but the test must verify the correct path is invoked.",
    diffLines: [
      { type: "unchanged", lineNum: 1, content: "Given I am on the login page" },
      { type: "unchanged", lineNum: 2, content: "When I enter valid email and password" },
      { type: "removed", lineNum: 3, content: "And I click the 'Log In' button" },
      { type: "added", lineNum: 3, content: "And I click the 'Log In' button (email/password flow)" },
      { type: "added", lineNum: 4, content: "# OAuth path tested separately in TC-OAuth-001" },
      { type: "unchanged", lineNum: 5, content: "Then I am redirected to the dashboard" },
    ],
  },
  {
    id: "IT-002", storyId: "LOGIN-001", title: "Login form renders all required fields",
    impactType: "Modify Existing", severity: "Medium",
    reason: "Login page now has two new buttons. Test must verify they render.",
    aiConfidence: 91, aiReason: "The login page now has three entry points. UI assertion tests need to include the new OAuth buttons.",
    diffLines: [
      { type: "unchanged", lineNum: 1, content: "Then I see the email input field" },
      { type: "unchanged", lineNum: 2, content: "And I see the password input field" },
      { type: "unchanged", lineNum: 3, content: "And I see the 'Log In' button" },
      { type: "added", lineNum: 4, content: "And I see the 'Continue with Google' button" },
      { type: "added", lineNum: 5, content: "And I see the 'Continue with GitHub' button" },
    ],
  },
  {
    id: "IT-003", storyId: "LOGIN-001", title: "Account locks after 3 failed attempts",
    impactType: "Create New Test", severity: "High",
    reason: "OAuth login failures need their own lockout test separate from password-based lockout.",
    aiConfidence: 88, aiReason: "Lockout behavior may differ between OAuth and password flows. A new test specifically for OAuth failure handling is needed.",
    diffLines: [
      { type: "added", lineNum: 1, content: "+ Scenario: OAuth failure does not affect password lockout counter" },
      { type: "added", lineNum: 2, content: "+   Given I fail OAuth login 3 times" },
      { type: "added", lineNum: 3, content: "+   When I attempt email/password login with correct credentials" },
      { type: "added", lineNum: 4, content: "+   Then login succeeds (counters are independent)" },
    ],
  },
];
