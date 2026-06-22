"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import type { Story } from "@/lib/seed";

const INVALIDATE_EVENT = "testsurge:stories:invalidate";

export function invalidateStories() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INVALIDATE_EVENT));
  }
}

/** Server-side story filters (Sprint 1 Phase 3). */
export interface StoryFilters {
  status?: string[];
  priority?: string[];
  impact?: 'detected' | 'none';
  assignee?: string; // user_id | 'me' | 'unassigned'
}

export function useStoriesStore(projectId?: string, enabled = true, filters?: StoryFilters) {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(enabled); // start as loading only if enabled
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Serialize filters so the fetch callback re-creates only on real changes.
  const filtersKey = JSON.stringify(filters ?? {});

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const parsed: StoryFilters = JSON.parse(filtersKey);
      const hasFilters = Object.keys(parsed).length > 0;
      const res = await api.getStories(
        1, 200, undefined, undefined, projectId, 'desc',
        hasFilters ? parsed : undefined,
      );
      if (!mountedRef.current) return;
      setStories(res.data.map(domainStoryToSeed));
    } catch {
      // keep stale data on error
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, filtersKey]);

  // Only fetch when enabled (i.e. project context is ready)
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      fetch(false);
    } else {
      setLoading(false);
    }
    return () => { mountedRef.current = false; };
  }, [fetch, enabled]);

  // Background polling when any story is still generating
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (!enabled) return;

    const hasGenerating = stories.some((s) => s.testCount === 0);
    if (!hasGenerating) return;

    pollingRef.current = setInterval(() => {
      fetch(true);
    }, 8000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [stories, fetch, enabled]);

  // Listen for global invalidation events
  useEffect(() => {
    const handler = () => { if (enabled) fetch(true); };
    window.addEventListener(INVALIDATE_EVENT, handler);
    return () => window.removeEventListener(INVALIDATE_EVENT, handler);
  }, [fetch, enabled]);

  const refresh = useCallback(() => fetch(true), [fetch]);

  return { stories, loading, refresh };
}
