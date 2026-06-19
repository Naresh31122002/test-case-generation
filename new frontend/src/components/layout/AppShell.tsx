"use client";

import { type ReactNode, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { useAuth } from "@/contexts/AuthContext";
import { useProductTour, hasSeenTour } from "@/contexts/ProductTourContext";
import { OnboardingSurveyModal } from "@/components/onboarding/OnboardingSurveyModal";

// Global overlays — not needed for first paint, loaded after hydration.
const Copilot = dynamic(
  () => import("@/components/copilot/Copilot").then((m) => m.Copilot),
  { ssr: false }
);
const CommandPalette = dynamic(
  () => import("@/components/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

// Routes that render WITHOUT app chrome (no sidebar, copilot, or banner).
const BARE_PREFIXES = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
  "/admin",
];

function isBareRoute(pathname: string): boolean {
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * App chrome wrapper. Auth + onboarding routes render full-bleed with no chrome.
 * App routes get the sidebar and global overlays. A logged-in session always
 * implies a verified email (hard gate at signup), so there's no in-app banner.
 * Hides the sidebar in Full Screen Reading Mode.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { fullscreen } = useFullscreen();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { startTour } = useProductTour();
  const [dismissed, setDismissed] = useState(false);
  const [surveyDone, setSurveyDone] = useState(false);

  // First-login-only survey: shown once on the dashboard, never again once
  // onboarding_completed_at is set server-side (or the user skips/finishes it
  // this session — `dismissed` avoids a flicker while that write lands).
  const showOnboardingModal = !loading && !!user && !user.onboardingCompleted && !dismissed;

  // Auto-launch the product tour right after the survey closes (first login
  // only) — or immediately if the survey was already completed in a prior
  // session and the tour itself hasn't been seen yet.
  useEffect(() => {
    if (isBareRoute(pathname)) return;
    if (loading || !user) return;
    if (!user.onboardingCompleted && !surveyDone) return; // wait for survey to close
    if (!hasSeenTour()) startTour();
  }, [loading, user, surveyDone, pathname, startTour]);

  // Auth / onboarding: render the page alone.
  if (isBareRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        {!fullscreen && <Sidebar />}
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
      </div>
      {showOnboardingModal && (
        <OnboardingSurveyModal
          onDone={() => {
            setDismissed(true);
            setSurveyDone(true);
          }}
        />
      )}
      <Copilot />
      <CommandPalette />
    </>
  );
}
