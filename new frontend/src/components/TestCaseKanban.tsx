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
import { TestCaseDrawer } from "@/components/TestCaseDrawer";

// Columns represent test execution status, persisted to the backend (Phase 2).
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

function TestCaseCard({ tc, dragging = false, onOpen }: { tc: TcItem; dragging?: boolean; onOpen?: () => void }) {
  return (
    <div
      onClick={onOpen}
      className={`bg-white border rounded-xl p-3 shadow-sm transition-shadow ${
        dragging ? "shadow-lg opacity-90 rotate-1" : "hover:shadow-md cursor-pointer"
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

function SortableTcCard({ tc, onOpen }: { tc: TcItem; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tc.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TestCaseCard tc={tc} onOpen={onOpen} />
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
  const [openTcId, setOpenTcId] = useState<string | null>(null);
  // Sprint 1 Phase 3: server-side test-case filters.
  const [fPriority, setFPriority] = useState<string>("");
  const [fStatus, setFStatus] = useState<string>("");
  const [fAutomation, setFAutomation] = useState<string>(""); // '' | 'true' | 'false'
  const [fImpacted, setFImpacted] = useState<string>("");     // '' | 'true' | 'false'

  const selectedStory = stories.find((s) => s.id === selectedStoryId);

  // Load test cases whenever the selected story or filters change. Filters are
  // applied server-side (Phase 3); each card's column is initialised from the
  // persisted tc_status (Phase 2), defaulting to "todo".
  useEffect(() => {
    if (!selectedStoryId) return;
    setLoading(true);
    api.getTestCases(selectedStoryId, {
      ...(fPriority ? { priority: [fPriority] } : {}),
      ...(fStatus ? { status: [fStatus] } : {}),
      ...(fAutomation ? { automationReady: fAutomation === "true" } : {}),
      ...(fImpacted ? { impacted: fImpacted === "true" } : {}),
    })
      .then((res) => {
        setItems(res.testCases.map((tc) => ({ ...tc, _tcStatus: (tc.tcStatus ?? "todo") as TcStatus })));
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [selectedStoryId, fPriority, fStatus, fAutomation, fImpacted]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const tcById = useCallback((id: string) => items.find((t) => t.id === id), [items]);

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  // Persist a column change to the backend with an optimistic update + rollback.
  const persistStatus = useCallback((tcId: string, targetStatus: TcStatus, prevStatus: TcStatus) => {
    setItems((prev) => prev.map((t) => (t.id === tcId ? { ...t, _tcStatus: targetStatus } : t)));
    api.updateTestCaseStatus(selectedStoryId, tcId, targetStatus).catch(() => {
      // Roll back on failure so the board reflects the true persisted state.
      setItems((prev) => prev.map((t) => (t.id === tcId ? { ...t, _tcStatus: prevStatus } : t)));
    });
  }, [selectedStoryId]);

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

    persistStatus(draggedId, targetStatus, dragged._tcStatus);
  }

  const activeTc = activeId ? tcById(activeId) : null;
  const openTc = openTcId ? tcById(openTcId) : null;

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

      {/* Phase 3: server-side test-case filters. */}
      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={fPriority}
          onChange={(e) => setFPriority(e.target.value)}
          className="h-8 px-2.5 text-xs border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
        >
          <option value="">All Priority</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="h-8 px-2.5 text-xs border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
        >
          <option value="">All Status</option>
          <option value="Approved">Approved</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select
          value={fAutomation}
          onChange={(e) => setFAutomation(e.target.value)}
          className="h-8 px-2.5 text-xs border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
        >
          <option value="">Automation: Any</option>
          <option value="true">Automation Ready</option>
          <option value="false">Not Automation Ready</option>
        </select>
        <select
          value={fImpacted}
          onChange={(e) => setFImpacted(e.target.value)}
          className="h-8 px-2.5 text-xs border border-border rounded-btn bg-white text-navy focus:outline-none focus:border-cyan cursor-pointer"
        >
          <option value="">Impacted: Any</option>
          <option value="true">Impacted</option>
          <option value="false">Not Impacted</option>
        </select>
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
                        colItems.map((tc) => (
                          <SortableTcCard key={tc.id} tc={tc} onOpen={() => setOpenTcId(tc.id)} />
                        ))
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

      {/* Test Case detail drawer (Phase 1) */}
      {openTc && (
        <TestCaseDrawer
          storyId={selectedStoryId}
          testCase={openTc}
          tcStatus={openTc._tcStatus}
          onClose={() => setOpenTcId(null)}
          onStatusChange={(status) => persistStatus(openTc.id, status, openTc._tcStatus)}
        />
      )}
    </div>
  );
}
