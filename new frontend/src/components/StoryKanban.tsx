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
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import Link from "next/link";
import { TestTube2, Zap, ExternalLink } from "lucide-react";
import { type Story } from "@/lib/seed";
import { CoverageRing } from "@/components/ui/CoverageRing";
import { StatusChip } from "@/components/ui/StatusChip";
import { api } from "@/lib/api";

type KanbanStatus = "in_review" | "in_progress" | "completed";

const COLUMNS: { id: KanbanStatus; label: string; color: string; dot: string }[] = [
  { id: "in_review",   label: "In Review",  color: "border-blue-200 bg-blue-50/40",   dot: "bg-blue-400" },
  { id: "in_progress", label: "In Progress", color: "border-yellow-200 bg-yellow-50/40", dot: "bg-yellow-400" },
  { id: "completed",   label: "Completed",  color: "border-green-200 bg-green-50/40", dot: "bg-green-500" },
];

interface StoryKanbanProps {
  stories: Story[];
  onStatusChange?: (storyId: string, newStatus: KanbanStatus) => void;
}

function StoryCard({ story, dragging = false }: { story: Story & { _kanban?: KanbanStatus }; dragging?: boolean }) {
  return (
    <div
      className={`bg-white border rounded-card p-3.5 shadow-sm transition-shadow ${
        dragging ? "shadow-lg opacity-90 rotate-1" : "hover:shadow-md"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
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
    </div>
  );
}

function SortableStoryCard({ story }: { story: Story & { _kanban: KanbanStatus } }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: story.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <StoryCard story={story} />
    </div>
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
    const dragged = items.find((s) => s.id === draggedId);
    if (!dragged || dragged._kanban === targetStatus) return;

    // Optimistic update
    setItems((prev) =>
      prev.map((s) => (s.id === draggedId ? { ...s, _kanban: targetStatus! } : s))
    );

    // Persist to backend
    try {
      await api.updateStoryStatus(draggedId, targetStatus);
      onStatusChange?.(draggedId, targetStatus);
    } catch {
      // Rollback on failure
      setItems((prev) =>
        prev.map((s) => (s.id === draggedId ? { ...s, _kanban: dragged._kanban } : s))
      );
    }
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
                      <SortableStoryCard key={story.id} story={story} />
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
    </DndContext>
  );
}
