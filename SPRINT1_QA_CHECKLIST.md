# Sprint 1 — QA Validation Checklist

**Scope:** Validate all 7 Sprint 1 phases plus regression coverage on adjacent surfaces that must remain untouched (auth, credits, admin). Run against a **non-production** environment first (per the VPS DB Target Verification Report — migration + deploy have not happened yet).

**How to use:** Fill in Pass/Fail per row. Any Fail blocks production deployment until re-tested.

---

## 1. Authentication (regression — must be unaffected)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 1.1 | Log in with an existing valid user (email + password) | Logs in successfully, redirected to `/stories` or last route; JWT issued as before | |
| 1.2 | Log in with wrong password | Rejected with existing error message; no behavior change from pre-sprint | |
| 1.3 | Log out | Session cleared, redirected to `/login` | |
| 1.4 | Access a protected route while logged out | Redirected to `/login`; no Sprint 1 route (`/kanban`) bypasses this | |
| 1.5 | JWT expiry / refresh flow | Behaves identically to pre-sprint baseline | |
| 1.6 | `PATCH /api/auth/me` called by User A with User B's token swapped in (manual tamper test) | Updates only the identity resolved from the token's own session — never an arbitrary user_id from the body | |

## 2. Existing Users (pre-sprint accounts, post-deploy)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 2.1 | Existing user logs in after migration | Login succeeds; no first-login modal forced on them unless they genuinely have no workspace | |
| 2.2 | Existing user's `full_name` is `NULL` (pre-migration account) | Sidebar shows email only (no blank/undefined "name" line, no duplicate email) | |
| 2.3 | Existing user opens Settings | Existing settings unaffected; Team menu item present (they already have a workspace) | |
| 2.4 | Existing user's existing stories/test cases | All pre-existing data renders exactly as before — no data loss, no field renamed away | |
| 2.5 | Existing user sets Full Name via Settings/`PATCH /me` | Sidebar immediately reflects the new name, no duplicate of email | |

## 3. New Users

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 3.1 | Sign up with a new email | Account created; redirected into onboarding flow | |
| 3.2 | First-login modal — Full Name field | Required; cannot advance/finish without entering it | |
| 3.3 | First-login modal — Workspace Name field | Optional; can finish onboarding leaving it blank | |
| 3.4 | First-login modal — close (X) on the first step | X and Skip are hidden on step 1 (identity step); user cannot skip past required Full Name | |
| 3.5 | First-login modal — later steps (org, job title, referral) | X/Skip available as before; unchanged behavior | |
| 3.6 | Complete onboarding with Full Name + Workspace Name filled | `users.full_name` and workspace name both persist; sidebar shows both correctly | |
| 3.7 | Complete onboarding with Workspace Name left blank | Default workspace name (`"{email_prefix}'s workspace"`) is used as before | |
| 3.8 | New user with no workspace yet (edge case, e.g. interrupted onboarding) | Sidebar/WorkspaceSwitcher shows "Create Workspace" affordance instead of blank/null | |
| 3.9 | New user with no workspace — Settings nav | "Team" menu item is hidden until a workspace exists | |

## 4. Workspace Creation

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 4.1 | Click "Create Workspace" from WorkspaceSwitcher (no workspace state) | Navigates to `/onboarding/workspace`; workspace created on submit | |
| 4.2 | After creating a workspace | WorkspaceSwitcher now lists it; Team menu becomes visible; bottom-left panel shows the new workspace name | |
| 4.3 | Rename workspace as owner | `WorkspaceModel.rename` succeeds; new name reflected immediately in sidebar | |
| 4.4 | Rename workspace as non-owner member | Rejected/no-op — only the owner can rename | |
| 4.5 | Attempt to rename to an empty string | Rejected (no-op), prior name retained | |

## 5. Team Invitation (regression — multi-tenant boundary)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 5.1 | Invite a new member to a workspace | Existing invite flow unaffected by Sprint 1 changes | |
| 5.2 | Invited member accepts and logs in | Lands with correct workspace context; Team menu visible since workspace exists | |
| 5.3 | Invited member is assignable on a Story/Test Case | Appears in assignee picker only for workspaces they belong to (no cross-tenant leakage) | |
| 5.4 | Attempt to assign a user who is NOT a member of the workspace (API-level test) | Rejected by the assignee route — assignment requires `workspace_members` membership | |

