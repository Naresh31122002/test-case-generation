"use client";

import { useState, useEffect, useCallback } from "react";
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
import { ChevronDown, Loader2, TestTube2 } from "lucide-react";
import { type Story } from "@/lib/seed";
import { type TestCase as DomainTestCase } from "@/types/domain";
import { api } from "@/lib/api";

// Columns represent test execution status (local-only, no backend persist for now)
type TcStatus = "todo" | "in_progress" | "done";

type TcItem = DomainTestCase & { _tcStatus: TcStatus };

const COLUMNS: { id: TcStatus; label: string; color: string; dot: string }[] = [
  { id: "todo",        label: "To Do",       color: "border-slate-200 bg-slate-50/50",    dot: "bg-slate-400" },
  { id: "in_progress", label: "In Progress", color: "border-yellow-200 bg-yellow-50/40",  dot: "bg-yellow-400" },
  { id: "done",        label: "Done",        color: "border-green-200 bg-green-50/40",    dot: "bg-green-500" },
];

const PRIORITY_COLOR: Record<string, string> = {
  High:   "bg-red-100 text-red-700 border-red-200",
  Medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:    "bg-slate-100 text-slate-600 border-slate-200",
};

function TestCaseCard({ tc, dragging = false }: { tc: TcItem; dragging?: boolean }) {
  return (
    <div
      className={`bg-white border rounded-xl p-3 shadow-sm transition-shadow ${
        dragging ? "shadow-lg opacity-90 rotate-1" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${PRIORITY_COLOR[tc.priority] ?? PRIORITY_COLOR.P2}`}>
          {tc.priority}
        </span>
        <span className="text-[10px] text-muted font-mono truncate max-w-[80px]">{tc.id}</span>
      </div>
      <p className="text-sm font-semibold text-navy leading-tight line-clamp-2 mb-2">{tc.title}</p>
      <div className="flex items-center gap-1.5 text-[11px] text-muted">
        <TestTube2 size={11} />
        <span>{tc.steps.length} steps</span>
      </div>
    </div>
  );
}

function SortableTcCard({ tc }: { tc: TcItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tc.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TestCaseCard tc={tc} />
    </div>
  );
}

interface TestCaseKanbanProps {
  stories: Story[];
}

export function TestCaseKanban({ stories }: TestCaseKanbanProps) {
  const [selectedStoryId, setSelectedStoryId] = useState<string>(() => stories[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<TcItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const selectedStory = stories.find((s) => s.id === selectedStoryId);

  // Load test cases whenever selected story changes
  useEffect(() => {
    if (!selectedStoryId) return;
    setLoading(true);
    api.getTestCases(selectedStoryId)
      .then((res) => {
        // Default all test cases to "todo"
        setItems(res.testCases.map((tc) => ({ ...tc, _tcStatus: "todo" as TcStatus })));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedStoryId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const tcById = useCallback((id: string) => items.find((t) => t.id === id), [items]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const draggedId = String(active.id);
    const overId = String(over.id);

    let targetStatus: TcStatus | null = null;
    if (COLUMNS.find((c) => c.id === overId)) {
      targetStatus = overId as TcStatus;
    } else {
      const overTc = items.find((t) => t.id === overId);
      if (overTc) targetStatus = overTc._tcStatus;
    }

    if (!targetStatus) return;
    const dragged = items.find((t) => t.id === draggedId);
    if (!dragged || dragged._tcStatus === targetStatus) return;

    setItems((prev) =>
      prev.map((t) => (t.id === draggedId ? { ...t, _tcStatus: targetStatus! } : t))
    );
  }

  const activeTc = activeId ? tcById(activeId) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* Story selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-navy whitespace-nowrap">Story:</span>
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 h-9 px-3 pr-2 rounded-btn border border-border bg-white text-sm text-navy hover:border-cyan transition-colors min-w-[260px] max-w-[420px]"
          >
            <span className="truncate flex-1 text-left">
              {selectedStory
                ? <><span className="font-mono text-cyan text-xs mr-1.5">{selectedStory.id}</span>{selectedStory.title}</>
                : "Select a story…"}
            </span>
            <ChevronDown size={14} className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
          </button>

          {open && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-border rounded-xl shadow-lg min-w-[320px] max-w-[480px] max-h-72 overflow-y-auto py-1">
              {stories.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedStoryId(s.id); setOpen(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-gray-50 transition-colors ${
                    s.id === selectedStoryId ? "bg-cyan/5 text-cyan" : "text-navy"
                  }`}
                >
                  <span className="font-mono text-xs text-cyan shrink-0">{s.id}</span>
                  <span className="truncate">{s.title}</span>
                  <span className="ml-auto text-[11px] text-muted shrink-0">{s.testCount} tests</span>
                </button>
              ))}
              {stories.length === 0 && (
                <p className="text-sm text-muted px-3 py-4 text-center">No stories in this project</p>
              )}
            </div>
          )}
        </div>

        {loading && <Loader2 size={16} className="animate-spin text-muted" />}
        {!loading && items.length > 0 && (
          <span className="text-sm text-muted">{items.length} test cases</span>
        )}
      </div>

      {/* Kanban board */}
      {loading ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading test cases…
        </div>
      ) : items.length === 0 && selectedStoryId ? (
        <div className="h-48 flex items-center justify-center text-sm text-muted">
          No test cases found for this story.
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragEnd={onDragEnd}>
          <div className="flex gap-5 min-h-[60vh] pb-8">
            {COLUMNS.map((col) => {
              const colItems = items.filter((t) => t._tcStatus === col.id);
              return (
                <div
                  key={col.id}
                  id={col.id}
                  className={`flex-1 min-w-[260px] flex flex-col border rounded-xl p-3 ${col.color}`}
                >
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                      <span className="text-sm font-semibold text-navy">{col.label}</span>
                    </div>
                    <span className="text-[11px] font-bold text-muted bg-white border border-border rounded-full px-2 py-0.5">
                      {colItems.length}
                    </span>
                  </div>

                  <SortableContext
                    id={col.id}
                    items={colItems.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div id={col.id} className="flex-1 space-y-2.5 min-h-[120px]">
                      {colItems.length === 0 ? (
                        <div className="h-24 flex items-center justify-center border-2 border-dashed border-border/60 rounded-lg">
                          <p className="text-xs text-muted">Drop here</p>
                        </div>
                      ) : (
                        colItems.map((tc) => <SortableTcCard key={tc.id} tc={tc} />)
                      )}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
          </div>

          <DragOverlay>
            {activeTc ? (
              <div className="w-[260px]">
                <TestCaseCard tc={activeTc} dragging />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
