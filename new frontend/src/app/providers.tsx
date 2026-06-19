"use client";

import { type ReactNode } from "react";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProjectProvider } from "@/contexts/ProjectContext";
import { AIActionProvider } from "@/contexts/AIActionContext";
import { FullscreenProvider } from "@/contexts/FullscreenContext";
import { ProductTourProvider } from "@/contexts/ProductTourContext";
import { AppShell } from "@/components/layout/AppShell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProjectProvider>
        <AIActionProvider>
          <FullscreenProvider>
            <ProductTourProvider>
              <AppShell>{children}</AppShell>
            </ProductTourProvider>
          </FullscreenProvider>
        </AIActionProvider>
      </ProjectProvider>
    </AuthProvider>
  );
}
