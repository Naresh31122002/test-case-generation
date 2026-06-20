"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  X,
  Check,
  Users,
  ArrowRight,
  UserPlus,
  MessageSquare,
  Clock,
  CheckCircle2,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  ExternalLink,
  TestTube2,
  Search,
  Filter,
  AlertTriangle,
} from "lucide-react";
import { type TestCase, type TestStatus, type TestType, stories } from "@/lib/seed";
import { teamMembers, memberById, type TeamMember } from "@/lib/team";
import { staggerContainer, fadeInUp } from "@/lib/motion";

/* ─────────────────────── Collaboration data model ─────────────────────── */

interface Comment {
  id: string;
  authorId: string;
  own: boolean;
  body: string;
  createdAt: number;
  editedAt?: number;
}

type ActivityKind = "created" | "assigned" | "unassigned" | "status" | "comment" | "priority";

interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  message: string;
  createdAt: number;
}

interface CardMeta {
  /** Multiple invited members assigned to this card. */
  assigneeIds: string[];
  /** Member who created the card (derived, stable). */
  createdById: string;
  comments: Comment[];
  activity: ActivityEntry[];
  /** Last update timestamp (mirrors most recent activity). */
  updatedAt: number;
}

/** The acting user (mock "me"). In a real app this comes from auth/session. */
const CURRENT_USER: TeamMember = teamMembers[0] ?? {
  id: "me", name: "You", email: "you@acme.com", role: "Admin", avatar: "ME",
};