## 6. Kanban Drag & Drop

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 6.1 | Story Kanban: drag a card from "In Review" → "In Progress" | Card moves instantly (optimistic); column updates | |
| 6.2 | Story Kanban: refresh page after drag | Card remains in "In Progress" — status persisted server-side | |
| 6.3 | Story Kanban: drag to "Completed" | Persists correctly; no orphaned/duplicate cards | |
| 6.4 | Test Case Kanban: drag a card from "To Do" → "In Progress" | Card moves instantly; `tc_status` PATCH fires | |
| 6.5 | Test Case Kanban: refresh page after drag | Card remains in "In Progress" — confirms `tc_status` written into `test_case_json` persisted correctly | |
| 6.6 | Test Case Kanban: drag to "Done" | Persists; activity timeline logs a `kanban_status_changed` entry | |
| 6.7 | Simulate a failed PATCH (network offline) mid-drag | Card optimistically moves, then rolls back to original column on failure | |
| 6.8 | Drag within the same column (reorder, no column change) | No PATCH fired (status unchanged); no error | |
| 6.9 | Two browser tabs: drag in tab A, refresh tab B | Tab B reflects tab A's change after refresh (server is source of truth) | |

## 7. Story Drawer (regression baseline for Test Case Drawer)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 7.1 | Click a Story card | Drawer opens showing Title, Status, Priority, Assignees, Comments, Activity | |
| 7.2 | Close drawer (X or overlay click) | Drawer closes cleanly, no state leak into next card opened | |
| 7.3 | Story Drawer still functions identically to pre-sprint | No regression from Test Case Drawer work (separate component, no shared state) | |

## 8. Test Case Drawer (new — Phase 1)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 8.1 | Click a Test Case card in Test Case Kanban | Drawer opens (does not navigate away) | |
| 8.2 | Drawer shows Title | Matches the test case's title | |
| 8.3 | Drawer shows Priority | Matches High/Medium/Low chip from the card | |
| 8.4 | Drawer shows Status (select) | Reflects current `tc_status`; changing it persists via `onStatusChange` → same `persistStatus` path as drag-drop | |
| 8.5 | Drawer shows Steps | Ordered list matches `steps[]` from the test case JSON, in order | |
| 8.6 | Drawer shows Expected Result | Matches `expectedResult` field | |
| 8.7 | Drawer shows Comments section | Lists existing comments; empty state shown when none | |
| 8.8 | Drawer shows Assignee section | Lists current assignees; empty state when none | |
| 8.9 | Drawer shows Activity Timeline | Shows chronological events incl. status changes, comments, assignment | |
| 8.10 | Change status from inside the drawer | Kanban board reflects the new column immediately after closing (or live) | |
| 8.11 | Open drawer, then open a different card without closing first | Drawer content fully swaps to the new test case (no stale data) | |

## 9. Comments

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 9.1 | Add a comment on a Story | Appears in Story drawer's comment list immediately | |
| 9.2 | Add a comment on a Test Case | Appears in Test Case drawer's comment list immediately | |
| 9.3 | Edit own comment | Succeeds; `updated_at` reflected | |
| 9.4 | Delete own comment | Removed from the list | |
| 9.5 | Attempt to edit/delete another user's comment (API-level) | Rejected — ownership enforced server-side (`AND user_id = %s`) | |
| 9.6 | Comment containing `@mention` of a workspace member | Mention is parsed, resolved against workspace member index, and triggers a notification (see Section 12) | |
| 9.7 | Comment containing `@mention` of a non-member / garbage text | No notification sent for unresolved mentions; comment still saves normally | |

## 10. Assignees

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 10.1 | Assign a user to a Story | Added to Story drawer's assignee list; triggers `notify_story_assigned` | |
| 10.2 | Assign a user to a Test Case | Added to Test Case drawer's assignee list; triggers `notify_test_case_assigned` | |
| 10.3 | Remove an assignee from a Story | Removed from list; no notification expected on removal | |
| 10.4 | Remove an assignee from a Test Case | Removed from list | |
| 10.5 | Assign the same user twice | No duplicate row (unique constraint `(workspace_id, test_case_id, user_id)` for test cases; equivalent for stories) | |
| 10.6 | Filter Stories by "Assignee = me" | Returns only stories assigned to the current user | |
| 10.7 | Filter Stories by "Assignee = unassigned" | Returns only stories with zero assignees | |

