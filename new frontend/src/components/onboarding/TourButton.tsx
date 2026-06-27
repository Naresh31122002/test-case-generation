"use client";
import { Play } from "lucide-react";
import { useProductTour } from "@/contexts/ProductTourContext";

export function TourButton({ collapsed = false }: { collapsed?: boolean }) {
  const { startTour } = useProductTour();
  return (
    <button
      onClick={startTour}
      title="Replay product tour"
      className="w-full flex items-center gap-2 px-2 h-9 rounded-lg text-muted hover:text-navy hover:bg-gray-100 transition-colors text-left"
    >
      <span className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0">
        <Play size={14} />
      </span>
      {!collapsed && (
        <span className="text-sm font-medium truncate">Product Tour</span>
      )}
    </button>
  );
}
