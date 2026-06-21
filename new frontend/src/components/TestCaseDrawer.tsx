"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, TestTube2, MessageSquare, Pencil, Trash2, UserPlus, UserMinus, Clock, ListChecks, CheckCircle2,
} from "lucide-react";
import { type TestCase as DomainTestCase } from "@/types/domain";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

export type TcKanbanStatus = "todo" | "in_progress" | "done";

const TC_STATUS_LABEL: Record<TcKanbanStatus, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

const PRIORITY_COLOR: Record<string, string> = {
  High: "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low: "bg-slate-100 text-slate-600 border-slate-200",
};

interface ActivityEvent {
  id: string;
  event_type: string;
  details: any;
  created_at: string;
  actor_email: string | null;
}

interface TcComment {
  id: string;
  user_id: string;
  user_email: string;
  body: string;
  created_at: string;
  updated_at: string;
}

interface Assignee {
  user_id: string;
  email: string;
  assigned_by_email: string | null;
  assigned_at: string;
}

function initials(email: string): string {
  const name = email.split("@")[0] || "?";
  return name.slice(0, 2).toUpperCase();
}

function Avatar({ email, size = 24 }: { email: string; size?: number }) {
  return (
    <div
      title={email}
      style={{ width: size, height: size }}
      className="rounded-full bg-cyan/15 text-cyan border border-white flex items-center justify-center text-[9px] font-bold shrink-0"
    >
      {initials(email)}
    </div>
  );
}

function activityLabel(ev: ActivityEvent): string {
  switch (ev.event_type) {
    case "kanban_status_changed":
      return `moved to "${TC_STATUS_LABEL[ev.details?.tc_status as TcKanbanStatus] ?? ev.details?.tc_status ?? "?"}"`;
    case "assignee_added":
      return "assigned a teammate";
    case "assignee_removed":
      return "removed an assignee";
    case "comment_added":
      return "added a comment";
    case "comment_deleted":
      return "deleted a comment";
    default:
      return ev.event_type.replace(/_/g, " ");
  }
}

function activityIcon(ev: ActivityEvent) {
  if (ev.event_type === "assignee_added") return <UserPlus size={12} className="text-cyan" />;
  if (ev.event_type === "assignee_removed") return <UserMinus size={12} className="text-muted" />;
  if (ev.event_type === "comment_added" || ev.event_type === "comment_deleted")
    return <MessageSquare size={12} className="text-cyan" />;
  return <Clock size={12} className="text-muted" />;
}

interface TestCaseDrawerProps {
  storyId: string;
  testCase: DomainTestCase;
  /** Current kanban column, controlled by the parent board. */
  tcStatus: TcKanbanStatus;
  onClose: () => void;
  onStatusChange: (status: TcKanbanStatus) => void;
}

/**
 * Right-side detail drawer for a test case (Sprint 1 Phase 1). Mirrors the Story
 * Drawer (StoryKanban.tsx → StoryDetailDrawer): Title, Priority, Status, Steps,
 * Expected Result, Comments, Assignee, Activity Timeline. All collaboration data
 * is workspace-scoped and loaded from the backend.
 */
