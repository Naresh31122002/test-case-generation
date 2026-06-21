"use client";

import { useState, useCallback, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  TestTube2, Zap, ExternalLink, Users, X, Clock, UserPlus, UserMinus,
  MessageSquare, Pencil, Trash2, Sparkles, ShieldAlert, Gauge,
  ListChecks, GitBranch, RefreshCw, GripVertical,
} from "lucide-react";
import { type Story } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { StatusChip } from "@/components/ui/StatusChip";
import { api, type StoryIntelligence } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type KanbanStatus = "in_review" | "in_progress" | "completed";

function initials(email: string): string {
  const name = email.split("@")[0] || "?";
  return name.slice(0, 2).toUpperCase();
}

function AssigneeAvatar({ email, size = 22 }: { email: string; size?: number }) {
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

const COLUMNS: { id: KanbanStatus; label: string; color: string; dot: string }[] = [
  { id: "in_review",   label: "In Review",  color: "border-blue-200 bg-blue-50/40",   dot: "bg-blue-400" },
  { id: "in_progress", label: "In Progress", color: "border-yellow-200 bg-yellow-50/40", dot: "bg-yellow-400" },
  { id: "completed",   label: "Completed",  color: "border-green-200 bg-green-50/40", dot: "bg-green-500" },
];

interface StoryKanbanProps {
  stories: Story[];
  onStatusChange?: (storyId: string, newStatus: KanbanStatus) => void;
}

function StoryCard({
  story,
  dragging = false,
  assigneePreview = [],
  assigneeCount = 0,
  onOpenActivity,
  dragHandleProps,
}: {
  story: Story & { _kanban?: KanbanStatus };
  dragging?: boolean;
  assigneePreview?: { user_id: string; email: string }[];
  assigneeCount?: number;
  onOpenActivity?: (storyId: string) => void;
  dragHandleProps?: Pick<ReturnType<typeof useSortable>, "attributes" | "listeners">;
}) {
  return (
    <div
      onClick={() => {
        console.debug("[Kanban] StoryCard click fired", story.id);
        onOpenActivity?.(story.id);
      }}
      className={`bg-white border rounded-card p-3.5 shadow-sm transition-shadow cursor-pointer ${
        dragging ? "shadow-lg opacity-90 rotate-1" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        {dragHandleProps ? (
          <span
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing text-muted hover:text-navy -ml-1 p-0.5"
            title="Drag to move"
          >
            <GripVertical size={13} />
          </span>
        ) : (
          <span />
        )}
        <span className="text-[10px] font-bold text-cyan">{story.id}</span>
        <StatusChip status={story.status} />
      </div>
      <p className="text-sm font-semibold text-navy leading-tight line-clamp-2 mb-2.5">{story.title}</p>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <CoverageRing coverage={story.coverage} size={24} strokeWidth={3} />
          <span className="text-[11px] font-semibold text-muted">{story.coverage}%</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted">
          <TestTube2 size={11} />
          <span>{story.testCount}</span>
        </div>
        {story.impactCount > 0 && (
          <div className="flex items-center gap-1 text-[11px] font-semibold text-pink">
            <Zap size={11} />
            <span>{story.impactCount}</span>
          </div>
        )}
        <Link
          href={`/stories/${story.id}`}
          className="ml-auto text-muted hover:text-cyan transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={13} />
        </Link>
      </div>
      {assigneeCount > 0 && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-border/60">
          <div className="flex -space-x-1.5">
            {assigneePreview.map((a) => (
              <AssigneeAvatar key={a.user_id} email={a.email} />
            ))}
          </div>
          <span className="flex items-center gap-0.5 text-[10px] text-muted ml-auto">
            <Users size={10} />
            {assigneeCount}
          </span>
        </div>
      )}
    </div>
  );
}

function SortableStoryCard({
  story,
  assigneePreview,
  assigneeCount,
  onOpenActivity,
}: {
  story: Story & { _kanban: KanbanStatus };
  assigneePreview?: { user_id: string; email: string }[];
  assigneeCount?: number;
  onOpenActivity?: (storyId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: story.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <StoryCard
        story={story}
        assigneePreview={assigneePreview}
        assigneeCount={assigneeCount}
        onOpenActivity={onOpenActivity}
        dragHandleProps={{ attributes, listeners }}
      />
    </div>
  );
}

interface ActivityEvent {
  id: string;
  event_type: string;
  details: any;
  created_at: string;
  actor_email: string | null;
}

function activityLabel(ev: ActivityEvent): string {
  switch (ev.event_type) {
    case "status_changed":
      return `moved to "${ev.details?.new_status ?? "?"}"`;
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

interface StoryComment {
  id: string;
  user_id: string;
  user_email: string;
  body: string;
  created_at: string;
  updated_at: string;
}

const RISK_COLORS: Record<string, string> = {
  Low: "bg-green-50 text-green-700 border-green-200",
  Medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  High: "bg-red-50 text-red-700 border-red-200",
};

const TEST_AREA_LABELS: Record<keyof StoryIntelligence["suggested_test_areas"], string> = {
  functional: "Functional",
  security: "Security",
  performance: "Performance",
  accessibility: "Accessibility",
};

function AIInsightsSection({ storyId }: { storyId: string }) {
  const [data, setData] = useState<StoryIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    setError(null);
    api.getStoryIntelligence(storyId)
      .then((res) => setData(res))
      .catch((e) => setError(e?.message || "Could not load AI Insights"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId]);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await api.refreshStoryIntelligence(storyId);
      setData(res);
    } catch (e: any) {
      setError(e?.message || "Could not refresh AI Insights");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="px-5 py-4 border-b border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-navy flex items-center gap-1.5">
          <Sparkles size={12} className="text-cyan" /> AI Insights
        </p>
        <button
          onClick={handleRefresh}
          disabled={loading || refreshing}
          className="text-muted hover:text-cyan disabled:opacity-40"
          title="Regenerate AI Insights"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
        </button>
      </div>

      {loading ? (
        <p className="text-xs text-muted">Analyzing story…</p>
      ) : error ? (
        <p className="text-xs text-pink">{error}</p>
      ) : !data ? null : (
        <div className="space-y-3">
          {/* Risk score */}
          <div className="flex items-start gap-2">
            <ShieldAlert size={13} className="text-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-navy">Risk:</span>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RISK_COLORS[data.risk_score.level]}`}>
                  {data.risk_score.level}
                </span>
              </div>
              {data.risk_score.risk_areas.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {data.risk_score.risk_areas.map((r, i) => (
                    <li key={i} className="text-[10px] text-muted">
                      <span className="font-medium text-navy">{r.area}:</span> {r.description}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Requirement quality */}
          <div className="flex items-start gap-2">
            <Gauge size={13} className="text-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-navy">Requirement Quality:</span>
                <span className="text-[11px] font-bold text-cyan">{data.requirement_quality.score}/100</span>
              </div>
              {data.requirement_quality.recommendations.length > 0 && (
                <ul className="mt-1 space-y-0.5">
                  {data.requirement_quality.recommendations.slice(0, 2).map((rec, i) => (
                    <li key={i} className="text-[10px] text-muted">• {rec}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Missing acceptance criteria */}
          {(data.missing_criteria.missing_scenarios.length > 0 ||
            data.missing_criteria.missing_validations.length > 0 ||
            data.missing_criteria.missing_security_requirements.length > 0) && (
            <div className="flex items-start gap-2">
              <ListChecks size={13} className="text-muted mt-0.5 shrink-0" />
              <div className="min-w-0">
                <span className="text-[11px] font-medium text-navy">Missing Acceptance Criteria:</span>
                <ul className="mt-1 space-y-0.5">
                  {data.missing_criteria.missing_scenarios.map((s, i) => (
                    <li key={`sc-${i}`} className="text-[10px] text-muted">• Scenario: {s}</li>
                  ))}
                  {data.missing_criteria.missing_validations.map((s, i) => (
                    <li key={`val-${i}`} className="text-[10px] text-muted">• Validation: {s}</li>
                  ))}
                  {data.missing_criteria.missing_security_requirements.map((s, i) => (
                    <li key={`sec-${i}`} className="text-[10px] text-muted">• Security: {s}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Suggested test areas */}
          <div className="flex items-start gap-2">
            <TestTube2 size={13} className="text-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-navy">Suggested Test Areas:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {(Object.keys(TEST_AREA_LABELS) as Array<keyof typeof TEST_AREA_LABELS>)
                  .filter((k) => data.suggested_test_areas[k])
                  .map((k) => (
                    <span key={k} className="text-[10px] font-medium bg-cyan/10 text-cyan border border-cyan/20 rounded-full px-2 py-0.5">
                      {TEST_AREA_LABELS[k]}
                    </span>
                  ))}
                {(Object.keys(TEST_AREA_LABELS) as Array<keyof typeof TEST_AREA_LABELS>).every(
                  (k) => !data.suggested_test_areas[k]
                ) && <span className="text-[10px] text-muted">None suggested</span>}
              </div>
            </div>
          </div>

          {/* Impact summary */}
          <div className="flex items-start gap-2">
            <GitBranch size={13} className="text-muted mt-0.5 shrink-0" />
            <div className="min-w-0">
              <span className="text-[11px] font-medium text-navy">Impact Summary:</span>
              <p className="text-[10px] text-muted mt-0.5">
                {data.impact_summary.impacted_stories.length} stories ·{" "}
                {data.impact_summary.impacted_modules.length} modules ·{" "}
                {data.impact_summary.impacted_test_cases.length} test cases
              </p>
            </div>
          </div>

          <p className="text-[10px] text-muted pt-1 border-t border-border/60">
            Last generated: {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

function StoryDetailDrawer({
  story,
  members,
  assignees,
  onClose,
  onAssign,
  onUnassign,
  onStatusChange,
}: {
  story: Story & { _kanban: KanbanStatus };
  members: { user_id: string; email: string }[];
  assignees: { user_id: string; email: string; assigned_by_email: string | null; assigned_at: string }[];
  onClose: () => void;
  onAssign: (userId: string) => void;
  onUnassign: (userId: string) => void;
  onStatusChange: (status: KanbanStatus) => void;
}) {
  const storyId = story.id;
  const { user: currentUser } = useAuth();
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [comments, setComments] = useState<StoryComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");

  function loadActivity() {
    setActivityLoading(true);
    api.getStoryActivity(storyId)
      .then((res) => setActivity(res.activity))
      .catch(() => setActivity([]))
      .finally(() => setActivityLoading(false));
  }

  function loadComments() {
    setCommentsLoading(true);
    api.getStoryComments(storyId)
      .then((res) => setComments(res.comments))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    setActivityLoading(true);
    setCommentsLoading(true);
    api.getStoryActivity(storyId)
      .then((res) => { if (!cancelled) setActivity(res.activity); })
      .catch(() => { if (!cancelled) setActivity([]); })
      .finally(() => { if (!cancelled) setActivityLoading(false); });
    api.getStoryComments(storyId)
      .then((res) => { if (!cancelled) setComments(res.comments); })
      .catch(() => { if (!cancelled) setComments([]); })
      .finally(() => { if (!cancelled) setCommentsLoading(false); });
    return () => { cancelled = true; };
  }, [storyId]);

  async function handleAddComment() {
    const body = newComment.trim();
    if (!body) return;
    try {
      await api.addStoryComment(storyId, body);
      setNewComment("");
      loadComments();
      loadActivity();
    } catch { /* surfaced via unchanged comment list */ }
  }

  async function handleSaveEdit(commentId: string) {
    const body = editingBody.trim();
    if (!body) return;
    try {
      await api.editStoryComment(storyId, commentId, body);
      setEditingId(null);
      loadComments();
    } catch { /* surfaced via unchanged comment list */ }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await api.deleteStoryComment(storyId, commentId);
      loadComments();
      loadActivity();
    } catch { /* surfaced via unchanged comment list */ }
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
        className="fixed top-0 right-0 bottom-0 z-50 w-[420px] bg-white shadow-2xl flex flex-col"
      >
        {/* Story information */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-cyan">{storyId}</p>
            <button onClick={onClose} className="text-muted hover:text-navy">
              <X size={18} />
            </button>
          </div>
          <h3 className="text-sm font-semibold text-navy leading-snug mb-2.5">{story.title}</h3>
          <div className="flex items-center gap-3 mb-2.5">
            <div className="flex items-center gap-1.5">
              <CoverageRing coverage={story.coverage} size={22} strokeWidth={3} />
              <span className="text-[11px] font-semibold text-muted">{story.coverage}%</span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-muted">
              <TestTube2 size={11} />
              <span>{story.testCount} tests</span>
            </div>
            {story.impactCount > 0 && (
              <div className="flex items-center gap-1 text-[11px] font-semibold text-pink">
                <Zap size={11} />
                <span>{story.impactCount}</span>
              </div>
            )}
            <Link
              href={`/stories/${story.id}`}
              className="ml-auto text-muted hover:text-cyan transition-colors"
              title="Open story"
            >
              <ExternalLink size={13} />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted">Status:</span>
            <select
              value={story._kanban}
              onChange={(e) => onStatusChange(e.target.value as KanbanStatus)}
              className="text-xs border border-border rounded-lg px-2 py-1 text-navy"
            >
              {COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* AI Insights */}
          <AIInsightsSection storyId={storyId} />

          {/* Assignees */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-xs font-semibold text-navy mb-2">Assignees</p>
            <div className="space-y-2 mb-3">
              {assignees.length === 0 && <p className="text-xs text-muted">No one assigned yet.</p>}
              {assignees.map((a) => (
                <div key={a.user_id} className="flex items-center gap-2">
                  <AssigneeAvatar email={a.email} size={24} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-navy truncate">{a.email}</p>
                    <p className="text-[10px] text-muted">
                      Assigned By: {a.assigned_by_email ?? "—"} · Assigned At: {new Date(a.assigned_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onUnassign(a.user_id)}
                    className="text-muted hover:text-pink shrink-0"
                    title="Remove assignee"
                  >
                    <UserMinus size={14} />
                  </button>
                </div>
              ))}
            </div>
            {unassigned.length > 0 && (
              <select
                defaultValue=""
                onChange={(e) => { if (e.target.value) { onAssign(e.target.value); e.target.value = ""; } }}
                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 text-navy"
              >
                <option value="" disabled>+ Assign a teammate…</option>
                {unassigned.map((m) => (
                  <option key={m.user_id} value={m.user_id}>{m.email}</option>
                ))}
              </select>
            )}
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
                      <AssigneeAvatar email={c.user_email} size={22} />
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
                              <button
                                onClick={() => handleSaveEdit(c.id)}
                                className="text-[11px] font-medium text-cyan hover:underline"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-[11px] text-muted hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-navy mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                        )}
                      </div>
                      {isMine && !isEditing && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            onClick={() => { setEditingId(c.id); setEditingBody(c.body); }}
                            className="text-muted hover:text-cyan"
                            title="Edit comment"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => handleDeleteComment(c.id)}
                            className="text-muted hover:text-pink"
                            title="Delete comment"
                          >
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
                placeholder="Add a comment…"
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

          {/* Activity timeline */}
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

export function StoryKanban({ stories, onStatusChange }: StoryKanbanProps) {
  type Item = Story & { _kanban: KanbanStatus };
  const toItem = (s: Story): Item => ({ ...s, _kanban: (s.kanbanStatus ?? 'in_review') as KanbanStatus });

  const [items, setItems] = useState<Item[]>(() => stories.map(toItem));
  const [activeId, setActiveId] = useState<string | null>(null);

  // Sync when stories prop changes (e.g. after API reload)
  const [prevStories, setPrevStories] = useState(stories);
  if (stories !== prevStories) {
    setPrevStories(stories);
    setItems(stories.map(toItem));
  }

  // Collaboration: assignee previews/counts per story, workspace member list, open panel.
  const [assigneePreviews, setAssigneePreviews] = useState<Record<string, { user_id: string; email: string }[]>>({});
  const [assigneeCounts, setAssigneeCounts] = useState<Record<string, number>>({});
  const [members, setMembers] = useState<{ user_id: string; email: string }[]>([]);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);
  const [storyAssignees, setStoryAssignees] = useState<
    { user_id: string; email: string; assigned_by_email: string | null; assigned_at: string }[]
  >([]);

  useEffect(() => {
    api.getWorkspaceMembers().then((res) => setMembers(res.members)).catch(() => setMembers([]));
  }, []);

  // Refresh per-card assignee previews/counts whenever the visible story set changes.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      items.map((s) =>
        api.getStoryAssignees(s.id).then((res) => ({ id: s.id, assignees: res.assignees })).catch(() => ({ id: s.id, assignees: [] }))
      )
    ).then((results) => {
      if (cancelled) return;
      const previews: Record<string, { user_id: string; email: string }[]> = {};
      const counts: Record<string, number> = {};
      for (const r of results) {
        previews[r.id] = r.assignees.slice(0, 3).map((a) => ({ user_id: a.user_id, email: a.email }));
        counts[r.id] = r.assignees.length;
      }
      setAssigneePreviews(previews);
      setAssigneeCounts(counts);
    });
    return () => { cancelled = true; };
  }, [items.map((s) => s.id).join(",")]);

  function refreshAssignees(storyId: string) {
    api.getStoryAssignees(storyId).then((res) => {
      setStoryAssignees(res.assignees);
      setAssigneePreviews((prev) => ({ ...prev, [storyId]: res.assignees.slice(0, 3).map((a) => ({ user_id: a.user_id, email: a.email })) }));
      setAssigneeCounts((prev) => ({ ...prev, [storyId]: res.assignees.length }));
    });
  }

  function openActivityPanel(storyId: string) {
    console.debug("[Kanban] openActivityPanel fired", storyId);
    setOpenStoryId(storyId);
    console.debug("[Kanban] openStoryId updated", storyId);
    refreshAssignees(storyId);
  }

  async function persistStatusChange(storyId: string, targetStatus: KanbanStatus) {
    const current = items.find((s) => s.id === storyId);
    if (!current || current._kanban === targetStatus) return;

    setItems((prev) =>
      prev.map((s) => (s.id === storyId ? { ...s, _kanban: targetStatus } : s))
    );

    try {
      await api.updateStoryStatus(storyId, targetStatus);
      onStatusChange?.(storyId, targetStatus);
    } catch {
      setItems((prev) =>
        prev.map((s) => (s.id === storyId ? { ...s, _kanban: current._kanban } : s))
      );
    }
  }

  async function handleAssign(userId: string) {
    if (!openStoryId) return;
    try {
      await api.addStoryAssignee(openStoryId, userId);
      refreshAssignees(openStoryId);
    } catch { /* surfaced via unchanged assignee list */ }
  }

  async function handleUnassign(userId: string) {
    if (!openStoryId) return;
    try {
      await api.removeStoryAssignee(openStoryId, userId);
      refreshAssignees(openStoryId);
    } catch { /* surfaced via unchanged assignee list */ }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const storyById = useCallback(
    (id: string) => items.find((s) => s.id === id),
    [items]
  );

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const draggedId = String(active.id);
    const overId = String(over.id);

    // overId is either a column id or another story id
    let targetStatus: KanbanStatus | null = null;
    if (COLUMNS.find((c) => c.id === overId)) {
      targetStatus = overId as KanbanStatus;
    } else {
      const overStory = items.find((s) => s.id === overId);
      if (overStory) targetStatus = overStory._kanban;
    }

    if (!targetStatus) return;
    await persistStatusChange(draggedId, targetStatus);
  }

  const activeStory = activeId ? storyById(activeId) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className="flex gap-5 min-h-[60vh] pb-8">
        {COLUMNS.map((col) => {
          const colStories = items.filter((s) => s._kanban === col.id);
          return (
            <div
              key={col.id}
              id={col.id}
              className={`flex-1 min-w-[280px] flex flex-col border rounded-xl p-3 ${col.color}`}
            >
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span className="text-sm font-semibold text-navy">{col.label}</span>
                </div>
                <span className="text-[11px] font-bold text-muted bg-white border border-border rounded-full px-2 py-0.5">
                  {colStories.length}
                </span>
              </div>

              {/* Drop zone + cards */}
              <SortableContext
                id={col.id}
                items={colStories.map((s) => s.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  id={col.id}
                  className="flex-1 space-y-2.5 min-h-[120px]"
                >
                  {colStories.length === 0 ? (
                    <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/60 rounded-lg">
                      <p className="text-xs text-muted">Drop stories here</p>
                    </div>
                  ) : (
                    colStories.map((story) => (
                      <SortableStoryCard
                        key={story.id}
                        story={story}
                        assigneePreview={assigneePreviews[story.id]}
                        assigneeCount={assigneeCounts[story.id]}
                        onOpenActivity={openActivityPanel}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </div>
          );
        })}
      </div>

      <DragOverlay>
        {activeStory ? (
          <div className="w-[280px]">
            <StoryCard story={activeStory} dragging />
          </div>
        ) : null}
      </DragOverlay>

      {openStoryId && storyById(openStoryId) && (
        <StoryDetailDrawer
          story={storyById(openStoryId)!}
          members={members}
          assignees={storyAssignees}
          onClose={() => setOpenStoryId(null)}
          onAssign={handleAssign}
          onUnassign={handleUnassign}
          onStatusChange={(status) => persistStatusChange(openStoryId, status)}
        />
      )}
    </DndContext>
  );
}
