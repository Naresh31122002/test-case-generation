"use client";

import { type ReactNode } from "react";
import dynamic from "next/dynamic";
import { Sidebar } from "@/components/Sidebar";
import { useFullscreen } from "@/contexts/FullscreenContext";

// Global overlays — not needed for first paint, loaded after hydration.
const Copilot = dynamic(
  () => import("@/components/copilot/Copilot").then((m) => m.Copilot),
  { ssr: false }
);
const CommandPalette = dynamic(
  () => import("@/components/CommandPalette").then((m) => m.CommandPalette),
  { ssr: false }
);

/**
 * App chrome wrapper. Hides the main sidebar in Full Screen Reading Mode so the
 * page content can expand to the full viewport width. Also hosts the global
 * overlays (Copilot, Command Palette), lazy-loaded off the critical path.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const { fullscreen } = useFullscreen();

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-bg-primary">
        {!fullscreen && <Sidebar />}
        <main className="flex-1 overflow-y-auto relative">{children}</main>
      </div>
      <Copilot />
      <CommandPalette />
    </>
  );
}