## 11. Activity Timeline

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 11.1 | Story: status change via Kanban drag | New activity entry appears, correctly attributed to the acting user | |
| 11.2 | Test Case: status change via Kanban drag or drawer | New `kanban_status_changed` activity entry with `tc_status` metadata | |
| 11.3 | Test Case: comment added | Activity entry logged | |
| 11.4 | Test Case: assignee added/removed | Activity entry logged | |
| 11.5 | Timeline ordering | Most recent activity first (or chronological, matching Story drawer's existing convention) | |
| 11.6 | Timeline is workspace/test-case scoped | Switching to a different test case shows only that test case's activity, not another's | |

## 12. Email Notifications

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 12.1 | Assign a user to a Story | Celery task `task_send_story_assigned` enqueued; email received by the assignee | |
| 12.2 | Assign a user to a Test Case | `task_send_test_case_assigned` enqueued; email received | |
| 12.3 | Add a comment with existing assignees on the item | `task_send_comment_added` enqueued; assignees (minus the commenter) notified | |
| 12.4 | `@mention` a workspace member in a comment | `task_send_mention` enqueued; only the mentioned member is notified | |
| 12.5 | `@mention` someone outside the workspace (should be unresolvable) | No email sent — mention resolution is workspace-scoped | |
| 12.6 | Email sending fails (simulate SES error) | Action (assign/comment) still succeeds; failure is swallowed and logged, not surfaced to the user | |
| 12.7 | Celery worker is down | Action still succeeds (notification dispatch doesn't block the request); task sits in queue or fails gracefully on retry per `max_retries=3` | |
| 12.8 | Email template renders correctly | Each of the 4 templates (`story_assigned`, `test_case_assigned`, `comment_added`, `mention`) renders with correct deep-link URL, no broken Jinja variables | |
| 12.9 | Self-assignment (user assigns themselves) | Either suppressed or harmless — verify no confusing "you were assigned by you" if not intended | |

## 13. AI Insights

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 13.1 | Open a Story's Overview tab | AI Insights section is collapsed by default, showing `[ Generate AI Insights ]` button | |
| 13.2 | Check Network tab on Overview load | No automatic call to the quality/insights endpoint until the button is clicked | |
| 13.3 | Click "Generate AI Insights" | Loading state shown, then results (risk areas, recommendations) render | |
| 13.4 | Click "Generate AI Insights" a second time (re-analyze icon) | Re-fetches; loading state shown again; new results replace old | |
| 13.5 | Navigate to a different story, then back | Insights state resets — does not show the previous story's stale insights or stay "expanded" carried over | |
| 13.6 | Insights fetch fails (API error) | Error state shown in place of results; button to retry available | |

## 14. Filters

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 14.1 | Stories: filter by Priority = High | Network request includes `priority` param; results server-filtered to High only | |
| 14.2 | Stories: filter by Priority = Medium / Low | Same, correct subset returned | |
| 14.3 | Stories: filter by Impact = Detected | Returns only stories with detected impact | |
| 14.4 | Stories: filter by Impact = No Impact | Returns only stories with no detected impact | |
| 14.5 | Stories: filter by Status = In Review / In Progress / Completed | Each returns the correct subset | |
| 14.6 | Stories: filter by Assignee (specific user) | Returns only that user's assigned stories | |
| 14.7 | Stories: combine multiple filters (e.g. Priority=High + Status=In Progress) | Both conditions applied (AND), result set is the intersection | |
| 14.8 | Stories: clear all filters | Returns to the full unfiltered list | |
| 14.9 | Test Cases: filter by Priority | Server-filtered correctly | |
| 14.10 | Test Cases: filter by Status (Approved/Pending/Rejected) | Server-filtered correctly | |
| 14.11 | Test Cases: filter by Automation Ready = true/false | Server-filtered correctly | |
| 14.12 | Test Cases: filter by Impacted = true/false | Correctly cross-references `test_case_impacts`; matches the Impact tab's own data | |
| 14.13 | Filters + pagination/count | Total counts shown match the filtered result set, not the unfiltered total | |
| 14.14 | Filters persist correctly across a page refresh (if intended) or reset cleanly (if not) | Behavior is consistent and not silently stale | |

## 15. Mobile Responsiveness

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 15.1 | Sidebar on a narrow viewport (< 768px) | Collapses appropriately / doesn't overlap content; nav still reachable | |
| 15.2 | Story Kanban on mobile | Columns are scrollable/stacked, not broken/overflowing horizontally in a way that hides content | |
| 15.3 | Test Case Kanban on mobile | Same — drag-drop may be limited on touch, but viewing/columns must not break | |
| 15.4 | Test Case Drawer on mobile | Opens as a usable full-width panel, not clipped or unreadable | |
| 15.5 | Filter bar on mobile | Filter `<select>` elements wrap/stack instead of overflowing the viewport | |
| 15.6 | First-login modal on mobile | Full Name / Workspace Name fields are usable, no keyboard-overlap issues | |
| 15.7 | `/kanban` page on mobile | Sub-mode toggle (Stories/Test Cases) and board both usable | |

## 16. Sidebar Navigation

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 16.1 | Sidebar lists Kanban item right after Stories | Order matches spec; icon renders (Kanban icon, not a missing/broken icon) | |
| 16.2 | Click each nav item (Stories, Kanban, Changes, Coverage, Compare, Exports) | Routes correctly; active-state highlight follows current route | |
| 16.3 | Sidebar collapse/expand (pin toggle) | Persists across reloads via localStorage; unaffected by Sprint 1 changes | |
| 16.4 | Footer panel — workspace name, user name, user email | All three shown distinctly; **no duplicate values** even when `full_name` is unset (name line hidden, not duplicated with email) | |
| 16.5 | Footer panel with `full_name` set | Name line shows the full name; email line shows email — never the same string twice | |
| 16.6 | Footer avatar initials | Derived from full name when present, else from email; never blank/"?" unless truly no email | |
| 16.7 | WorkspaceSwitcher with multiple workspaces | Switching works as before; unaffected by Phase 6/7 changes | |
| 16.8 | Settings → Team menu visibility | Hidden when `currentWorkspace` is falsy; visible once a workspace exists | |

## 17. Kanban Route (`/kanban`)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 17.1 | Navigate to `/kanban` directly (URL bar) | Loads correctly when authenticated | |
| 17.2 | Navigate to `/kanban` while logged out | Redirected to login (same protection as other app routes) | |
| 17.3 | `/kanban` Stories sub-mode | Renders `StoryKanban` with the same data/behavior as the Stories page's kanban view | |
| 17.4 | `/kanban` Test Cases sub-mode | Renders `TestCaseKanban` with drawer, filters, drag-drop all functional | |
| 17.5 | Toggle between Stories/Test Cases sub-modes on `/kanban` | Switches cleanly, no stale board state from the other mode | |
| 17.6 | `/kanban` respects current Project context | Only shows stories/test cases for the active project, consistent with `/stories` | |
| 17.7 | No duplicated kanban logic | Confirm via code review (already done) that `/kanban` only composes existing components — flag if any divergence in behavior vs. the Stories page's kanban view is found during testing | |

## 18. Credits Display (regression — must be unaffected)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 18.1 | Credits balance shown in `HeaderActions`/layout | Unchanged value and placement from pre-sprint | |
| 18.2 | Generating a story/test case consumes credits as before | No change in credit deduction logic (Sprint 1 did not touch billing/credits) | |
| 18.3 | Admin → Credits page (`/admin/credits`) | Loads and functions identically to baseline | |
| 18.4 | Low-credit warning / paywall behavior | Unchanged | |

## 19. Admin Dashboard (regression — must be unaffected)

| # | Test Case | Expected Result | Pass/Fail |
|---|---|---|---|
| 19.1 | Admin login (`/admin/login`) | Unaffected by Sprint 1 | |
| 19.2 | `/admin` overview page | Loads correctly; no new errors introduced by Sprint 1 changes (e.g. `full_name` column addition shouldn't break user listing) | |
| 19.3 | `/admin/users` | Lists users correctly; new `full_name` field doesn't break rendering for users where it's `NULL` | |
| 19.4 | `/admin/workspaces` | Lists workspaces; renamed workspaces (Phase 6) reflect correctly | |
| 19.5 | `/admin/usage`, `/admin/tokens` | Unaffected, data unchanged | |
| 19.6 | `/admin/errors` | Confirm no new error classes from Sprint 1 features are silently flooding this log (e.g. notification failures should log as benign skips, not admin-facing errors) | |
| 19.7 | `/admin/subscriptions` | Unaffected (billing untouched) | |

---

## Sign-off

| Role | Name | Date | Result |
|---|---|---|---|
| QA | | | |
| Engineering | | | |
| Product | | | |

**Deployment gate:** All Sections 1, 2, 5, 18, 19 (regression-critical) must be 100% Pass. Any Fail in Sections 6–17 (new functionality) should be triaged by severity before sign-off — but a Fail in a regression section blocks deployment outright regardless of severity elsewhere.
