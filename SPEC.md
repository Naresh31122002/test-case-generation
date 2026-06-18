  # TestSurge — Product Design Document

**AI Requirement Intelligence Platform**
v1.0 — Full specification for engineering and design. This is the single source of truth for this build. Follow it exactly; where it's ambiguous, make the smallest reasonable decision and note it.

---

## 1. Product Vision & Positioning

**What TestSurge is:** an AI Requirement Intelligence Platform. It is NOT a test management tool, bug tracker, or Jira competitor.

It answers the question: *"I uploaded OAuth Login. Which existing stories and tests become risky?"*

**Why this matters:** Test generation and Playwright/Cypress export are becoming commodity — anyone can build an "AI test case generator." Cross-story impact analysis, story relationship mapping, and AI-powered change proposals with human approval are rare. That's the moat.

**Positioning line (pick one for marketing/onboarding copy):**
- "Generate Tests. Detect Impact. Prevent Escaped Defects."
- "Requirement Intelligence for QA Teams."
- "Understand Requirements Before Bugs Happen."

**Primary object:** Everything revolves around the **Story** — not projects, not test cases. Users manage stories, update stories, compare stories, export stories. Uploading is just one way to create or update a story, never a destination of its own.

---

## 2. Design System

### 2.1 Colors

Pink is the brand accent — used sparingly inside the app (CTAs, active states, badges only). The working palette for the application itself is navy + cyan, since QA engineers spend 8 hours a day here.

| Token | Hex | Usage |
|---|---|---|
| `--color-bg-primary` | `#FAFBFC` | Page background |
| `--color-surface` | `#FFFFFF` | Cards, panels, modals |
| `--color-navy` | `#0F172A` | Primary text, headings |
| `--color-muted` | `#64748B` | Secondary text, labels, metadata |
| `--color-border` | `#E2E8F0` | All borders, dividers |
| `--color-pink` | `#FF0A78` | Brand accent: CTAs, active states, badges |
| `--color-cyan` | `#06B6D4` | Secondary accent: links, icons, coverage |
| `--color-success` | `#10B981` | Pass, approved, complete |
| `--color-warning` | `#F59E0B` | Medium severity, caution |
| `--color-error` | `#EF4444` | Fail, rejected, high severity |
| `--color-surface-pink` | `#FFF0F7` | Pink tinted surface (hover, selection) |
| `--color-surface-cyan` | `#ECFEFF` | Cyan tinted surface (info panels) |

### 2.2 Typography

Font family: **Inter** (Google Fonts). Fallback: `-apple-system, BlinkMacSystemFont, sans-serif`.

| Role | Size / weight | Usage |
|---|---|---|
| Display | 32px / 700 | Page titles (Stories, Coverage, etc.) |
| Heading 1 | 24px / 600 | Section headers within a page |
| Heading 2 | 18px / 600 | Card titles, tab names |
| Heading 3 | 15px / 600 | Sub-section labels |
| Body | 14px / 400 | All regular copy |
| Body strong | 14px / 600 | Emphasis within body text |
| Small | 12px / 400 | Metadata, timestamps, helper text |
| Small strong | 12px / 600 | Labels, badges, status chips |
| Mono | 13px / 400 | Code, test steps, diff viewer |
| Mono strong | 13px / 600 | Highlighted code, diff additions |

### 2.3 Spacing & grid

- Base unit: 4px. Scale: 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96px
- Left sidebar: 240px fixed width
- Main content area: fluid, max-width 1200px, 32px horizontal padding
- Content panels within workspace: 16px padding
- Cards: 20px padding, 8px border-radius
- **Modals are never used.** Use full pages or slide-in side panels instead.

### 2.4 Components

**Buttons**

| Variant | Appearance | When to use |
|---|---|---|
| Primary | bg `--color-pink`, text white, radius 6px, height 36px | Main action on page (Generate, Accept, Create) |
| Secondary | bg white, border `--color-border`, text navy | Supporting actions (Export, Compare, Cancel) |
| Destructive | bg `--color-error` at 10% opacity, text + border `--color-error` | Delete, Reject actions |
| Ghost | bg transparent, text navy, no border | Sidebar nav, tertiary actions |
| Icon button | 36×36px, ghost, centered icon at 18px | Toolbar actions, filter toggles |

**Badges / status chips**

| Status | Style | Used for |
|---|---|---|
| High | bg `#FEF2F2`, text `#991B1B`, border `#FCA5A5` | High severity impact, critical coverage gap |
| Medium | bg `#FFFBEB`, text `#92400E`, border `#FCD34D` | Medium severity, partial coverage |
| Low | bg `#ECFDF5`, text `#065F46`, border `#6EE7B7` | Low severity, minor gaps |
| Pending | bg `#EFF6FF`, text `#1E40AF`, border `#93C5FD` | Awaiting review, pending generation |
| Approved | bg `#ECFDF5`, text `#065F46`, border `#6EE7B7` | Accepted change, approved test |
| Rejected | bg `#FEF2F2`, text `#991B1B`, border `#FCA5A5` | Rejected change |
| Draft | bg `#F8FAFC`, text `#64748B`, border `#CBD5E1` | Unsaved, in-progress story |

