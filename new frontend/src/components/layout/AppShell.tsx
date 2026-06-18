"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { useFullscreen } from "@/contexts/FullscreenContext";
import { VerifyEmailBanner } from "@/components/auth/VerifyEmailBanner";

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
];

function isBareRoute(pathname: string): boolean {
  return BARE_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/**
 * App chrome wrapper. Auth + onboarding routes render full-bleed with no chrome.
 * App routes get the sidebar, global overlays, and the email-verification banner.
 * Hides the sidebar in Full Screen Reading Mode.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { fullscreen } = useFullscreen();
  const pathname = usePathname();

  // Auth / onboarding: render the page alone.
  if (isBareRoute(pathname)) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        {!fullscreen && <Sidebar />}
        <main className="flex-1 overflow-y-auto relative">
          {!fullscreen && <VerifyEmailBanner />}
          {children}
        </main>
      </div>
      <Copilot />
      <CommandPalette />
    </>
  );
}
