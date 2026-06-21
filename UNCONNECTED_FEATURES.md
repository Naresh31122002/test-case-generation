# Unconnected Features Audit

*Generated 2026-06-21 by automated workflow audit*

---

## 🔴 Completely Disconnected (mock/no-op)

| Feature | Location | Current State | What's Needed |
|---|---|---|---|
| Bulk "Generate Tests" button | `stories/page.tsx` — BulkActionBar | `setTimeout + Math.random()` mock | Wire to `POST /api/stories/<id>/regenerate` for each selected story |
| Run Comparison (CompareModal) | `stories/[id]/StoryActions.tsx` | `runMockAsync()` (setTimeout + Math.random) | Implement `POST /api/stories/<id>/compare-versions` + call from frontend |
| Export Tab — framework code previews | `stories/[id]/tabs/ExportTab.tsx` | All 6 code previews hardcoded static strings; Download .zip, Copy buttons have no onClick | Implement backend export endpoints; wire buttons |
| Export Tab — filter checkboxes | `stories/[id]/tabs/ExportTab.tsx` | "Include only approved tests" / "Group by test type" toggle local state only | Pass as query params to real export endpoint |
| Settings — Profile (save) | `settings/profile/page.tsx` | Name/email/role update local state only; "Save Changes" and "Change Avatar" have no onClick | Implement `PATCH /api/auth/me`; wire form submit |
| Settings — Billing (all buttons) | `settings/billing/page.tsx` | "Downgrade", "Upgrade", "Update payment method" have no onClick; plan/usage stats hardcoded | Wire to `POST /api/stripe/checkout` + `POST /api/stripe/portal` (endpoints exist); fetch usage from `GET /api/workspaces/current/credits` |
| Settings — Integrations | `settings/integrations/page.tsx` | "Disconnect" (Jira), "Connect" (GitHub/GitLab) have no onClick | Implement OAuth flow endpoints; wire buttons |
| Settings — Team (invite form) | `settings/team/page.tsx` | Invite adds to local state only; no call to `POST /api/workspaces/invites` | Call `POST /api/workspaces/invites`; `DELETE /api/workspaces/members/<id>`; fetch real member list |
| Settings — Team (role change) | `settings/team/page.tsx` | Role select has no onChange handler | Call `PATCH /api/workspaces/members/<user_id>` on role change |
| Settings — Notifications | `settings/notifications/page.tsx` | All 6 toggles update local state only; "Save Preferences" has no onClick | Implement `GET/PUT /api/auth/me/notifications`; wire toggles and save |
| Settings — API Keys | `settings/api-keys/page.tsx` | "Generate" uses `Math.random()` into local state; "Copy"/"Revoke" have no real handlers | Implement `GET/POST/DELETE /api/auth/api-keys`; wire all buttons |
| Notification bell (mark/remove) | `components/HeaderActions.tsx` | All actions call `MockActivityService` (`lib/activity.ts`); in-memory only | Implement `GET/PATCH/DELETE /api/activity`; replace MockActivityService |
| Project rename | `contexts/ProjectContext.tsx` — `renameProject` | Mutates in-memory state only; lost on reload | Implement `PATCH /api/stories/projects/<id>`; call in `renameProject` |
| Project archive / unarchive | `contexts/ProjectContext.tsx` | Mutates in-memory state only | Same endpoint with `archived` flag |
| Project delete | `contexts/ProjectContext.tsx` | Mutates in-memory state only | Implement `DELETE /api/stories/projects/<id>` |
| Project create | `contexts/ProjectContext.tsx` | Adds to local state only; disappears on reload if no stories uploaded | Implement `POST /api/workspaces/projects`; call in `createProject` |

---

## 🟡 Partially Connected

| Feature | Location | Issue | Fix Needed |
|---|---|---|---|
| **Approve test case (single + bulk)** | `lib/api.ts` line 719 | Sends `POST` but backend only accepts `PATCH` → **405 Method Not Allowed** | Change `post()` to `patch()` on line 719 |
| **Update story status / Kanban drag** | `lib/api.ts` line 674 | Sends `POST` but backend only accepts `PATCH` → **405 Method Not Allowed** | Change `post()` to `patch()` on line 674 |
| Export — Excel download | `stories/[id]/StoryActions.tsx` | Excel works; PDF/CSV/JSON immediately show error — not implemented | Implement or disable PDF/CSV/JSON options |
| Regenerate story acceptance criteria | `lib/ai/requirements.ts` line 211 | Calls `POST /api/stories/rag-chat` but treats `testCases[]` as acceptance criteria — structurally mismatched | Add dedicated endpoint or fix response field mapping |
| Admin subscriptions page | `lib/adminApi.ts` line 49 | Calls `GET /api/admin/subscriptions`; handler exists in `admin.py` but **has no route decorator** → 404 | Add `@admin_bp.route("/subscriptions", methods=["GET"])` decorator |

