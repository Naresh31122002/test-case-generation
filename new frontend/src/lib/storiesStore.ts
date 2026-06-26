"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import { domainStoryToSeed } from "@/lib/adapters";
import type { Story } from "@/lib/seed";

const INVALIDATE_EVENT = "testsurge:stories:invalidate";
const GENERATING_EVENT = "testsurge:stories:generating";

export function invalidateStories() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(INVALIDATE_EVENT));
  }
}

/**
 * Module-level registry of stories that are mid-generation. Lives outside React
 * so it survives route changes — navigating away from /stories/[id] no longer
 * loses the "this story is still generating" fact. The story page writes into
 * it; useStoryGenerating() reads from it reactively via a window event.
 */
const generatingStories = new Set<string>();

export function setStoryGenerating(storyId: string, generating: boolean) {
  const had = generatingStories.has(storyId);
  if (generating) generatingStories.add(storyId);
  else generatingStories.delete(storyId);
  if (had !== generating && typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(GENERATING_EVENT, { detail: { storyId } }));
  }
}

export function isStoryGenerating(storyId: string): boolean {
  return generatingStories.has(storyId);
}

/** Reactive hook: re-renders when the given story's generating flag changes. */
export function useStoryGenerating(storyId: string): boolean {
  const [generating, setGenerating] = useState(() => generatingStories.has(storyId));
  useEffect(() => {
    setGenerating(generatingStories.has(storyId));
    const handler = () => setGenerating(generatingStories.has(storyId));
    window.addEventListener(GENERATING_EVENT, handler);
    return () => window.removeEventListener(GENERATING_EVENT, handler);
  }, [storyId]);
  return generating;
}

/** Server-side story filters (Sprint 1 Phase 3). */
export interface StoryFilters {
  status?: string[];
  priority?: string[];
  impact?: 'detected' | 'none';
  assignee?: string;
  search?: string;
}

// Module-level cache of the last-fetched story list per (projectId, filters)
// combination. Lets a revisited page (e.g. navigating Stories -> Settings ->
// Stories) paint the previous result instantly instead of showing a blocking
// spinner while an identical request round-trips again. The cache entry is
// still revalidated in the background on every mount, so it never goes stale
// for more than one render.
const storiesCache = new Map<string, Story[]>();

export function useStoriesStore(projectId?: string, enabled = true, filters?: StoryFilters) {
  // Serialize filters so the fetch callback re-creates only on real changes.
  const filtersKey = JSON.stringify(filters ?? {});
  const cacheKey = `${projectId ?? ""}::${filtersKey}`;

  const [stories, setStories] = useState<Story[]>(() => storiesCache.get(cacheKey) ?? []);
  const [loading, setLoading] = useState(enabled && !storiesCache.has(cacheKey));
  const [error, setError] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const fetch = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const parsed: StoryFilters = JSON.parse(filtersKey);
      const hasFilters = Object.keys(parsed).length > 0;
      const res = await api.getStories(
        1, 200, undefined, undefined, projectId, 'desc',
        hasFilters ? parsed : undefined,
      );
      if (!mountedRef.current) return;
      const mapped = res.data.map(domainStoryToSeed);
      storiesCache.set(cacheKey, mapped);
      setStories(mapped);
    } catch {
      if (!silent) setError(true);
      // keep stale data on error
    } finally {
      if (!silent) setLoading(false);
    }
  }, [projectId, filtersKey, cacheKey]);

  // Only fetch when enabled (i.e. project context is ready). When a cached
  // entry already exists for this key, revalidate silently so the cached
  // list is shown immediately with no loading flash.
  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      fetch(storiesCache.has(cacheKey));
    } else {
      setLoading(false);
    }
    return () => { mountedRef.current = false; };
  }, [fetch, enabled, cacheKey]);

  // Background polling — only while at least one story is actively generating.
  // Caps at 15 poll cycles (~2 minutes) to prevent infinite loops for stories
  // that fail silently without updating their status.
  const pollCountRef = useRef(0);
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (!enabled) return;

    const hasGenerating = stories.some(
      (s) => s.status === "Analyzing" || (s.testCount === 0 && s.status !== "Draft")
    );
    if (!hasGenerating) {
      pollCountRef.current = 0;
      return;
    }

    pollingRef.current = setInterval(() => {
      pollCountRef.current++;
      if (pollCountRef.current > 15) {
        if (pollingRef.current) clearInterval(pollingRef.current);
        pollCountRef.current = 0;
        return;
      }
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

  return { stories, loading, error, refresh };
}
