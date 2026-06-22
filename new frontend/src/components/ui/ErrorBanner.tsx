"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

/**
 * Reusable error banner for data-load failures.
 * Usage:
 *   if (fetchError) return <ErrorBanner onRetry={load} />;
 *   // or inline:
 *   {fetchError && <ErrorBanner message="Custom message" onRetry={load} compact />}
 */
export function ErrorBanner({
  message = "Could not load data.",
  detail,
  onRetry,
  compact = false,
}: {
  message?: string;
  detail?: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 text-sm text-error py-2">
        <AlertCircle size={15} className="flex-shrink-0" />
        <span>{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-1 flex items-center gap-1 text-xs underline hover:no-underline text-error"
          >
            <RefreshCw size={11} /> Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
      <div className="w-12 h-12 rounded-full bg-[#FEF2F2] flex items-center justify-center">
        <AlertCircle size={22} className="text-error" />
      </div>
      <div>
        <p className="text-sm font-semibold text-navy">{message}</p>
        {detail && <p className="text-xs text-muted mt-1">{detail}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="h-9 px-4 text-sm font-medium border border-border rounded-btn text-navy bg-white hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={14} /> Try Again
        </button>
      )}
    </div>
  );
}