---

## 🔵 Missing Backend Endpoint

| Feature | Frontend Call | Missing Endpoint | Notes |
|---|---|---|---|
| **Upload New Version modal** | `api.ts` — `uploadNewVersion` | `POST /api/stories/<id>/upload-version` | Handler `upload_new_version` exists in `stories.py` line 2439 but **has no route decorator** |
| Profile save | `settings/profile/page.tsx` | `PATCH /api/auth/me` | No backend route exists at all |
| Notification preferences | `settings/notifications/page.tsx` | `GET/PUT /api/auth/me/notifications` | No backend route exists |
| API key management | `settings/api-keys/page.tsx` | `GET/POST/DELETE /api/auth/api-keys` | No backend routes exist |
| Integrations OAuth | `settings/integrations/page.tsx` | `/api/integrations/jira`, `/github`, `/gitlab` | No backend routes exist |
| Activity / notification feed | `components/HeaderActions.tsx` | `GET/PATCH/DELETE /api/activity` | MockActivityService is the only implementation |
| Project rename / archive / delete | `contexts/ProjectContext.tsx` | `PATCH/DELETE /api/stories/projects/<id>` | No backend routes exist |
| Version comparison | `stories/[id]/StoryActions.tsx` | `POST /api/stories/<id>/compare-versions` | No backend route exists |
| Framework code export | `stories/[id]/tabs/ExportTab.tsx` | `GET /api/stories/<id>/export?format=playwright` etc. | No backend routes exist |

---

## ✅ Connected & Working

Auth: login, register, Google sign-in, email verify, forgot/reset password, token refresh.
Stories: delete, generate tests, upload, re-fetch projects.
Test cases: delete (single/bulk), regenerate (single/bulk), refine, approve → save, edit → save, bulk delete.
Story detail tabs: Overview quality analysis, Tests AI Group, Coverage AI chat, Impact accept/reject.
Changes page: per-impact accept/reject, batch review, submit review.
Generate flow: analyze requirements, generate stories, generate tests + analyze impact.
Sidebar: sign out.
Admin: metrics, users, workspaces, credits, token usage.

---

## Priority Build Order

### P0 — One-line fixes, already broken (fix immediately)

1. **`api.approveTestCase` HTTP method** — `lib/api.ts` line 719: `post(` → `patch(`. Fixes approve toggle + bulk approve.
2. **`api.updateStoryStatus` HTTP method** — `lib/api.ts` line 674: `post(` → `patch(`. Fixes Kanban drag-drop.
3. **Add route decorator for `upload_new_version`** — `Backend/app/routes/stories.py` line 2438: add `@stories_bp.route("/<story_id>/upload-version", methods=["POST"])`. Fixes Upload New Version modal.
4. **Add route decorator for `get_subscriptions`** — `Backend/app/routes/admin.py`: add `@admin_bp.route("/subscriptions", methods=["GET"])`. Fixes admin subscriptions page.

### P1 — Backend exists, just needs frontend wiring (1-2 days)

5. **Settings — Team page** — `POST /api/workspaces/invites`, `DELETE /api/workspaces/members/<id>`, `PATCH /api/workspaces/members/<id>`. Backend built; only frontend form calls missing.
6. **Settings — Billing** — `POST /api/stripe/checkout`, `POST /api/stripe/portal`, `GET /api/workspaces/current/credits`. Backend exists; only onClick handlers missing.

### P2 — New backend endpoints, high user impact (3-5 days)

7. **Profile save** — `PATCH /api/auth/me`; wire settings/profile form.
8. **Notification preferences** — `GET/PUT /api/auth/me/notifications`; wire toggles.
9. **API key management** — `GET/POST/DELETE /api/auth/api-keys`.
10. **Project rename / archive / delete** — `PATCH/DELETE /api/stories/projects/<id>`; replace in-memory mutations.

### P3 — Significant build effort (1-2 weeks)

11. **Activity / notification feed** — `/api/activity` CRUD; replace MockActivityService.
12. **Framework-specific code export** — `/api/stories/<id>/export?format=<framework>`.
13. **Fix `regenerateStory` response mapping** — align rag-chat response with acceptance criteria shape.

### P4 — Feature-complete, lower priority

14. **Version comparison** — `POST /api/stories/<id>/compare-versions`.
15. **Integrations OAuth** — Jira/GitHub/GitLab OAuth flow endpoints.
16. **Bulk "Generate Tests"** — Replace mock in BulkActionBar with parallel `POST /api/stories/<id>/regenerate` calls.