**Coverage ring / donut**
- SVG donut chart, 120px diameter, stroke width 12px
- Covered arc: `--color-cyan`. Gap: `--color-border`
- Center label: percentage at 24px/700, "Coverage" at 11px/400 muted below
- Used in: Story Workspace header, Story cards, Coverage Center

**Diff viewer**
- GitHub-style, full width, monospace 13px
- Removed lines: bg `#FEF2F2`, text `#991B1B`, gutter `−` in red
- Added lines: bg `#ECFDF5`, text `#065F46`, gutter `+` in green
- Unchanged lines: bg white, text muted, gutter blank
- Line numbers: 40px gutter, right-aligned, muted
- 16px horizontal padding per line
- Used in: Impact tab diff viewer, Change Review page — build as one reusable component shared by both

---

## 3. Navigation & Information Architecture

### Left sidebar (240px fixed)

Users think in objects, not actions — the sidebar shows destinations, not commands.

| Nav item | Icon (lucide-react) | Route |
|---|---|---|
| Stories | `BookOpen` | `/stories` |
| Changes | `GitPullRequest` | `/changes` |
| Coverage | `PieChart` | `/coverage` |
| Compare | `GitCompare` | `/compare` |
| Exports | `Download` | `/exports` |
| Settings | `Settings` | `/settings` |

- Top: TestSurge logo (24px pink wordmark) + workspace name (12px muted) below
- Nav items: 40px tall, 16px horizontal padding, 8px radius on hover/active
- Active: bg `--color-surface-pink`, left border 3px pink, text navy bold, icon pink
- Hover: bg `--color-surface` (gray-50), icon + text navy
- Inactive: icon + text muted
- Bottom: workspace avatar + user name + settings icon
- No collapse behavior in MVP — sidebar is always open

### Full route tree

```
/stories                          Stories — homepage
/stories/new                      Create Story — full page, 3-step wizard
/stories/:id                      Story Workspace
  /stories/:id/overview
  /stories/:id/tests
  /stories/:id/coverage
  /stories/:id/impact
  /stories/:id/export
/changes                          Change Request list
  /changes/:id                    Change Review page
/coverage                         Coverage Center (workspace-wide)
/compare                          Compare two stories
/exports                          Export Center (workspace-wide)
/settings
  /settings/workspace
  /settings/integrations
  /settings/api-keys
  /settings/team
  /settings/billing
  /settings/notifications
```

---

## 4. Global Layout

**Shell**
- Full viewport height (100vh), no scroll on the shell itself
- Left: sidebar, 240px, fixed, white bg, right border `--color-border`
- Right: main content area, fluid, bg `--color-bg-primary`, `overflow-y: auto`

**Top bar** (inside main content, per page)
- Height 64px, white bg, bottom border 1px
- Left: page title, 24px/700 navy
- Right: context actions (e.g. "New Story" button on Stories page)
- Sticky: `position: sticky; top: 0; z-index: 10`

**Page content**
- Padding: 32px top, 32px horizontal
- Max-width 1200px, centered if viewport is wider

---

## 5. Screen 1 — Stories (homepage)

**Route:** `/stories`
**Purpose:** entry point. Shows all stories in the workspace; create, open, compare, export from here.

**Top bar:** title "Stories" left, "+ New Story" primary button right.

**Toolbar row** (below top bar, above content)

| Element | Type | Behavior |
|---|---|---|
| Search | Input, 280px, placeholder "Search stories…" | Filters cards live by title/ID |
| Filter dropdown | "All Types" select | Options: All Types, Functional, OAuth, Security |
| Sort dropdown | "Last Updated" select | Options: Last Updated, Name A–Z, Coverage ↑↓, Impact ↑↓ |
| View toggle | Board/List icon buttons, right side | Switches grid vs. list view |

### Board view (default)

**Story card** — width ~300px, padding 20px, white bg, border, radius 10px. Hover: shadow `0 4px 16px rgba(0,0,0,0.06)`, border becomes cyan.

Card layout top to bottom:
1. Story ID badge (e.g. "LOGIN-001") in 11px/600 cyan, left + status chip, right
2. Story title, 15px/600 navy, truncate at 2 lines
3. Coverage ring (48px) + "23 Tests" + "Impact: 5" inline
4. "Last updated 2h ago" in 11px muted

Hover overlay: 3 ghost buttons fade in at card bottom — "Open" / "Compare" / "Export" — over a bottom gradient (transparent → white, 60px).

**Status chips:** Draft (uploaded, not analyzed) · Analyzing… (animated pulse dot) · Ready (tests + coverage done) · Impact Detected (pink — related stories affected)

**Empty state:** centered. `BookOpen` icon 48px muted. Heading "No stories yet" 18px/600. Subtext "Upload a user story, paste requirements, or import from Jira to get started." CTA "Create Your First Story" primary button.

### List view

| Column | Width | Content |
|---|---|---|
| Story ID | 100px | Cyan badge |
| Title | flex | Full title, truncated |
| Tests | 80px center | Number |
| Coverage | 100px center | Mini ring + % |
| Impact | 80px center | Count badge, pink if > 0 |
| Last Updated | 120px | Relative time |
| Actions | 80px right | `…` menu: Open, Compare, Export, Delete |

---

## 6. Screen 2 — Create Story

**Route:** `/stories/new`

**Principle:** full page, never a modal, never a drawer. This is the most important creation flow in the product — modals feel low-stakes, full pages signal "this matters." Same pattern as Linear, Notion, GitHub Issues.

