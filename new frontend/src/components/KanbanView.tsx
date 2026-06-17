"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  GripVertical,
  ExternalLink,
  Plus,
  Search,
  X,
  Check,
  Users,
  ArrowRight,
  MoreHorizontal,
  TestTube2,
  Download,
  Archive,
  UserPlus,
} from "lucide-react";
import { type TestCase, type TestStatus, stories } from "@/lib/seed";
import { teamMembers, memberById, type TeamMember } from "@/lib/team";
import { staggerContainer, fadeInUp } from "@/lib/motion";

/** Avatar bubble (initials). */
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

// Map seed status → kanban column
const STATUS_TO_COL: Record<TestStatus, ColId> = {
  Pending:      "review",
  Regenerating: "progress",
  Approved:     "completed",
};
const COL_TO_STATUS: Record<ColId, TestStatus> = {
  review:    "Pending",
  progress:  "Regenerating",
  completed: "Approved",
};

type ColId = "review" | "progress" | "completed";

interface Col {
  id: ColId;
  label: string;
  accent: string;        // tailwind text colour
  bg: string;            // column header bg
  border: string;        // column border colour
  dot: string;           // inline dot colour
  countBg: string;
  countText: string;
}

const COLUMNS: Col[] = [
  {
    id: "review",
    label: "In Review",
    accent:    "text-[#1E40AF]",
    bg:        "bg-[#EFF6FF]",
    border:    "border-[#93C5FD]",
    dot:       "#93C5FD",
    countBg:   "bg-[#DBEAFE]",
    countText: "text-[#1E40AF]",
  },
  {
    id: "progress",
    label: "In Progress",
    accent:    "text-[#92400E]",
    bg:        "bg-[#FFFBEB]",
    border:    "border-[#FCD34D]",
    dot:       "#F59E0B",
    countBg:   "bg-[#FEF3C7]",
    countText: "text-[#92400E]",
  },
  {
    id: "completed",
    label: "Completed",
    accent:    "text-[#065F46]",
    bg:        "bg-[#ECFDF5]",
    border:    "border-[#6EE7B7]",
    dot:       "#10B981",
    countBg:   "bg-[#D1FAE5]",
    countText: "text-[#065F46]",
  },
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

interface KanbanItem extends TestCase {
  colId: ColId;
}

function toItems(tests: TestCase[]): KanbanItem[] {
  return tests.map((t) => ({ ...t, colId: STATUS_TO_COL[t.status] }));
}

/* ─── Card hover actions: Open · Assign · More ─── */
function CardActions({
  item,
  onAssignClick,
  onArchive,
}: {
  item: KanbanItem;
  onAssignClick?: () => void;
  onArchive?: () => void;
}) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(() => setMenuOpen(false));

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  // Default actions are subtle; whole cluster brightens on card hover.
  const iconBtn =
    "w-6 h-6 rounded flex items-center justify-center text-muted hover:text-navy hover:bg-gray-100 transition-colors";

  const menuItems = [
    { label: "Open Story", icon: ExternalLink, onClick: () => router.push(`/stories/${item.storyId}`) },
    { label: "Assign Member", icon: UserPlus, onClick: () => onAssignClick?.() },
    { label: "View Tests", icon: TestTube2, onClick: () => router.push(`/stories/${item.storyId}/tests`) },
    { label: "Export", icon: Download, onClick: () => router.push(`/exports?story=${item.storyId}`) },
    { label: "Archive", icon: Archive, onClick: () => onArchive?.(), danger: true },
  ];

  return (
    <div
      ref={ref}
      className="flex items-center gap-0.5 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity"
      onPointerDown={stop}
    >
      {/* Open */}
      <button
        type="button"
        title="Open story"
        onClick={(e) => { stop(e); router.push(`/stories/${item.storyId}`); }}
        className={iconBtn}
      >
        <ExternalLink size={13} />
      </button>
      {/* Assign */}
      <button
        type="button"
        title="Assign member"
        onClick={(e) => { stop(e); onAssignClick?.(); }}
        className={iconBtn}
      >
        <UserPlus size={13} />
      </button>
      {/* More */}
      <div className="relative">
        <button
          type="button"
          title="More actions"
          onClick={(e) => { stop(e); setMenuOpen((v) => !v); }}
          className={`${iconBtn} ${menuOpen ? "text-navy bg-gray-100" : ""}`}
        >
          <MoreHorizontal size={14} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-8 z-30 w-44 bg-white border border-border rounded-card shadow-card py-1"
              onPointerDown={stop}
            >
              {menuItems.map((mi) => {
                const Icon = mi.icon;
                return (
                  <button
                    key={mi.label}
                    type="button"
                    onClick={(e) => { stop(e); setMenuOpen(false); mi.onClick(); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors ${
                      mi.danger
                        ? "text-error hover:bg-[#FEF2F2]"
                        : "text-navy hover:bg-gray-50"
                    }`}
                  >
                    <Icon size={14} className="flex-shrink-0" />
                    {mi.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ─── Draggable card ─── */
function KanbanCard({
  item,
  isDragging = false,
  assignees = [],
  onAssignClick,
  onArchive,
}: {
  item: KanbanItem;
  isDragging?: boolean;
  assignees?: string[];
  onAssignClick?: () => void;
  onArchive?: () => void;
}) {
  const story = stories.find((s) => s.id === item.storyId);
  const members = assignees
    .map((id) => memberById(id))
    .filter((m): m is TeamMember => Boolean(m));

  return (
    <div
      className={`group bg-white border rounded-card p-3.5 select-none transition-shadow ${
        isDragging
          ? "shadow-[0_8px_24px_rgba(0,0,0,0.12)] rotate-[1.5deg] border-pink"
          : "border-border hover:shadow-card hover:border-cyan"
      }`}
    >
      {/* Header row: priority/type (left) + hover actions (right) */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[item.priority]}`}>
            {item.priority}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor[item.type]}`}>
            {item.type}
          </span>
        </div>

        {!isDragging && (
          <CardActions item={item} onAssignClick={onAssignClick} onArchive={onArchive} />
        )}
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-navy leading-snug mb-2">
        {item.title}
      </p>

      {/* Footer: story ID + assignee stack */}
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted truncate">
          {story?.id} · {story?.title.slice(0, 22)}{(story?.title.length ?? 0) > 22 ? "…" : ""}
        </p>

        {/* Assignee avatar stack */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAssignClick?.(); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex items-center flex-shrink-0 hover:opacity-90 transition-opacity"
          title="Assign members"
        >
          {members.length > 0 ? (
            <span className="flex items-center -space-x-1.5">
              {members.slice(0, 3).map((m) => (
                <Avatar key={m.id} member={m} size={22} ring />
              ))}
              {members.length > 3 && (
                <span className="w-[22px] h-[22px] rounded-full bg-gray-200 text-muted text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                  +{members.length - 3}
                </span>
              )}
            </span>
          ) : (
            <span className="w-[22px] h-[22px] rounded-full border border-dashed border-border text-muted flex items-center justify-center hover:border-pink hover:text-pink transition-colors">
              <Plus size={12} />
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

/* ─── Sortable wrapper ─── */
function SortableCard({
  item,
  assignees,
  onAssignClick,
  onArchive,
}: {
  item: KanbanItem;
  assignees: string[];
  onAssignClick: () => void;
  onArchive: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { colId: item.colId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      {/* Drag handle — only visible on hover */}
      <div
        {...attributes}
        {...listeners}
        className="absolute -left-5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-muted hover:text-navy"
      >
        <GripVertical size={14} />
      </div>
      <KanbanCard
        item={item}
        isDragging={false}
        assignees={assignees}
        onAssignClick={onAssignClick}
        onArchive={onArchive}
      />
    </div>
  );
}

/* ─── Drop column ─── */
function KanbanColumn({
  col,
  items,
  assignments,
  onAssignClick,
  onArchive,
}: {
  col: Col;
  items: KanbanItem[];
  assignments: Record<string, string[]>;
  onAssignClick: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  return (
    <div className="flex flex-col min-w-[280px] flex-1">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-lg border-x border-t ${col.border} ${col.bg} mb-0`}>
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ backgroundColor: col.dot }}
          />
          <span className={`text-[13px] font-semibold ${col.accent}`}>{col.label}</span>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.countBg} ${col.countText}`}>
          {items.length}
        </span>
      </div>

      {/* Cards area */}
      <div
        className={`flex-1 min-h-[400px] rounded-b-lg border ${col.border} bg-gray-50/60 p-2.5 space-y-2.5 overflow-y-auto`}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((item) => (
            <SortableCard
              key={item.id}
              item={item}
              assignees={assignments[item.id] ?? []}
              onAssignClick={() => onAssignClick(item.id)}
              onArchive={() => onArchive(item.id)}
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

/* ─── Main kanban board ─── */
export function KanbanView({ tests }: { tests: TestCase[] }) {
  const [items, setItems] = useState<KanbanItem[]>(toItems(tests));
  const [activeId, setActiveId] = useState<string | null>(null);
  // cardId -> assigned member IDs (persisted in component state)
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [assigningId, setAssigningId] = useState<string | null>(null);

  const toggleAssignee = (cardId: string, memberId: string) => {
    setAssignments((prev) => {
      const current = prev[cardId] ?? [];
      const next = current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId];
      return { ...prev, [cardId]: next };
    });
  };

  // Archive removes the card from the board.
  const archiveCard = (cardId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== cardId));
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const byCol = useCallback(
    (colId: ColId) => items.filter((i) => i.colId === colId),
    [items]
  );

  const activeItem = items.find((i) => i.id === activeId);

  const onDragStart = ({ active }: DragStartEvent) => {
    setActiveId(active.id as string);
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const activeItem = items.find((i) => i.id === active.id);
    if (!activeItem) return;

    // Determine target column: either the column itself or the card's column
    const overItem = items.find((i) => i.id === over.id);
    const targetCol = (overItem?.colId ?? over.data.current?.colId ?? activeItem.colId) as ColId;

    if (activeItem.colId !== targetCol) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === activeItem.id ? { ...i, colId: targetCol, status: COL_TO_STATUS[targetCol] } : i
        )
      );
    }
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const activeItem = items.find((i) => i.id === active.id);
    const overItem = items.find((i) => i.id === over.id);
    if (!activeItem || !overItem || activeItem.colId !== overItem.colId) return;

    // Reorder within same column
    setItems((prev) => {
      const colItems = prev.filter((i) => i.colId === activeItem.colId);
      const others = prev.filter((i) => i.colId !== activeItem.colId);
      const oldIdx = colItems.findIndex((i) => i.id === active.id);
      const newIdx = colItems.findIndex((i) => i.id === over.id);
      return [...others, ...arrayMove(colItems, oldIdx, newIdx)];
    });
  };

  return (
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
              assignments={assignments}
              onAssignClick={setAssigningId}
              onArchive={archiveCard}
            />
          </motion.div>
        ))}
      </motion.div>

      {/* Floating drag overlay */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {activeItem ? (
          <div className="w-[272px]">
            <KanbanCard item={activeItem} isDragging assignees={assignments[activeItem.id] ?? []} />
          </div>
        ) : null}
      </DragOverlay>

      {/* Assignment modal */}
      <AssignModal
        cardId={assigningId}
        assigned={assigningId ? assignments[assigningId] ?? [] : []}
        onToggle={(memberId) => assigningId && toggleAssignee(assigningId, memberId)}
        onClose={() => setAssigningId(null)}
      />
    </DndContext>
  );
}

/* ─── Assignment modal ─── */
function AssignModal({
  cardId,
  assigned,
  onToggle,
  onClose,
}: {
  cardId: string | null;
  assigned: string[];
  onToggle: (memberId: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const open = cardId !== null;
  const hasMembers = teamMembers.length > 0;
  const filtered = teamMembers.filter(
    (m) =>
      m.name.toLowerCase().includes(query.toLowerCase()) ||
      m.email.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-navy/20 px-4"
          onMouseDown={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="w-full max-w-sm bg-white border border-border rounded-card shadow-card overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-navy">Assign members</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-muted hover:text-navy transition-colors"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            {hasMembers ? (
              <>
                {/* Search */}
                <div className="p-3 border-b border-border">
                  <div className="flex items-center gap-2 h-9 px-3 rounded-btn border border-border">
                    <Search size={14} className="text-muted flex-shrink-0" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search members…"
                      className="flex-1 text-sm text-navy placeholder:text-muted focus:outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Member list */}
                <div className="max-h-72 overflow-y-auto py-1">
                  {filtered.length === 0 ? (
                    <p className="px-4 py-4 text-sm text-muted text-center">No members found.</p>
                  ) : (
                    filtered.map((m) => {
                      const isAssigned = assigned.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors"
                        >
                          <Avatar member={m} size={28} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-navy truncate">{m.name}</p>
                            <p className="text-[11px] text-muted truncate">{m.email}</p>
                          </div>
                          {isAssigned ? (
                            <button
                              type="button"
                              onClick={() => onToggle(m.id)}
                              className="text-xs font-medium text-error hover:underline flex-shrink-0"
                            >
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onToggle(m.id)}
                              className="text-xs font-medium text-pink hover:underline flex items-center gap-1 flex-shrink-0"
                            >
                              <Plus size={12} /> Assign
                            </button>
                          )}
                          {isAssigned && (
                            <Check size={15} className="text-success flex-shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              /* Empty state — no team members */
              <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-pink text-pink flex items-center justify-center mb-3">
                  <Users size={22} />
                </div>
                <p className="text-sm font-semibold text-navy mb-0.5">No team members assigned</p>
                <p className="text-xs text-muted mb-4">Invite teammates to collaborate</p>
                <Link
                  href="/settings/team"
                  onClick={onClose}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-btn bg-pink text-white text-sm font-medium hover:bg-[#e0005f] transition-colors"
                >
                  Team Management
                  <ArrowRight size={14} />
                </Link>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
