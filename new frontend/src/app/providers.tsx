"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AIActionProvider } from "@/contexts/AIActionContext";
import { FullscreenProvider } from "@/contexts/FullscreenContext";
import { ProductTourProvider } from "@/contexts/ProductTourContext";
import { RBACProvider } from "@/contexts/RBACContext";
import { AppShell } from "@/components/layout/AppShell";
import { TourProvider } from "@/contexts/TourContext";

/**
 * Tour wiring. The single 14-step tour is the ProductTourModal, backed by
 * ProductTourProvider. Its first-time auto-launch is owned by AppShell (which
 * calls startTour() once the onboarding survey closes, if !hasSeenTour()), and
 * the manual "Product Tour" button in the sidebar opens the same tour — so
 * first-run and manual replay are one consistent 14-step experience.
 *
 * TourProvider (the older 10-step overlay system) is kept mounted only so any
 * code still calling useTour() keeps working, but it never auto-starts
 * (onboardingCompleted forced to true) and its TourOverlay is no longer
 * rendered — the 14-step ProductTourModal is the only tour users see.
 */
function TourStarter({ children }: { children: ReactNode }) {
  return (
    <TourProvider onboardingCompleted={true}>
      <ProductTourProvider>
        {children}
      </ProductTourProvider>
    </TourProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AIActionProvider>
          <FullscreenProvider>
            <RBACProvider>
              <TourStarter>
                <AppShell>{children}</AppShell>
              </TourStarter>
            </RBACProvider>
          </FullscreenProvider>
        </AIActionProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