**Page structure:** top bar with back arrow + "Create Story" (no right-side actions). Content: 3-step wizard, centered, max-width 720px. Step indicator at top: "1 Input → 2 Settings → 3 Generate", pink for the active step.

### 6.1 Step 1 — Input

Headline: "Add your story" (24px/700). Subtext: "Paste text, upload a file, or import from Jira." (14px muted)

Tabs: **Paste Story** | **Upload File** | **Import from Jira** — underline on active (pink), muted text inactive.

**Paste Story tab**
- Textarea, full width, 240px tall, monospace 13px
- Placeholder:
  ```
  As a user, I want to log in with my email and password so that I can access my account.

  Acceptance Criteria:
  - User can enter email and password
  - Invalid credentials show an error
  - After 3 failed attempts, account is locked
  ```
- Character count bottom-right, 12px muted
- Ghost "Paste from clipboard" button appears inside textarea if clipboard has text

**Upload File tab**
- Dropzone 240px tall, dashed border, radius 8px, centered
- `Upload` icon 32px muted, "Drop a file here or click to browse" (14px navy), "Supports .pdf, .docx, .txt — up to 10MB" (12px muted)
- Drag hover: border → cyan, bg → `--color-surface-cyan`
- File selected: show filename + size + remove (×)

**Import from Jira tab**
- Input "Jira Issue Key" (e.g. AUTH-001), 200px + "Import" secondary button
- Not connected: show "Connect Jira" link in cyan
- On success: preview card with title, description, acceptance criteria fields

**Step 1 footer:** "Continue" (primary, right, disabled until content present) · "Cancel" (ghost, left → returns to `/stories`)

### 6.2 Step 2 — Analysis settings

Headline: "What should we test?" Subtext: "Select the test types to generate. You can add more later."

All checked by default. Each: 20px custom checkbox (navy border, pink check), label 14px navy, description 12px muted, expected count badge 11px cyan at right.

| Test type | Description | Expected count |
|---|---|---|
| Functional | Core happy-path scenarios | ~8 tests |
| Negative | Invalid inputs, wrong states | ~4 tests |
| Boundary | Edge values, limits | ~3 tests |
| Security | Auth, injection, permissions | ~3 tests |
| Accessibility | ARIA, keyboard, contrast | ~2 tests |

**Step 2 footer:** "Back" (ghost, left) · "Analyze Story" (primary, right)

### 6.3 Step 3 — Pre-generation intelligence

**This is a killer feature.** Before generating a single test, AI surfaces story quality problems. This is what turns TestSurge from a generator into an intelligence layer.

Headline: "Story analysis complete." Subtext: "Here's what we found before generating tests."

**Quality score card:** white card, bordered. Left: donut ring 160px, "87/100" 32px/700 center, "Story Quality" 12px muted below. Right: 3 stacked progress rows — Completeness 80%, Clarity 95%, Testability 63%.

**Issues found (N):** heading 15px/600 + warning icon. Each issue: `AlertTriangle` icon (16px warning color) + title 14px/600 + description 13px muted. Examples:
- "Missing acceptance criteria for error states" — Completeness
- "User role is ambiguous — which type of user?" — Clarity
- "No definition of what happens after 3 failed login attempts" — Testability

**Impact detection** (only renders if AI similarity search finds related stories — skip entirely otherwise): cyan info panel — "Potential impact detected. This story may affect existing stories: AUTH-001 Login · AUTH-002 Registration · AUTH-003 Password Reset. Estimated affected tests: 18."

**Step 3 footer:** "Improve Story First" (ghost → back to step 1, issues highlighted) · "Generate New Tests Only" (secondary) · "Generate + Analyze Impact" (primary, recommended)

---

## 7. Screen 3 — Story Workspace

**Route:** `/stories/:id`
**Purpose:** the most important screen in the product. Every insight about a story lives here.

### Workspace header (sticky, below top bar)

White bg, bottom border, 20px/32px padding.

Left: "LOGIN-001" cyan badge (13px) above story title (22px/700 navy).
Right: "Upload New Version" (ghost, Upload icon) · "Generate Tests" (secondary) · "Compare" (secondary) · "Export" (secondary)

Stats row below title: Coverage ring (48px) + "91% Coverage" · divider · "23 Tests" with TestTube icon · divider · "Impact: 5" (pink if > 0, muted if 0) · divider · "v2 · Updated 2h ago" (12px muted)

### Tab bar

Tabs: **Overview** | **Tests** | **Coverage** | **Impact** | **Export**
Active: bottom border 2px pink, text navy/600. Inactive: muted. Padding 14px/20px per tab.

### 7.1 Overview tab

- **Story section** — card, full story text 14px/400, line-height 1.6
- **Acceptance Criteria** — checkbox-style rows (visual only, not interactive). If none detected: warning banner "No acceptance criteria found. AI may generate lower quality tests."
- **Story Quality Analysis** — same quality card as step 3. "Improve Story" pink ghost button below issues opens inline edit of story text.
- **Risk Analysis** table:

  | Risk area | Severity | Description |
  |---|---|---|
  | Authentication bypass | High | No brute force protection specified |
  | Session management | Medium | Token expiry not defined |
  | Error messaging | Low | Error copy not specified |