export function TestCaseDrawer({ storyId, testCase, tcStatus, onClose, onStatusChange }: TestCaseDrawerProps) {
  const tcId = testCase.id;
  const { user: currentUser } = useAuth();

  const [members, setMembers] = useState<{ user_id: string; email: string }[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [comments, setComments] = useState<TcComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  function loadActivity() {
    setActivityLoading(true);
    api.getTestCaseActivity(storyId, tcId)
      .then((res) => setActivity(res.activity))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }
  function loadComments() {
    setCommentsLoading(true);
    api.getTestCaseComments(storyId, tcId)
      .then((res) => setComments(res.comments))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }
  function loadAssignees() {
    api.getTestCaseAssignees(storyId, tcId)
      .then((res) => setAssignees(res.assignees))
      .catch(() => setAssignees([]));
  }

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    setCommentsLoading(true);
    api.getTestCaseActivity(storyId, tcId)
      .then((res) => { if (!cancelled) setActivity(res.activity); })
      .catch(() => { if (!cancelled) setActivity([]); })
      .finally(() => { if (!cancelled) setActivityLoading(false); });
    api.getTestCaseComments(storyId, tcId)
      .then((res) => { if (!cancelled) setComments(res.comments); })
      .catch(() => { if (!cancelled) setComments([]); })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    api.getTestCaseAssignees(storyId, tcId)
      .then((res) => { if (!cancelled) setAssignees(res.assignees); })
      .catch(() => { if (!cancelled) setAssignees([]); });
    api.getWorkspaceMembers()
      .then((res) => { if (!cancelled) setMembers(res.members); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [storyId, tcId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleAssign(userId: string) {
    try { await api.addTestCaseAssignee(storyId, tcId, userId); loadAssignees(); loadActivity(); } catch { /* noop */ }
  }
  async function handleUnassign(userId: string) {
    try { await api.removeTestCaseAssignee(storyId, tcId, userId); loadAssignees(); loadActivity(); } catch { /* noop */ }
  }
  async function handleAddComment() {
    const body = newComment.trim();
    if (!body) return;
    try { await api.addTestCaseComment(storyId, tcId, body); setNewComment(""); loadComments(); loadActivity(); } catch { /* noop */ }
  }
  async function handleSaveEdit(commentId: string) {
    const body = editingBody.trim();
    if (!body) return;
    try { await api.editTestCaseComment(storyId, tcId, commentId, body); setEditingId(null); loadComments(); } catch { /* noop */ }
  }
  async function handleDeleteComment(commentId: string) {
    try { await api.deleteTestCaseComment(storyId, tcId, commentId); loadComments(); loadActivity(); } catch { /* noop */ }
  }

  const assignedIds = new Set(assignees.map((a) => a.user_id));
  const unassigned = members.filter((m) => !assignedIds.has(m.user_id));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-navy/20"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.2 }}
        className="fixed top-0 right-0 bottom-0 z-50 w-[440px] max-w-[calc(100vw-2rem)] bg-white shadow-2xl flex flex-col"
      >
        {/* Header: id, title, priority, status */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-cyan font-mono">{tcId}</p>
            <button onClick={onClose} className="text-muted hover:text-navy" aria-label="Close">
              <X size={18} />
            </button>
          </div>
          <h3 className="text-sm font-semibold text-navy leading-snug mb-2.5">{testCase.title}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[testCase.priority] ?? PRIORITY_COLOR.Medium}`}>
              {testCase.priority}
            </span>
            {testCase.status && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                {testCase.status}
              </span>
            )}
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <TestTube2 size={11} /> {testCase.steps.length} steps
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[11px] text-muted">Status:</span>
            <select
              value={tcStatus}
              onChange={(e) => onStatusChange(e.target.value as TcKanbanStatus)}
              className="text-xs border border-border rounded-lg px-2 py-1 text-navy"
            >
              {(Object.keys(TC_STATUS_LABEL) as TcKanbanStatus[]).map((s) => (
                <option key={s} value={s}>{TC_STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Steps */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-navy mb-2 flex items-center gap-1.5">
              <ListChecks size={12} /> Steps
            </p>
            {testCase.steps.length === 0 ? (
              <p className="text-xs text-muted">No steps.</p>
            ) : (
              <ol className="space-y-1.5">
                {testCase.steps.map((s, i) => (
                  <li key={i} className="flex gap-2 text-xs text-navy">
                    <span className="text-muted font-mono shrink-0">{i + 1}.</span>
                    <span className="whitespace-pre-wrap break-words">{s}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Expected Result */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-navy mb-2 flex items-center gap-1.5">
              <CheckCircle2 size={12} /> Expected Result
            </p>
            <p className="text-xs text-navy whitespace-pre-wrap break-words">
              {testCase.expectedResult || <span className="text-muted">Not specified.</span>}
            </p>
          </div>

          {/* Assignees */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-navy mb-2">Assignees</p>
            <div className="space-y-2 mb-3">
              {assignees.length === 0 && <p className="text-xs text-muted">No one assigned yet.</p>}
              {assignees.map((a) => (
                <div key={a.user_id} className="flex items-center gap-2">
                  <Avatar email={a.email} size={24} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-navy truncate">{a.email}</p>
                    <p className="text-[10px] text-muted">
                      Assigned By: {a.assigned_by_email ?? "—"} · {new Date(a.assigned_at).toLocaleString()}
                    </p>
                  </div>
                  <button onClick={() => handleUnassign(a.user_id)} className="text-muted hover:text-pink shrink-0" title="Remove assignee">
                    <UserMinus size={14} />
                  </button>
                </div>
              ))}
            </div>
            {unassigned.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value) { handleAssign(e.target.value); e.target.value = ""; } }}
                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 text-navy"
              >
                <option value="" disabled>+ Assign a teammate…</option>
                {unassigned.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.email}</option>
                ))}
              </select>
            )}
            <p className="text-[10px] text-muted mt-2">Only invited team members can be assigned.</p>
          </div>

          {/* Comments */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-navy mb-2 flex items-center gap-1.5">
              <MessageSquare size={12} /> Comments
            </p>
            <div className="space-y-3 mb-3">
              {commentsLoading ? (
                <p className="text-xs text-muted">Loading…</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-muted">No comments yet.</p>
              ) : (
                comments.map((c) => {
                  const isMine = currentUser?.email === c.user_email;
                  const isEditing = editingId === c.id;
                  return (
                    <div key={c.id} className="flex items-start gap-2">
                      <Avatar email={c.user_email} size={22} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-medium text-navy truncate">{c.user_email}</p>
                          <p className="text-[10px] text-muted">{new Date(c.created_at).toLocaleString()}</p>
                          {c.updated_at !== c.created_at && (
                            <span className="text-[10px] text-muted italic">(edited)</span>
                          )}
                        </div>
                        {isEditing ? (
                          <div className="mt-1 flex flex-col gap-1.5">
                            <textarea
                              value={editingBody}
                              onChange={(e) => setEditingBody(e.target.value)}
                              className="w-full text-xs border border-border rounded-lg px-2 py-1.5 text-navy resize-none"
                              rows={2}
                            />
                            <div className="flex items-center gap-2">
                              <button onClick={() => handleSaveEdit(c.id)} className="text-[11px] font-medium text-cyan hover:underline">Save</button>
                              <button onClick={() => setEditingId(null)} className="text-[11px] text-muted hover:underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-navy mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                        )}
                      </div>
                      {isMine && !isEditing && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button onClick={() => { setEditingId(c.id); setEditingBody(c.body); }} className="text-muted hover:text-cyan" title="Edit comment">
                            <Pencil size={12} />
                          </button>
                          <button onClick={() => handleDeleteComment(c.id)} className="text-muted hover:text-pink" title="Delete comment">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add a comment…  Use @email to mention a teammate."
                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 text-navy resize-none"
                rows={2}
              />
              <button
                onClick={handleAddComment}
                disabled={!newComment.trim()}
                className="self-end text-[11px] font-medium text-white bg-cyan rounded-lg px-3 py-1.5 disabled:opacity-40"
              >
                Post
              </button>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="px-5 py-4">
            <p className="text-xs font-semibold text-navy mb-2">Activity Timeline</p>
            {activityLoading ? (
              <p className="text-xs text-muted">Loading…</p>
            ) : activity.length === 0 ? (
              <p className="text-xs text-muted">No activity yet.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-2">
                    <div className="mt-0.5">{activityIcon(ev)}</div>
                    <div className="min-w-0">
                      <p className="text-xs text-navy">
                        <span className="font-medium">{ev.actor_email ?? "Someone"}</span> {activityLabel(ev)}
                      </p>
                      <p className="text-[10px] text-muted">{new Date(ev.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </motion.aside>
    </AnimatePresence>
  );
}
