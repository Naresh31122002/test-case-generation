"use client";

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Story } from '@/types/domain';

export function useStoryPolling(
  storyId: string,
  initialTestCount: number,
  initialImpactCount: number,
  onUpdate: (story: Story) => void
): { isPolling: boolean; statusLabel: string } {
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [statusLabel, setStatusLabel] = useState<string>('');

  const testCountRef = useRef<number>(initialTestCount);
  const impactCountRef = useRef<number>(initialImpactCount);
  const startTimeRef = useRef<number>(Date.now());
  const testsAppearedAtRef = useRef<number | null>(
    initialTestCount > 0 ? Date.now() : null
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    testCountRef.current = initialTestCount;
    impactCountRef.current = initialImpactCount;
    if (initialTestCount > 0 && testsAppearedAtRef.current === null) {
      testsAppearedAtRef.current = Date.now();
    }
  }, [initialTestCount, initialImpactCount]);

  useEffect(() => {
    const forceStart =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('analyzing') === 'true';

    function shouldPoll(testCount: number, impactCount: number): boolean {
      const elapsed = Date.now() - startTimeRef.current;
      if (elapsed >= 120_000) return false;
      if (forceStart) return elapsed < 120_000;
      if (testCount === 0) return true;
      if (impactCount === 0) {
        const testsAt = testsAppearedAtRef.current;
        if (testsAt === null) return true;
        return Date.now() - testsAt < 60_000;
      }
      return false;
    }

    function computeLabel(testCount: number, impactCount: number): string {
      if (testCount === 0) return 'Generating tests…';
      if (impactCount === 0) return 'Analyzing impact…';
      return '';
    }

    if (!shouldPoll(testCountRef.current, impactCountRef.current)) {
      setIsPolling(false);
      setStatusLabel('');
      return;
    }

    setIsPolling(true);
    setStatusLabel(computeLabel(testCountRef.current, impactCountRef.current));

    intervalRef.current = setInterval(async () => {
      if (!shouldPoll(testCountRef.current, impactCountRef.current)) {
        if (intervalRef.current !== null) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        setIsPolling(false);
        setStatusLabel('');
        return;
      }

      try {
        const story = await api.getStory(storyId);
        testCountRef.current = story.testCaseCount;
        impactCountRef.current = story.impactedTestCasesCount;

        if (story.testCaseCount > 0 && testsAppearedAtRef.current === null) {
          testsAppearedAtRef.current = Date.now();
        }

        onUpdate(story);
        setStatusLabel(computeLabel(story.testCaseCount, story.impactedTestCasesCount));

        if (!shouldPoll(story.testCaseCount, story.impactedTestCasesCount)) {
          if (intervalRef.current !== null) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          setIsPolling(false);
          setStatusLabel('');
        }
      } catch {
        // Silently ignore network errors — keep polling
      }
    }, 4000);

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [storyId]); // eslint-disable-line react-hooks/exhaustive-deps

  return { isPolling, statusLabel };
}