- **AI Recommendations** — green success panel, numbered list, e.g.:
  1. Add acceptance criteria for: account lockout after 3 failed attempts
  2. Specify what happens to existing session when user logs in on a new device
  3. Define error message copy for invalid credentials vs. account locked

### 7.2 Tests tab

Two-panel layout: left 320px (test list), right flex (selected test detail), 1px divider.

**Left panel**
- Filter chips: All / Functional / Negative / Boundary / Security / Accessibility. 11px/600, active = pink bg + white text
- Search input, 32px tall, full width
- Bulk action bar (appears when ≥1 selected): checkbox + "N selected" + Approve / Regenerate / Delete ghost buttons
- List item, 48px tall: checkbox + priority badge (P1/P2/P3 in cyan/warning/muted) · title 13px/600 (truncate) + type chip 11px · status icon (Check / Clock / RefreshCw) right
- Active row: bg `--color-surface-pink`, left border 3px pink

**Right panel** (test detail, shown when a test is selected)
- Header: title 18px/600 + priority/type/status badges + Approve / Regenerate / Edit / Delete actions, right-aligned
- "Steps" — 13px/600 muted uppercase label, numbered list, 14px navy, line-height 1.7
- "Expected Result" — same label style, 14px navy text
- "Preconditions" (if applicable) — bulleted list
- AI Review panel at bottom: light cyan bg, `Sparkles` icon (cyan), "AI Review" 13px/600 cyan, review text 13px muted, "Suggest Missing Cases" ghost cyan button
- Empty (no test selected): "Select a test to view details", 14px muted, centered

### 7.3 Coverage tab

**Nobody else has this screen — core differentiator.** Most tools count test cases. TestSurge shows what's NOT tested and generates the missing tests.

Two columns: left 400px (summary), right flex (gaps + actions).

**Left — coverage summary**
- Wheel: 200px donut, "91%" 40px/700 center, "Coverage" 14px muted below
- Breakdown bars:

  | Test type | Coverage |
  |---|---|
  | Functional | 100% |
  | Negative | 85% |
  | Boundary | 70% |
  | Security | 60% |
  | Accessibility | 30% |

**Right — coverage gaps**
- Heading "Coverage Gaps (6)" 15px/600 + `AlertCircle` icon
- Each gap: `XCircle` icon (missing) or `AlertTriangle` (partial) + title 14px/600 + description 13px muted + type badge. Examples: Session Timeout, Rate Limiting, Token Expiry, Network Failure, Concurrent Login, Remember Me
- "Generate Missing Tests" primary full-width button below the list — opens a confirm step (all gaps pre-checked), then runs generation and returns to Tests tab with new tests highlighted

### 7.4 Impact tab

**Second killer feature.** Shows how this story affects other stories and tests. No modal — inline diff, GitHub style.

- Version selector chips at top: "v1 May 1" / "v2 May 14 (current)" — "Comparing v1 → v2"
- Impact summary, 3 metric cards: Modified 12 (warning) · Added 4 (success) · Removed 2 (error)
- Impacted test list — each row: severity badge + title (14px/600) + one-line impact reason (13px muted) + expand chevron

  Expanded row shows:
  - Impact type radio buttons: Modify Existing / Create New Test / Deprecate / Merge
  - AI recommendation banner (cyan): "AI Recommendation: Create New Test — Confidence: 96%. Reason: OAuth introduces an additional authentication flow. Original email/password login still exists."
  - Full diff viewer (shared component, see 2.4)
  - Actions: "Accept Change" (success green) · "Reject Change" (destructive) · "Edit Change" (ghost → inline editor)

### 7.5 Export tab

Headline: "Export Tests." Subtext: "Download your test cases as automation-ready scripts."

Format grid, 2 per row:

| Format | Description |
|---|---|
| Playwright | TypeScript E2E tests |
| Cypress | JavaScript E2E tests |
| PyTest | Python unit/E2E tests |
| BDD / Gherkin | Feature files (Given/When/Then) |
| Selenium | Java/Python WebDriver |
| Postman | API test collection JSON |

Selected card: border 2px pink, bg `--color-surface-pink`.

Options: "Include only approved tests" (checked by default) · "Group by test type" (unchecked) · "All 23 tests" with "Change selection" link

Preview: code block, navy bg, white/green monospace 13px, radius 8px, first 40 lines, "Copy" icon button top-right.

Actions: "Download .zip" (primary) · "Copy to clipboard" (secondary)

---

## 8. Screen 4 — Changes

**Route:** `/changes`
**Purpose:** every uploaded story that triggers cross-story impact becomes a Change Request here — the approval center, like a pull request workflow for requirement changes.

### 8.1 Change Request list

Filter tabs: Pending (3) | Approved (12) | Rejected (2) | All

**Change request card:** story title + ID badge ("AUTH-010 — OAuth Login Update") · status badge · "3 Stories Affected · 18 Tests Affected" (13px muted) · "Impact Score: High" badge (red/orange/green) · "Created 2h ago by AI Analysis" (12px muted) · "Review Change" secondary button, right

**Empty state:** `GitPullRequest` icon 48px muted. "No pending changes." "When you upload a new version of a story that affects other stories, change requests will appear here."

### 8.2 Change Review page

**Route:** `/changes/:id`

Top bar: back arrow + "OAuth Login Update — Change Review". Right: "Approve All" (success) · "Reject All" (destructive)

