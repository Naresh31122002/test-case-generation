"use client";

import { useState, useCallback } from "react";
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
import { GripVertical, ExternalLink } from "lucide-react";
import { type TestCase, type TestStatus, stories } from "@/lib/seed";
import { staggerContainer, fadeInUp } from "@/lib/motion";

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

/* ─── Draggable card ─── */
function KanbanCard({
  item,
  isDragging = false,
}: {
  item: KanbanItem;
  isDragging?: boolean;
}) {
  const story = stories.find((s) => s.id === item.storyId);

  return (
    <div
      className={`bg-white border rounded-card p-3.5 select-none transition-shadow ${
        isDragging
          ? "shadow-[0_8px_24px_rgba(0,0,0,0.12)] rotate-[1.5deg] border-pink"
          : "border-border hover:shadow-card hover:border-cyan"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityColor[item.priority]}`}>
            {item.priority}
          </span>
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeColor[item.type]}`}>
            {item.type}
          </span>
        </div>
        <Link
          href={`/stories/${item.storyId}`}
          onClick={(e) => e.stopPropagation()}
          className="text-muted hover:text-pink transition-colors flex-shrink-0"
          title={`Open ${item.storyId}`}
        >
          <ExternalLink size={12} />
        </Link>
      </div>

      {/* Title */}
      <p className="text-[13px] font-semibold text-navy leading-snug mb-2">
        {item.title}
      </p>

      {/* Footer: story ID */}
      <p className="text-[11px] text-muted">
        {story?.id} · {story?.title.slice(0, 24)}{(story?.title.length ?? 0) > 24 ? "…" : ""}
      </p>
    </div>
  );
}

/* ─── Sortable wrapper ─── */
function SortableCard({ item }: { item: KanbanItem }) {
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
      <KanbanCard item={item} isDragging={false} />
    </div>
  );
}

/* ─── Drop column ─── */
function KanbanColumn({
  col,
  items,
}: {
  col: Col;
  items: KanbanItem[];
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
            <SortableCard key={item.id} item={item} />
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
            <KanbanColumn col={col} items={byCol(col.id)} />
          </motion.div>
        ))}
      </motion.div>

      {/* Floating drag overlay */}
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2,0,0,1)" }}>
        {activeItem ? (
          <div className="w-[272px]">
            <KanbanCard item={activeItem} isDragging />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