let _seq = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${_seq++}`;

/** Deterministic "created by" so Created-By filtering is real, stable data. */
function deriveCreator(cardId: string): string {
  if (teamMembers.length === 0) return CURRENT_USER.id;
  let h = 0;
  for (let i = 0; i < cardId.length; i++) h = (h * 31 + cardId.charCodeAt(i)) >>> 0;
  return teamMembers[h % teamMembers.length].id;
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

/* ─── Avatar + stack ─── */
function Avatar({ member, size = 22, ring = false }: { member: TeamMember; size?: number; ring?: boolean }) {
  return (
    <span
      title={member.name}
      className={`rounded-full bg-pink text-white font-bold flex items-center justify-center flex-shrink-0 ${
        ring ? "ring-2 ring-white" : ""
      }`}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {member.avatar}
    </span>
  );
}

/** Overlapping avatar stack with +N overflow and a hover tooltip listing all. */
function AvatarStack({ ids, max = 3 }: { ids: string[]; max?: number }) {
  const members = ids.map((id) => memberById(id)).filter((m): m is TeamMember => Boolean(m));
  const [hover, setHover] = useState(false);

  if (members.length === 0) {
    return (
      <span
        className="w-[22px] h-[22px] rounded-full border border-dashed border-border text-muted flex items-center justify-center flex-shrink-0"
        title="Unassigned"
      >
        <UserPlus size={11} />
      </span>
    );
  }

  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <span
      className="relative flex items-center -space-x-1.5 flex-shrink-0"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {shown.map((m) => (
        <Avatar key={m.id} member={m} size={22} ring />
      ))}
      {overflow > 0 && (
        <span className="w-[22px] h-[22px] rounded-full bg-gray-200 text-muted text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
          +{overflow}
        </span>
      )}
      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-7 z-40 w-max max-w-[200px] bg-navy text-white text-[11px] rounded-lg px-2.5 py-1.5 shadow-card pointer-events-none"
          >
            {members.map((m) => (
              <p key={m.id} className="whitespace-nowrap leading-relaxed">{m.name}</p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}

/** Close a popover when clicking outside its ref. */
function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);
  return ref;
}

/* ─────────────────────── Columns / status ─────────────────────── */

type ColId = "review" | "progress" | "completed" | "rejected";

const STATUS_TO_COL: Record<TestStatus, ColId> = {
  Pending: "review",
  Regenerating: "progress",
  Approved: "completed",
  Rejected: "rejected",
};
const COL_TO_STATUS: Record<ColId, TestStatus> = {
  review: "Pending",
  progress: "Regenerating",
  completed: "Approved",
  rejected: "Rejected",
};

interface Col {
  id: ColId;
  label: string;
  accent: string;
  bg: string;
  border: string;
  dot: string;
  countBg: string;
  countText: string;
}

const COLUMNS: Col[] = [
  { id: "review",    label: "In Review",   accent: "text-[#1E40AF]", bg: "bg-[#EFF6FF]", border: "border-[#93C5FD]", dot: "#93C5FD", countBg: "bg-[#DBEAFE]", countText: "text-[#1E40AF]" },
  { id: "progress",  label: "In Progress", accent: "text-[#92400E]", bg: "bg-[#FFFBEB]", border: "border-[#FCD34D]", dot: "#F59E0B", countBg: "bg-[#FEF3C7]", countText: "text-[#92400E]" },
  { id: "completed", label: "Completed",   accent: "text-[#065F46]", bg: "bg-[#ECFDF5]", border: "border-[#6EE7B7]", dot: "#10B981", countBg: "bg-[#D1FAE5]", countText: "text-[#065F46]" },
  { id: "rejected",  label: "Rejected",    accent: "text-[#991B1B]", bg: "bg-[#FEF2F2]", border: "border-[#FCA5A5]", dot: "#EF4444", countBg: "bg-[#FEE2E2]", countText: "text-[#991B1B]" },
];

const typeColor: Record<string, string> = {
  Functional:    "bg-[#EFF6FF] text-[#1E40AF]",
  Negative:      "bg-[#FEF2F2] text-[#991B1B]",
  Boundary:      "bg-[#FFFBEB] text-[#92400E]",
  Security:      "bg-[#FFF0F7] text-[#FF0A78]",
  Accessibility: "bg-[#ECFDF5] text-[#065F46]",
};

const priorityColor: Record<string, string> = {
  P1: "bg-[#ECFEFF] text-cyan border-cyan/40",
  P2: "bg-[#FFFBEB] text-[#92400E] border-[#FCD34D]",
  P3: "bg-[#F8FAFC] text-[#64748B] border-[#CBD5E1]",
};

const ALL_TYPES: TestType[] = ["Functional", "Negative", "Boundary", "Security", "Accessibility"];
const ALL_PRIORITIES = ["P1", "P2", "P3"] as const;

interface KanbanItem extends TestCase {
  colId: ColId;
}

function toItems(tests: TestCase[]): KanbanItem[] {
  return tests.map((t) => ({ ...t, colId: STATUS_TO_COL[t.status] }));
}

/* ─────────────────────── Filters ─────────────────────── */

interface Filters {
  assignees: string[];   // member ids; special: "me", "unassigned"
  priorities: string[];
  statuses: ColId[];
  storyIds: string[];
  types: string[];
  createdBy: string[];
  updated: "" | "today" | "week" | "month";
}

const EMPTY_FILTERS: Filters = {
  assignees: [], priorities: [], statuses: [], storyIds: [], types: [], createdBy: [], updated: "",
};

const UPDATED_OPTIONS: { value: Filters["updated"]; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
];

/** Generic multi-select dropdown used across the filter bar. */
function MultiSelect({
  label,
  options,
  selected,
  onToggle,
  onClear,
  renderOption,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
  onClear: () => void;
  renderOption?: (o: { value: string; label: string }) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const active = selected.length > 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-btn border text-sm font-medium transition-colors ${
          active
            ? "bg-brand-primary-light text-brand-primary border-brand-primary"
            : "bg-white text-muted border-border hover:text-navy hover:bg-gray-50"
        }`}
      >
        {label}
        {active && (
          <span className="text-[10px] font-bold bg-pink text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center">
            {selected.length}
          </span>
        )}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-10 z-30 w-56 bg-white border border-border rounded-card shadow-card py-1"
          >
            <div className="max-h-64 overflow-y-auto py-0.5">
              {options.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted">No options.</p>
              ) : (
                options.map((o) => {
                  const on = selected.includes(o.value);
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => onToggle(o.value)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors"
                    >
                      <span className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${on ? "bg-pink border-pink" : "border-navy"}`}>
                        {on && <Check size={11} className="text-white" />}
                      </span>
                      <span className="flex-1 min-w-0">{renderOption ? renderOption(o) : <span className="text-navy">{o.label}</span>}</span>
                    </button>
                  );
                })
              )}
            </div>
            {active && (
              <div className="border-t border-border px-3 py-1.5">
                <button type="button" onClick={onClear} className="text-xs font-medium text-pink hover:underline">
                  Clear
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterBar({
  filters,
  setFilters,
}: {
  filters: Filters;
  setFilters: (f: Filters) => void;
}) {
  const toggle = (key: keyof Filters, value: string) => {
    const arr = filters[key] as string[];
    const next = arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
    setFilters({ ...filters, [key]: next });
  };
  const clear = (key: keyof Filters) => setFilters({ ...filters, [key]: [] });

  const memberOpts = [
    { value: "me", label: "Assigned to me" },
    { value: "unassigned", label: "Unassigned" },
    ...teamMembers.map((m) => ({ value: m.id, label: m.name })),
  ];
  const storyOpts = stories.map((s) => ({ value: s.id, label: `${s.id} — ${s.title.slice(0, 28)}` }));

  const anyActive =
    filters.assignees.length || filters.priorities.length || filters.statuses.length ||
    filters.storyIds.length || filters.types.length || filters.createdBy.length || filters.updated;

  return (
    <div className="flex items-center gap-2 flex-wrap pl-6 pb-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide pr-1">
        <Filter size={13} /> Filters
      </span>

      <MultiSelect
        label="Assignee"
        options={memberOpts}
        selected={filters.assignees}
        onToggle={(v) => toggle("assignees", v)}
        onClear={() => clear("assignees")}
      />
      <MultiSelect
        label="Priority"
        options={ALL_PRIORITIES.map((p) => ({ value: p, label: p }))}
        selected={filters.priorities}
        onToggle={(v) => toggle("priorities", v)}
        onClear={() => clear("priorities")}
      />
      <MultiSelect
        label="Status"
        options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
        selected={filters.statuses}
        onToggle={(v) => toggle("statuses", v)}
        onClear={() => clear("statuses")}
      />
      <MultiSelect
        label="Story"
        options={storyOpts}
        selected={filters.storyIds}
        onToggle={(v) => toggle("storyIds", v)}
        onClear={() => clear("storyIds")}
      />
      <MultiSelect
        label="Type"
        options={ALL_TYPES.map((t) => ({ value: t, label: t }))}
        selected={filters.types}
        onToggle={(v) => toggle("types", v)}
        onClear={() => clear("types")}
      />
      <MultiSelect
        label="Created By"
        options={teamMembers.map((m) => ({ value: m.id, label: m.name }))}
        selected={filters.createdBy}
        onToggle={(v) => toggle("createdBy", v)}
        onClear={() => clear("createdBy")}
      />

      {/* Updated date — single select */}
      <UpdatedSelect
        value={filters.updated}
        onChange={(v) => setFilters({ ...filters, updated: v })}
      />

      {anyActive ? (
        <button
          type="button"
          onClick={() => setFilters(EMPTY_FILTERS)}
          className="h-9 px-3 inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-error transition-colors"
        >
          <X size={13} /> Clear all
        </button>
      ) : null}
    </div>
  );
}

function UpdatedSelect({
  value,
  onChange,
}: {
  value: Filters["updated"];
  onChange: (v: Filters["updated"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setOpen(false));
  const current = UPDATED_OPTIONS.find((o) => o.value === value);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`h-9 px-3 inline-flex items-center gap-1.5 rounded-btn border text-sm font-medium transition-colors ${
          value ? "bg-brand-primary-light text-brand-primary border-brand-primary" : "bg-white text-muted border-border hover:text-navy hover:bg-gray-50"
        }`}
      >
        {current ? current.label : "Updated Date"}
        <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-10 z-30 w-44 bg-white border border-border rounded-card shadow-card py-1"
          >
            {UPDATED_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value === value ? "" : o.value); setOpen(false); }}
                className="w-full flex items-center justify-between px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
              >
                {o.label}
                {o.value === value && <Check size={14} className="text-pink" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─────────────────────── 3-dot card menu ─────────────────────── */

function CardMenu({
  item,
  onOpenDrawer,
  onMove,
  onDelete,
}: {
  item: KanbanItem;
  onOpenDrawer: () => void;
  onMove: (col: ColId) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => { setOpen(false); setMoveOpen(false); });
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div ref={ref} className="relative flex-shrink-0" onPointerDown={stop}>
      <button
        type="button"
        title="Card actions"
        onClick={(e) => { stop(e); setOpen((v) => !v); }}
        className={`w-6 h-6 rounded flex items-center justify-center text-muted hover:text-navy hover:bg-gray-100 transition-all opacity-60 group-hover:opacity-100 ${open ? "opacity-100 bg-gray-100 text-navy" : ""}`}
      >
        <MoreHorizontal size={15} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-8 z-40 w-48 bg-white border border-border rounded-card shadow-card py-1"
            onClick={stop}
          >
            <MenuItem icon={ExternalLink} label="Open Story" onClick={() => { setOpen(false); router.push(`/stories/${item.storyId}`); }} />
            <MenuItem icon={TestTube2} label="Open Test Case" onClick={() => { setOpen(false); onOpenDrawer(); }} />
            <MenuItem icon={UserPlus} label="Assign Member" onClick={() => { setOpen(false); onOpenDrawer(); }} />

            {/* Move To submenu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setMoveOpen((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-navy hover:bg-gray-50 transition-colors"
              >
                <ChevronRight size={14} className="text-muted flex-shrink-0" />
                <span className="flex-1 text-left">Move To</span>
                <ChevronDown size={13} className={`text-muted transition-transform ${moveOpen ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {moveOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.12 }}
                    className="overflow-hidden bg-gray-50/60"
                  >
                    {COLUMNS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={c.id === item.colId}
                        onClick={() => { setOpen(false); setMoveOpen(false); onMove(c.id); }}
                        className="w-full flex items-center gap-2.5 pl-9 pr-3 py-2 text-sm text-left text-navy hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-default"
                      >
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
                        {c.label}
                        {c.id === item.colId && <Check size={13} className="text-muted ml-auto" />}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="my-1 border-t border-border" />
            <MenuItem icon={Trash2} label="Delete Test Case" danger onClick={() => { setOpen(false); onDelete(); }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon, label, onClick, danger = false,
}: {
  icon: typeof ExternalLink; label: string; onClick: () => void; danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
        danger ? "text-error hover:bg-[#FEF2F2]" : "text-navy hover:bg-gray-50"
      }`}
    >
      <Icon size={14} className="flex-shrink-0" />
      {label}
    </button>
  );
}

/* ─────────────────────── Card ─────────────────────── */

function KanbanCard({
  item,
  isDragging = false,
  assigneeIds = [],
  onOpen,
  onMove,
  onDelete,
  dragHandleProps,
}: {
  item: KanbanItem;
  isDragging?: boolean;
  assigneeIds?: string[];
  onOpen?: () => void;
  onMove?: (col: ColId) => void;
  onDelete?: () => void;
  dragHandleProps?: Record<string, unknown>;
}) {
  const story = stories.find((s) => s.id === item.storyId);

  return (
    <div
      // Whole card is the drag handle (Jira/Linear/Trello). Click still opens drawer.
      {...dragHandleProps}
      onClick={() => onOpen?.()}
      className={`group bg-white border rounded-card p-3.5 transition-shadow ${
        onOpen ? "cursor-pointer" : "select-none"
      } ${
        isDragging
          ? "shadow-[0_10px_28px_rgba(0,0,0,0.14)] scale-[1.02] border-pink"
          : "border-border hover:shadow-card hover:border-cyan"
      }`}
    >
      {/* Header: priority + type (left) · 3-dot menu (right) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[item.priority]}`}>
            {item.priority}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor[item.type]}`}>
            {item.type}
          </span>
        </div>
        {!isDragging && onMove && onDelete && (
          <CardMenu item={item} onOpenDrawer={() => onOpen?.()} onMove={onMove} onDelete={onDelete} />
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-navy leading-snug mb-2">{item.title}</p>

      {/* Footer: story reference · assignee avatars */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted truncate">
          {story?.id} · {story?.title.slice(0, 22)}{(story?.title.length ?? 0) > 22 ? "…" : ""}
        </p>
        <AvatarStack ids={assigneeIds} />
      </div>
    </div>
  );
}

/* ─── Sortable wrapper — whole card draggable ─── */
function SortableCard({
  item,
  assigneeIds,
  onOpen,
  onMove,
  onDelete,
}: {
  item: KanbanItem;
  assigneeIds: string[];
  onOpen: () => void;
  onMove: (col: ColId) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { colId: item.colId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="group">
      <KanbanCard
        item={item}
        assigneeIds={assigneeIds}
        onOpen={onOpen}
        onMove={onMove}
        onDelete={onDelete}
        // Spread DnD listeners over the ENTIRE card.
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}

/* ─── Column (highlights while a card is dragged over) ─── */
function KanbanColumn({
  col,
  items,
  metaFor,
  isOver,
  onOpen,
  onMove,
  onDelete,
}: {
  col: Col;
  items: KanbanItem[];
  metaFor: (id: string) => CardMeta;
  isOver: boolean;
  onOpen: (id: string) => void;
  onMove: (id: string, col: ColId) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col min-w-[280px] flex-1">
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg border-x border-t ${col.border} ${col.bg}`}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: col.dot }} />
          <span className={`text-[13px] font-semibold ${col.accent}`}>{col.label}</span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.countBg} ${col.countText}`}>
          {items.length}
        </span>
      </div>

      <div
        className={`flex-1 min-h-[400px] rounded-b-lg border p-2.5 space-y-2.5 overflow-y-auto transition-colors ${col.border} ${
          isOver ? "bg-brand-primary-light/40 ring-2 ring-inset ring-brand-primary/40" : "bg-gray-50/60"
        }`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              assigneeIds={metaFor(item.id).assigneeIds}
              onOpen={() => onOpen(item.id)}
              onMove={(c) => onMove(item.id, c)}
              onDelete={() => onDelete(item.id)}
            />
          ))}
        </SortableContext>

        {items.length === 0 && (
          <div className="flex items-center justify-center h-24 border-2 border-dashed border-border rounded-lg">
            <p className="text-xs text-muted">Drop tests here</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Board ─────────────────────── */

function initMeta(items: KanbanItem[]): Record<string, CardMeta> {
  const out: Record<string, CardMeta> = {};
  const now = Date.now();
  for (const it of items) {
    const createdById = deriveCreator(it.id);
    const createdAt = now - 86_400_000;
    out[it.id] = {
      assigneeIds: [],
      createdById,
      comments: [],
      updatedAt: createdAt,
      activity: [
        { id: uid("a"), kind: "created", message: `${memberById(createdById)?.name ?? "Someone"} created ${it.id}`, createdAt },
      ],
    };
  }
  return out;
}

export function KanbanView({ tests }: { tests: TestCase[] }) {
  const [items, setItems] = useState<KanbanItem[]>(toItems(tests));
  const [meta, setMeta] = useState<Record<string, CardMeta>>(() => initMeta(toItems(tests)));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<ColId | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const metaFor = useCallback(
    (id: string): CardMeta =>
      meta[id] ?? { assigneeIds: [], createdById: CURRENT_USER.id, comments: [], activity: [], updatedAt: Date.now() },
    [meta]
  );

  const pushActivity = useCallback((cardId: string, kind: ActivityKind, message: string) => {
    setMeta((prev) => {
      const m = prev[cardId];
      if (!m) return prev;
      const now = Date.now();
      return { ...prev, [cardId]: { ...m, updatedAt: now, activity: [{ id: uid("a"), kind, message, createdAt: now }, ...m.activity] } };
    });
  }, []);

  /* ── Assignment (multi) ── */
  const addAssignee = (cardId: string, memberId: string) => {
    setMeta((prev) => {
      const m = prev[cardId];
      if (!m || m.assigneeIds.includes(memberId)) return prev;
      return { ...prev, [cardId]: { ...m, assigneeIds: [...m.assigneeIds, memberId] } };
    });
    const who = memberById(memberId);
    pushActivity(cardId, "assigned", `${CURRENT_USER.name} assigned ${who?.name ?? "a member"}`);
  };
  const removeAssignee = (cardId: string, memberId: string) => {
    setMeta((prev) => {
      const m = prev[cardId];
      if (!m) return prev;
      return { ...prev, [cardId]: { ...m, assigneeIds: m.assigneeIds.filter((id) => id !== memberId) } };
    });
    const who = memberById(memberId);
    pushActivity(cardId, "unassigned", `${who?.name ?? "A member"} removed from test`);
  };

  /* ── Comments ── */
  const addComment = (cardId: string, body: string) => {
    const text = body.trim();
    if (!text) return;
    setMeta((prev) => {
      const m = prev[cardId];
      if (!m) return prev;
      const now = Date.now();
      const comment: Comment = { id: uid("c"), authorId: CURRENT_USER.id, own: true, body: text, createdAt: now };
      return {
        ...prev,
        [cardId]: {
          ...m, updatedAt: now,
          comments: [...m.comments, comment],
          activity: [{ id: uid("a"), kind: "comment", message: `${CURRENT_USER.name} added a comment`, createdAt: now }, ...m.activity],
        },
      };
    });
  };
  const editComment = (cardId: string, commentId: string, body: string) => {
    const text = body.trim();
    if (!text) return;
    setMeta((prev) => {
      const m = prev[cardId];
      if (!m) return prev;
      return { ...prev, [cardId]: { ...m, comments: m.comments.map((c) => (c.id === commentId ? { ...c, body: text, editedAt: Date.now() } : c)) } };
    });
  };
  const deleteComment = (cardId: string, commentId: string) => {
    setMeta((prev) => {
      const m = prev[cardId];
      if (!m) return prev;
      return { ...prev, [cardId]: { ...m, comments: m.comments.filter((c) => c.id !== commentId) } };
    });
  };

  /* ── Move / delete ── */
  const moveCard = (cardId: string, target: ColId) => {
    const it = items.find((i) => i.id === cardId);
    if (!it || it.colId === target) return;
    const fromLabel = COLUMNS.find((c) => c.id === it.colId)?.label ?? it.colId;
    const toLabel = COLUMNS.find((c) => c.id === target)?.label ?? target;
    setItems((prev) => prev.map((i) => (i.id === cardId ? { ...i, colId: target, status: COL_TO_STATUS[target] } : i)));
    pushActivity(cardId, "status", `${CURRENT_USER.name} moved card from ${fromLabel} → ${toLabel}`);
  };
  const deleteCard = (cardId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== cardId));
    setMeta((prev) => { const n = { ...prev }; delete n[cardId]; return n; });
    if (openId === cardId) setOpenId(null);
  };

  /* ── Filtering ── */
  const matchesFilters = useCallback(
    (it: KanbanItem): boolean => {
      const m = metaFor(it.id);
      if (filters.priorities.length && !filters.priorities.includes(it.priority)) return false;
      if (filters.types.length && !filters.types.includes(it.type)) return false;
      if (filters.statuses.length && !filters.statuses.includes(it.colId)) return false;
      if (filters.storyIds.length && !filters.storyIds.includes(it.storyId)) return false;
      if (filters.createdBy.length && !filters.createdBy.includes(m.createdById)) return false;

      if (filters.assignees.length) {
        const ok = filters.assignees.some((f) => {
          if (f === "unassigned") return m.assigneeIds.length === 0;
          if (f === "me") return m.assigneeIds.includes(CURRENT_USER.id);
          return m.assigneeIds.includes(f);
        });
        if (!ok) return false;
      }

      if (filters.updated) {
        const spanMs = filters.updated === "today" ? 86_400_000 : filters.updated === "week" ? 7 * 86_400_000 : 30 * 86_400_000;
        if (Date.now() - m.updatedAt > spanMs) return false;
      }
      return true;
    },
    [filters, metaFor]
  );

  const visibleItems = useMemo(() => items.filter(matchesFilters), [items, matchesFilters]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const byCol = useCallback((colId: ColId) => visibleItems.filter((i) => i.colId === colId), [visibleItems]);

  const activeItem = items.find((i) => i.id === activeId);
  const openItem = items.find((i) => i.id === openId) ?? null;
  const deleteItem = items.find((i) => i.id === deleteId) ?? null;

  /* ── Header summary (live) ── */
  const summary = useMemo(() => {
    const storyCount = new Set(items.map((i) => i.storyId)).size;
    const assigned = items.filter((i) => metaFor(i.id).assigneeIds.length > 0).length;
    return {
      total: items.length,
      storyCount,
      assigned,
      unassigned: items.length - assigned,
      members: teamMembers.length,
    };
  }, [items, metaFor]);

  /* ── DnD ── */
  const onDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) { setOverCol(null); return; }
    const a = items.find((i) => i.id === active.id);
    if (!a) return;
    const overItem = items.find((i) => i.id === over.id);
    const targetCol = (overItem?.colId ?? (over.data.current?.colId as ColId) ?? a.colId) as ColId;
    setOverCol(targetCol);
    if (a.colId !== targetCol) {
      const fromLabel = COLUMNS.find((c) => c.id === a.colId)?.label ?? a.colId;
      const toLabel = COLUMNS.find((c) => c.id === targetCol)?.label ?? targetCol;
      setItems((prev) => prev.map((i) => (i.id === a.id ? { ...i, colId: targetCol, status: COL_TO_STATUS[targetCol] } : i)));
      pushActivity(a.id, "status", `${CURRENT_USER.name} moved card from ${fromLabel} → ${toLabel}`);
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    setOverCol(null);
    if (!over || active.id === over.id) return;
    const a = items.find((i) => i.id === active.id);
    const o = items.find((i) => i.id === over.id);
    if (!a || !o || a.colId !== o.colId) return;
    setItems((prev) => {
      const colItems = prev.filter((i) => i.colId === a.colId);
      const others = prev.filter((i) => i.colId !== a.colId);
      const oldIdx = colItems.findIndex((i) => i.id === active.id);
      const newIdx = colItems.findIndex((i) => i.id === over.id);
      return [...others, ...arrayMove(colItems, oldIdx, newIdx)];
    });
  };

  return (
    <div>
      {/* Header summary */}
      <div className="pl-6 pb-3 flex items-center gap-5 flex-wrap">
        <p className="text-sm font-semibold text-navy">
          {summary.total} test cases across {summary.storyCount} {summary.storyCount === 1 ? "story" : "stories"}
        </p>
        <span className="text-border">|</span>
        <SummaryStat label="Assigned" value={summary.assigned} className="text-success" />
        <SummaryStat label="Unassigned" value={summary.unassigned} className="text-muted" />
        <SummaryStat label="Team Members" value={summary.members} className="text-navy" />
      </div>

      {/* Filter bar */}
      <FilterBar filters={filters} setFilters={setFilters} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="flex gap-4 items-start pl-6 pb-6"
          style={{ minWidth: "900px" }}
        >
          {COLUMNS.map((col) => (
            <motion.div key={col.id} variants={fadeInUp} className="flex flex-col flex-1 min-w-[260px]">
              <KanbanColumn
                col={col}
                items={byCol(col.id)}
                metaFor={metaFor}
                isOver={activeId !== null && overCol === col.id}
                onOpen={setOpenId}
                onMove={moveCard}
                onDelete={setDeleteId}
              />
            </motion.div>
          ))}
        </motion.div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
          {activeItem ? (
            <div className="w-[272px]">
              <KanbanCard item={activeItem} isDragging assigneeIds={metaFor(activeItem.id).assigneeIds} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Details drawer */}
      <CardDetailDrawer
        item={openItem}
        meta={openItem ? metaFor(openItem.id) : null}
        onClose={() => setOpenId(null)}
        onAddAssignee={(id) => openItem && addAssignee(openItem.id, id)}
        onRemoveAssignee={(id) => openItem && removeAssignee(openItem.id, id)}
        onAddComment={(b) => openItem && addComment(openItem.id, b)}
        onEditComment={(cid, b) => openItem && editComment(openItem.id, cid, b)}
        onDeleteComment={(cid) => openItem && deleteComment(openItem.id, cid)}
      />

      {/* Delete confirmation */}
      <DeleteModal
        item={deleteItem}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => { if (deleteItem) deleteCard(deleteItem.id); setDeleteId(null); }}
      />
    </div>
  );
}

function SummaryStat({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="text-muted">{label}:</span>
      <span className={`font-bold tabular-nums ${className ?? "text-navy"}`}>{value}</span>
    </span>
  );
}

/* ─────────────────────── Delete confirmation modal ─────────────────────── */

function DeleteModal({
  item, onCancel, onConfirm,
}: {
  item: KanbanItem | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {item && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[80] flex items-center justify-center bg-navy/20 px-4"
          onMouseDown={onCancel}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm bg-white border border-border rounded-card shadow-card overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-error">Delete Test Case</h2>
              <button type="button" onClick={onCancel} className="text-muted hover:text-navy transition-colors" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="p-5">
              <div className="p-3 rounded-card bg-[#FEF2F2] border border-[#FCA5A5] mb-4">
                <p className="text-sm font-medium text-[#991B1B] mb-0.5">This action cannot be undone.</p>
                <p className="text-xs text-[#991B1B]/80">
                  This will permanently delete <strong>{item.id}</strong> — {item.title}.
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onCancel} className="h-9 px-4 rounded-btn border border-border text-sm font-medium text-muted hover:text-navy hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
                <button type="button" onClick={onConfirm} className="h-9 px-4 rounded-btn bg-[#EF4444] text-white text-sm font-medium hover:bg-[#DC2626] transition-colors inline-flex items-center gap-2">
                  <Trash2 size={15} /> Delete
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────── Drawer ─────────────────────── */

function StatusChip({ status }: { status: TestStatus }) {
  const col = COLUMNS.find((c) => c.id === STATUS_TO_COL[status]);
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ${col?.countBg ?? "bg-gray-100"} ${col?.countText ?? "text-muted"}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: col?.dot }} />
      {col?.label ?? status}
    </span>
  );
}

function CardDetailDrawer({
  item, meta, onClose, onAddAssignee, onRemoveAssignee, onAddComment, onEditComment, onDeleteComment,
}: {
  item: KanbanItem | null;
  meta: CardMeta | null;
  onClose: () => void;
  onAddAssignee: (id: string) => void;
  onRemoveAssignee: (id: string) => void;
  onAddComment: (body: string) => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
}) {
  const open = item !== null && meta !== null;

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && item && meta && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-navy/20" onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="fixed top-0 right-0 bottom-0 z-[71] w-[460px] max-w-[calc(100vw-2rem)] bg-white border-l border-border shadow-card flex flex-col"
          >
            {/* Header */}
            <div className="flex-shrink-0 border-b border-border px-5 py-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-[12px] font-semibold text-cyan">{item.id}</span>
                  <StatusChip status={item.status} />
                </div>
                <button type="button" onClick={onClose} className="text-muted hover:text-navy transition-colors flex-shrink-0" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
              <h2 className="text-[16px] font-semibold text-navy leading-snug mb-2.5">{item.title}</h2>
              <div className="flex items-center gap-1.5">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[item.priority]}`}>{item.priority}</span>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor[item.type]}`}>{item.type}</span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
              <AssigneesSection meta={meta} onAdd={onAddAssignee} onRemove={onRemoveAssignee} onClose={onClose} />
              <CommentsSection meta={meta} onAdd={onAddComment} onEdit={onEditComment} onDelete={onDeleteComment} />
              <ActivitySection meta={meta} />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

/* ─── Assignees (multi) ─── */
function AssigneesSection({
  meta, onAdd, onRemove, onClose,
}: {
  meta: CardMeta;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useClickOutside<HTMLDivElement>(() => { setPicking(false); setQuery(""); });
  const hasMembers = teamMembers.length > 0;

  const assigned = meta.assigneeIds.map((id) => memberById(id)).filter((m): m is TeamMember => Boolean(m));
  const filtered = teamMembers.filter(
    (m) => m.name.toLowerCase().includes(query.toLowerCase()) || m.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide">Assignees</h3>
        {hasMembers && (
          <div ref={ref} className="relative">
            <button
              type="button"
              onClick={() => setPicking((v) => !v)}
              className="text-xs font-medium text-pink hover:underline inline-flex items-center gap-1"
            >
              <UserPlus size={12} /> Add Member
            </button>
            <AnimatePresence>
              {picking && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: 0.98 }}
                  transition={{ duration: 0.12 }}
                  className="absolute right-0 top-7 z-30 w-64 bg-white border border-border rounded-card shadow-card overflow-hidden"
                >
                  <div className="p-2 border-b border-border">
                    <div className="flex items-center gap-2 h-8 px-2 rounded-btn border border-border">
                      <Search size={13} className="text-muted flex-shrink-0" />
                      <input
                        autoFocus value={query} onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search team members…"
                        className="flex-1 text-sm text-navy placeholder:text-muted focus:outline-none bg-transparent"
                      />
                    </div>
                  </div>
                  <div className="max-h-56 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-3 text-xs text-muted text-center">No members found.</p>
                    ) : (
                      filtered.map((m) => {
                        const on = meta.assigneeIds.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => (on ? onRemove(m.id) : onAdd(m.id))}
                            className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 transition-colors text-left"
                          >
                            <Avatar member={m} size={26} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-navy truncate">{m.name}</p>
                              <p className="text-[11px] text-muted truncate">{m.role}</p>
                            </div>
                            {on && <Check size={15} className="text-pink flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {!hasMembers ? (
        <div className="flex flex-col items-center justify-center py-6 px-4 text-center border border-dashed border-border rounded-card">
          <div className="w-10 h-10 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-2.5">
            <Users size={18} />
          </div>
          <p className="text-sm font-semibold text-navy mb-0.5">No team members available.</p>
          <p className="text-xs text-muted mb-3">Only invited team members can be assigned.</p>
          <Link href="/settings/team" onClick={onClose} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors">
            Invite Team Members <ArrowRight size={14} />
          </Link>
        </div>
      ) : assigned.length === 0 ? (
        <p className="text-sm text-muted">No assignees yet. Use <span className="font-medium text-navy">Add Member</span> to assign.</p>
      ) : (
        <div className="space-y-2">
          {assigned.map((m) => (
            <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-card border border-border">
              <Avatar member={m} size={32} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-navy truncate">{m.name}</p>
                <p className="text-[11px] text-muted truncate">{m.role}</p>
              </div>
              <button
                type="button" onClick={() => onRemove(m.id)} title="Remove"
                className="text-muted hover:text-error transition-colors flex-shrink-0"
              >
                <X size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-muted mt-3">Only invited team members can be assigned.</p>
    </section>
  );
}

/* ─── Comments ─── */
function CommentsSection({
  meta, onAdd, onEdit, onDelete,
}: {
  meta: CardMeta;
  onAdd: (body: string) => void;
  onEdit: (commentId: string, body: string) => void;
  onDelete: (commentId: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submit = () => { if (!draft.trim()) return; onAdd(draft); setDraft(""); };
  const startEdit = (c: Comment) => { setEditingId(c.id); setEditDraft(c.body); };
  const saveEdit = () => { if (editingId) onEdit(editingId, editDraft); setEditingId(null); setEditDraft(""); };

  return (
    <section>
      <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <MessageSquare size={12} /> Comments ({meta.comments.length})
      </h3>

      <div className="space-y-3 mb-3">
        {meta.comments.length === 0 && <p className="text-sm text-muted">No comments yet.</p>}
        {meta.comments.map((c) => {
          const author = memberById(c.authorId);
          const isEditing = editingId === c.id;
          return (
            <div key={c.id} className="flex gap-2.5">
              {author && <Avatar member={author} size={28} />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-navy">{author?.name ?? "Unknown"}</span>
                  <span className="text-[11px] text-muted">{relativeTime(c.createdAt)}{c.editedAt ? " · edited" : ""}</span>
                </div>
                {isEditing ? (
                  <div className="mt-1.5">
                    <textarea
                      value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-btn border border-border text-sm text-navy focus:outline-none focus:border-pink transition-colors resize-y"
                    />
                    <div className="flex gap-2 mt-1.5">
                      <button type="button" onClick={saveEdit} className="h-7 px-3 text-xs font-medium bg-pink text-white rounded-btn hover:bg-[#e0005f] transition-colors">Save</button>
                      <button type="button" onClick={() => setEditingId(null)} className="h-7 px-3 text-xs font-medium text-muted hover:text-navy transition-colors">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-navy mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                    {c.own && (
                      <div className="flex items-center gap-3 mt-1">
                        <button type="button" onClick={() => startEdit(c)} className="text-[11px] font-medium text-muted hover:text-navy transition-colors inline-flex items-center gap-1">
                          <Pencil size={11} /> Edit
                        </button>
                        <button type="button" onClick={() => onDelete(c.id)} className="text-[11px] font-medium text-muted hover:text-error transition-colors inline-flex items-center gap-1">
                          <Trash2 size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2.5">
        <Avatar member={CURRENT_USER} size={28} />
        <div className="flex-1">
          <textarea
            value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            rows={2} placeholder="Add a comment..."
            className="w-full px-3 py-2 rounded-btn border border-border text-sm text-navy placeholder:text-muted focus:outline-none focus:border-pink transition-colors resize-y"
          />
          <p className="text-[11px] text-muted mt-1">Enter to submit · Shift+Enter for a new line</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Activity timeline ─── */
const ACTIVITY_ICON: Record<ActivityKind, typeof Clock> = {
  created: CheckCircle2,
  assigned: UserPlus,
  unassigned: X,
  status: ChevronRight,
  comment: MessageSquare,
  priority: AlertTriangle,
};

function ActivitySection({ meta }: { meta: CardMeta }) {
  return (
    <section>
      <h3 className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-3 flex items-center gap-1.5">
        <Clock size={12} /> Activity
      </h3>
      <ul className="space-y-3">
        {meta.activity.map((a) => {
          const Icon = ACTIVITY_ICON[a.kind];
          return (
            <li key={a.id} className="flex gap-2.5">
              <span className="w-6 h-6 rounded-full bg-gray-100 text-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                <Icon size={13} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-navy leading-snug">{a.message}</p>
                <p className="text-[11px] text-muted mt-0.5">{relativeTime(a.createdAt)}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