Summary header: 3 metric cards — Stories Affected, Tests Modified, Impact score.

**Affected Stories** — accordion list, each entry expands to show the full diff for that story's modified tests. E.g. AUTH-001 Login (8 modifications), AUTH-002 Registration (6), AUTH-003 Password Reset (4).

### 8.3 Diff viewer (Change Review)

Same shared component as Impact tab. Before panel (left, "Current Version") / after panel (right, "Proposed Version"), diff-highlighted.

### 8.4 Accept / reject workflow

Per-test actions: Accept (success icon button) · Reject (error icon button, keeps original) · Edit (pencil icon button, inline editor)

**Partial acceptance is core to the model** — user can accept 7 of 10, reject 2, edit 1. Summary bar at bottom: "7 Accepted · 2 Rejected · 1 Edited — Submit Review" (primary button).

On submit: accepted tests become the active version; rejected tests leave the original unchanged; edited tests use the user's edit; story version increments for all affected stories; Change Request status becomes Approved (even with some rejections) or Rejected (if all rejected).

**Version history**

| Version | Date | Summary |
|---|---|---|
| v1 | May 1 | Initial story — Email + Password login |
| v2 | May 14 | OAuth Added — 8 tests modified |
| v3 (current) | May 20 | MFA Added — 3 tests modified |

Click any version row to view the diff, coverage, and tests as of that version.

---

## 9. Screen 5 — Coverage Center

**Route:** `/coverage`
**Purpose:** workspace-wide coverage view, the management dashboard for QA leads.

Summary metric cards: Overall Coverage (donut, %) · Stories (total count) · Total Tests (across all stories) · Coverage Gaps (total)

**Most Risky Stories** table — "Needs Attention" heading + `AlertTriangle`:

| Story | Coverage | Risk |
|---|---|---|
| AUTH-010 OAuth Login | 48% | High — Missing security tests |
| PROFILE-003 User Settings | 55% | High — No boundary tests |
| PAYMENT-001 Checkout | 62% | Medium — Missing error states |

"View All" link below.

**Coverage by Type** — horizontal bar chart, full width. Y-axis: Functional/Negative/Boundary/Security/Accessibility. Color-coded per type.

**Worst Coverage by Category** — cards: "Missing Security Tests — 12 stories", "Missing Boundary Tests — 9 stories", "Missing Accessibility Tests — 17 stories", each with icon + "View Stories" link.

---

## 10. Screen 6 — Compare

**Route:** `/compare`
**Purpose:** side-by-side comparison of two stories — spot duplicate tests, coverage divergence, or how two similar features are tested differently.

- Two searchable dropdowns: "Story A" / "Story B" + swap icon button between them
- Delta summary cards: Added Tests +7 (success) · Removed Tests −2 (error) · Coverage Delta +7% (cyan) · Risk Delta +3 Security Risks (warning)
- Test comparison: 3 sections — "Only in Story A" / "Only in Story B" / "Similar in Both" (similarity % badge, e.g. "92% similar")
- Coverage comparison: two donut rings side by side + breakdown bars per type

---

## 11. Screen 7 — Exports

**Route:** `/exports`
**Purpose:** workspace-wide batch export across multiple stories.

Left panel (360px): story selector, search + multi-select checkboxes, "Select All" link, footer "12 stories selected (156 tests)".

Right panel: same format grid as the Export tab + radio: "Separate files per story" / "Single combined file" + "Download All" primary button.

---

## 12. Screen 8 — Settings

**Route:** `/settings`
Left sub-nav (200px) + right content area.

| Section | Route | Content |
|---|---|---|
| Workspace | `/settings/workspace` | Workspace name, timezone, default analysis types |
| Integrations | `/settings/integrations` | Jira, GitHub, GitLab connection cards |
| API Keys | `/settings/api-keys` | Create/revoke API keys for automation |
| Team | `/settings/team` | Invite members, roles (Admin/Member) |
| Billing | `/settings/billing` | Plan, usage, upgrade |
| Notifications | `/settings/notifications` | Email alerts for new changes, coverage drops |

Integration card: logo + name + status chip + Connect/Disconnect button. E.g. Jira "Connected to acme.atlassian.net" (success chip); GitHub "Not connected" (muted chip) + Connect (secondary).

---

## 13. Contextual AI Assistant

**Principle:** no floating chat button. AI appears inline, relevant to the current view — this makes it feel like intelligence, not a chatbot bolted on the side.

| Location | Placement | Prompt text |
|---|---|---|
| Story Workspace — Overview | Panel at bottom of page | "Ask about this story…" |
| Tests tab | Below test detail in right panel | "Ask about this test…" |
| Coverage tab | Below gap list | "What coverage is missing?" |
| Impact tab | Below diff viewer | "Why did this test change?" |
| Changes — Review page | Below change summary | "Explain the impact of this change." |

Component: full-width text input (36px), placeholder per table above, send icon button (pink), Enter to send. Response renders as a complete card below the input (bg `--color-surface-cyan`, no typewriter effect), with a "Clear" link top-right.

---

## 14. Motion & Animation (Framer Motion)

**Overall target: moderate** — tasteful micro-interactions throughout, not minimal, not maximal. Reference bar: Linear, Stripe, Vercel. Motion confirms cause and effect and adds polish — it never delays the user or calls attention to itself. If an animation is the first thing someone would describe about a screen, it's too much.

