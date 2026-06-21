"use client";

/**
 * Global stories store with background polling and event-based invalidation.
 *
 * Usage:
 *   const { stories, loading, refresh } = useStoriesStore(projectId)
 *   invalidateStories()  // call from anywhere after mutations
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import type { Story } from "@/lib/seed";

// ── Global invalidation event ─────────────────────────────────────────────────
// Any component can call invalidateStories() and all subscribers will re-fetch.

const INVALIDATE_EVENT = "testsurge:stories:invalidate";

export function invalidateStories() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INVALIDATE_EVENT));
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStoriesStore(projectId?: string) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await api.getStories(1, 200, undefined, undefined, projectId);
      if (!mountedRef.current) return;
      setStories(res.data.map(domainStoryToSeed));
    } catch {
      // keep stale data on error
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId]);

  // Initial fetch + re-fetch when projectId changes
  useEffect(() => {
    mountedRef.current = true;
    fetch(false);
    return () => { mountedRef.current = false; };
  }, [fetch]);

  // Background polling — fires every 8s when any story is still generating
  // (testCount === 0). Stops automatically when all stories are settled.
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    const hasGenerating = stories.some((s) => s.testCount === 0);
    if (!hasGenerating) return;

    pollingRef.current = setInterval(() => {
      fetch(true); // silent — no loading spinner
    }, 8000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [stories, fetch]);

  // Listen for global invalidation events (after mutations from other components)
  useEffect(() => {
    const handler = () => fetch(true);
    window.addEventListener(INVALIDATE_EVENT, handler);
    return () => window.removeEventListener(INVALIDATE_EVENT, handler);
  }, [fetch]);

  const refresh = useCallback(() => fetch(true), [fetch]);

  return { stories, loading, refresh };
}
