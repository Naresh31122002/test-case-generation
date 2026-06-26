"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { useAuth } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AIActionProvider } from "@/contexts/AIActionContext";
import { FullscreenProvider } from "@/contexts/FullscreenContext";
import { ProductTourProvider } from "@/contexts/ProductTourContext";
import { RBACProvider } from "@/contexts/RBACContext";
import { AppShell } from "@/components/layout/AppShell";
import { TourProvider } from "@/contexts/TourContext";
import { TourOverlay } from "@/components/onboarding/TourOverlay";

/**
 * Inner component so that useAuth() can be called after AuthProvider mounts.
 * Passes the user's onboardingCompleted flag to TourProvider so the tour
 * auto-starts only for brand-new users who haven't completed onboarding.
 */
function TourStarter({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return (
    <TourProvider onboardingCompleted={user?.onboardingCompleted}>
      {children}
      <TourOverlay />
    </TourProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AIActionProvider>
          <FullscreenProvider>
            <ProductTourProvider>
              <RBACProvider>
                <TourStarter>
                  <AppShell>{children}</AppShell>
                </TourStarter>
              </RBACProvider>
            </ProductTourProvider>
          </FullscreenProvider>
        </AIActionProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