Install with `npm install framer-motion`. Centralize variants in `lib/motion.ts` and import them everywhere rather than redefining transition objects per component — keeps timing consistent and makes a future global speed adjustment a one-file change.

### Global motion tokens

| Token | Value | Use for |
|---|---|---|
| `duration.instant` | 0.1s | Hover states, button press feedback |
| `duration.fast` | 0.15s | Tab switches, checkbox toggles, chip selection |
| `duration.base` | 0.2s | Card hover, panel expand/collapse, tooltips |
| `duration.moderate` | 0.3s | Page transitions, side-panel slide |
| `duration.slow` | 0.5s | Multi-step reveals (quality bars, coverage rings filling) |
| `ease.standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Default for all enter/exit |
| `ease.out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering the screen |
| `ease.in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements leaving the screen |
| `spring.snappy` | stiffness 400, damping 30 | Toggles, drag, accordion chevrons |

### Reusable variants

```ts
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2, ease: easeStandard },
};
export const fadeInUp = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: easeOut },
};
export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.04 } },
};
export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  transition: { duration: 0.15 },
};
export const slideInRight = {
  initial: { x: 24, opacity: 0 },
  animate: { x: 0, opacity: 1 },
  exit: { x: 24, opacity: 0 },
  transition: { duration: 0.25, ease: easeStandard },
};
```

### Per-screen motion spec

**Sidebar** — active indicator uses `layoutId="sidebar-active"` so the pink left border slides between items instead of cutting. Hover bg is a plain CSS transition. Active icon gets a subtle scale 1 → 1.05 on selection.

**Stories page** — card grid wrapped in `staggerContainer`, each card `fadeInUp`, 40ms stagger on load. Card hover: `whileHover={{ y: -2 }}`. Hover action row (Open/Compare/Export) mounts only on hover via `AnimatePresence`, fades + slides up 8px. View toggle (Board/List) crossfades content with `AnimatePresence mode="wait"` — never slide, the shapes differ. Re-key the stagger container on filter/sort change so the cascade replays.

**Create Story wizard** — steps use `slideInRight`/exit-left with `AnimatePresence mode="wait"`. Step indicator dots scale 1 → 1.15 with `spring.snappy` on activation. Dropzone drag-over animates border-color + scale 1 → 1.01 at `duration.instant`. Step 3 quality ring animates `stroke-dashoffset` from full to target over `duration.slow`; quality bars animate width 0 → target%, staggered 80ms apart. Problems list staggers in after the ring finishes. Impact Detection panel (if present) fades in ~200ms after the quality score, as a second wave.

**Story Workspace tabs** — tab underline uses `layoutId="tab-underline"` to slide between tabs. Tab content swaps with fade only (no slide — would fight the underline). Header coverage ring animates its fill only on first load, not on every tab switch.

**Tests tab** — selecting a test crossfades the right panel (`duration.fast`). Active row highlight uses `layoutId="test-active-row"` so it slides between adjacent rows on keyboard nav. Bulk action bar slides down (height + opacity) when ≥1 row is selected. Approve action crossfades the Clock→Check icon plus a quick scale pulse (1→1.2→1) on the checkmark.

**Coverage tab** — wheel and bars use the same fill/width animation pattern as step 3. Gaps list staggers in. "Generate Missing Tests" shows an inline spinner crossfade in the button label while running.

**Impact tab** — switching version pairs fades the summary out then in sequentially (never overlapping). Summary card numbers count up from 0 on first reveal. Expanding a row uses Framer's `layout` prop for auto height, chevron rotates 0→180°. Diff viewer lines stagger in top-to-bottom at 10ms/line, capped at 0.3s total regardless of line count. Accept flashes a brief green background pulse (0→8%→0 opacity, 0.6s) before the row collapses; Reject fades + collapses height to 0.

**Changes screens** — list cards stagger in like Stories. Status badge changes crossfade content + bg-color. Accordion uses layout-based height animation, chevron rotates in sync. Submit Review pulses (scale 1→1.03→1) on the count that just changed.

**Side panels** (e.g. Upload New Version) — `slideInRight` + backdrop fade (opacity 0→0.4), both `duration.moderate`. Exit is slightly quicker (`duration.base`) than entrance.

**AI Assistant** — response card `fadeInUp`, appears as one complete block (no typewriter). Input focus: border-color transition + box-shadow ring fade, `duration.instant`.

**Toasts** (network errors only) — enter via `slideInRight` from bottom-right with `spring.snappy`; auto-exit after 4s with fade + slide down 8px.

### Reduced motion

Required, not optional — same priority tier as dark mode. Wrap config with `useReducedMotion()` and fall back to opacity-only transitions, no transforms, no stagger delays. Coverage rings/bars should snap to final state instead of animating fill.

### What NOT to animate

- Live data refreshes (websocket/poll updates) — only animate counts on first reveal, not on every background refresh
- Sidebar width, top bar height, or any layout-shifting chrome — stays static
- Diff viewer code content itself — only the reveal stagger animates, content swaps instantly
- Whole-page route transitions beyond a simple fade — no sliding pages, that's a mobile pattern and feels heavy on desktop

---

## 15. Empty States

| Screen | Icon | Copy |
|---|---|---|
| Stories — no stories | `BookOpen` | "No stories yet — Upload a user story, paste requirements, or import from Jira." |
| Tests tab — no tests | `TestTube2` | "No tests generated yet — Click Generate Tests to create your first test suite." |
| Coverage — no data | `PieChart` | "Coverage will appear once tests are generated." |
| Impact — no versions | `GitCompare` | "Upload a new version of this story to see impact analysis." |
| Changes — no changes | `GitPullRequest` | "No pending changes — changes appear when a new story affects existing ones." |
| Compare — nothing selected | `ArrowLeftRight` | "Select two stories above to begin comparison." |

All empty states: icon 48px muted, heading 18px/600 navy, subtext 14px muted, centered. Primary CTA button where appropriate.

---

## 16. Loading States

**Story analysis (Create Story step 3)** — full-width animated progress bar (pink, looping) at top. Center: rotating sparkle icon (cyan). Heading "Analyzing your story…". Subtext rotates every 2s: "Parsing acceptance criteria…" → "Checking story quality…" → "Searching for related stories…" → "Computing risk areas…"

**Test generation** — tests appear progressively as generated, not all at once. Each card fades in (opacity 0→1, y 8→0, 200ms). Top: "Generating tests… 12 of 23" with a thin progress bar.

**Skeleton loading** — gray animated shimmer rectangles matching card dimensions. Used on Stories page, Tests tab, Changes list. Shimmer: 1.4s ease-in-out infinite, `linear-gradient(90deg, #F1F5F9 25%, #E2E8F0 50%, #F1F5F9 75%)`.

---

## 17. Error States

| Error | Shown where | Copy |
|---|---|---|
| Story upload failed | Create Story — step 1 | "Upload failed. Check file format (PDF, DOCX, TXT) and try again." |
| Jira import failed | Create Story — step 1 | "Could not connect to Jira. Check your integration in Settings." |
| Analysis failed | Create Story — step 3 | "Analysis failed. You can still generate tests without quality scoring." |
| Generation failed | Tests tab | "Test generation failed. Retry or check the story for unsupported formats." |
| Network error | Any | Toast: "Connection lost. Changes will sync when you're back online." |
| Empty story | Create Story — step 1 | "Story content is empty. Add at least one requirement to continue." |

All inline errors: `AlertCircle` icon (red) + message in 13px `--color-error` + "Retry" link in cyan where applicable.

---

## 18. Copy Guide

**Voice & tone:** confident, precise, minimal, never salesy. Write for QA engineers and leads — technical, impatient, experienced. Active voice always: "Generate tests," not "Tests can be generated." Sentence case everywhere, no ALL CAPS except keyboard shortcuts. Banned filler: "easy," "powerful," "seamlessly," "robust."

| Wrong | Right |
|---|---|
| Upload Story | Create Story |
| AI-powered test generation | Test generation |
| Leverage our intelligent platform | Generate tests from requirements |
| This feature is coming soon | In development |
| Oops! Something went wrong | Upload failed. Try again. |
| Your tests are ready! 🎉 | Tests generated. 23 ready to review. |

**Story textarea placeholder:**
```
As a [user type], I want to [do something] so that [I get some benefit].

Acceptance Criteria:
- [Criterion 1]
- [Criterion 2]
- [Criterion 3]
```

**Button copy rules:** primary actions name the result ("Generate Tests," "Create Story," "Accept Change") — never bare "Submit"/"OK"/"Yes"/"Confirm". Destructive actions say what dies ("Delete Story," "Reject Change") — never just "Delete".

---

## 19. MVP Feature Scope

### Build in v1

- Story creation (paste, upload file, Jira import)
- Story quality analysis (quality score, problems, risk areas)
- Test generation (all 5 types)
- Coverage analysis (per-story, per-type breakdown, gap detection)
- Impact analysis (cross-story, diff viewer)
- Change Request workflow (propose, review, accept/reject, partial acceptance)
- Story version history
- Export (Playwright, Cypress, PyTest, BDD, Selenium, Postman)
- Story Compare (side-by-side)
- Coverage Center (workspace-wide)
- Contextual AI assistant

### Do NOT build in v1

- Test execution / test runs
- Bug tracking / defect management
- Sprint planning or backlog management
- Team assignments / task ownership
- RTM (Requirements Traceability Matrix)
- Test scheduling
- Native mobile app
- Real-time collaboration (comments, mentions)

**Reason:** these pull TestSurge toward becoming another TestRail. The differentiated, defensible space is AI requirement and test intelligence — stay there.

---

*End of specification. Build against this document section by section. Reference section numbers when asking for changes (e.g. "redo the diff viewer per section 2.4 / 7.4").*

---

## 20. Implementation Amendments (post-v1 build)

The following decisions were made during implementation and deviate from the original spec. They are recorded here so the spec stays as the single source of truth.

### 20.1 Test Types — Accessibility replaced by Performance

**Original spec (§6.2, §7.3):** Listed Accessibility as one of 5 test types.
**Actual implementation:** Backend LLM generates `positive`, `negative`, `boundary`, `security`, `performance` — never Accessibility. UI was updated to match:
- Coverage tab breakdown bars: Functional / Negative / Boundary / Security / **Performance**
- Create Story Step 2 checkboxes: same 5 types, Accessibility removed
- Accessibility will be added in v2 when a dedicated prompt is built.

### 20.2 Coverage Tab — Heuristic data, not real backend coverage

**Original spec (§7.3):** Shows exact per-type percentages (Functional 100%, Negative 85%, etc.) and named coverage gaps (Session Timeout, Rate Limiting, etc.).
**Actual implementation:**
- Overall coverage % = `min(100, round(testCaseCount / 40 * 100))` — estimated from test count
- Per-type bars = keyword classifier over test case titles (see `inferCategory()` in `adapters.ts`)
- Named gaps = info panel saying "Detailed coverage gap analysis not yet available. Use AI assistant."
- "Generate Missing Tests" button calls `POST /api/stories/rag-chat` with story content as query
- "(estimated)" badge shown on the overall ring
- Real coverage analysis endpoint planned for v2: `GET /api/stories/<id>/coverage`

### 20.3 Story Version History — Dropped from v1

**Original spec (§7.4 Impact tab, §8.4 Change Review):** Shows version chips (v1/v2/v3), version picker, story version increment on change approval.
**Actual implementation:**
- Version history is **not shown** in the UI. Stats row shows "Updated X ago" only.
- Backend: `story_versions` table exists in the DB and `GET /<id>/versions` + `POST /<id>/upload-version` endpoints are built.
- Frontend: "Upload New Version" modal calls `POST /<id>/upload-version` which archives the old content and regenerates tests.
- Version picker UI will be added in v2 once enough version data accumulates.

### 20.4 Export Formats — Only Excel works in v1

**Original spec (§7.5):** Shows 6 format cards: Playwright, Cypress, PyTest, BDD/Gherkin, Selenium, Postman.
**Actual implementation:**
- Only **Excel (.xlsx)** downloads real data via `GET /api/stories/testcases/download/<id>` with `credentials: include`.
- All other 5 format cards render as disabled with "In development" tooltip.
- Real code generation for other formats is v2 scope.

### 20.5 Modals — One exception to "no modals" rule

**Original spec (§2.3):** "Modals are never used."
**Actual implementation:** `StoryActions` uses a lightweight modal pattern (`UploadVersionModal`, `CompareModal`, `ExportModal`) for story-level actions. These are panel-style overlays with backdrop, not full-page navigation. All other creation/review flows remain full pages or slide-in panels as specified.

### 20.6 Project Picker — Added as pre-stories screen

**Not in original spec.**
**Added:** `/projects` route acts as a landing page after login. Backend scopes all data by `project_id`. Users select or create a project before entering the Stories page. Auto-selects if only one project exists. Project ID is stored in `localStorage` and passed as `?project_id=` query param.

### 20.7 Story Short Title — LLM-generated on upload

**Not in original spec.**
**Added:** On `POST /api/stories/upload`, a second LLM call generates a 3-5 word title from the story content (e.g. "Email Password Login Flow"). This is stored as `storyDescription` in LanceDB and used as the display title on story cards and in the workspace header. The full content is preserved in `doc_content_text`.

### 20.8 Authentication — Deferred to after v1 feature complete

**Original spec (§3 route tree):** Shows `/login` and `/signup` routes.
**Actual implementation:**
- Login/Register pages exist (`/login`, `/signup`) and are correctly wired to `POST /api/auth/login` and `POST /api/auth/register`.
- **Dev bypass:** `DEV_BYPASS_AUTH=1` in `.env` skips JWT entirely and uses a fixed dev `user_id`. This must be removed before production.
- Auth cookies: HTTP-only, `SameSite=Lax`, `Secure` only in production (`FLASK_ENV=production`).
- Frontend: `credentials: 'include'` on all requests, 401 → auto-refresh → redirect to `/login`.

### 20.9 "Generate Tests" button — Re-runs test generation

**Original spec (§7 Workspace header):** Shows "Generate Tests" secondary button.
**Actual implementation:** Calls `POST /api/stories/<id>/regenerate` which:
1. Deletes existing test cases for the story
2. Re-runs the full LLM test generation pipeline in a background thread
3. Triggers impact re-analysis after generation
Frontend shows the button in the workspace action strip; after clicking, the polling loop starts and the status chip shows "Analyzing".

### 20.10 Accept/Reject impacts — Persist to database

**Original spec (§7.4, §8):** Shows Accept/Reject/Edit buttons.
**Actual implementation:**
- Per-impact: `POST /api/stories/impacts/<impact_id>/review` with `{"action": "accept"|"reject"|"edit"}`
- Batch: `POST /api/stories/impacts/batch-review` — used by "Submit Review" and "Approve All"/"Reject All"
- These update `impact_status` to `'accepted'` or `'rejected'` in the `test_case_impacts` table and write an audit record to `impact_history`.
- The "Submit Review" button in `/changes/:id` calls batch-review for all pending impacts.

### 20.11 Security hardening — Production guards added

**Not in original spec.**
**Added to backend `__init__.py`:**
- `sys.exit(1)` if `DEV_BYPASS_AUTH=1` + `FLASK_ENV=production` — prevents accidental auth bypass in production
- `sys.exit(1)` if `JWT_SECRET_KEY` is missing or is the default string in production
- Security headers on every response: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Strict-Transport-Security` (production only)
- `JWT_COOKIE_HTTPONLY = True` set explicitly
