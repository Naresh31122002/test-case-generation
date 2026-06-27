"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { ProductTourModal, hasSeenTour } from "@/components/onboarding/ProductTourModal";

interface ProductTourContextValue {
  /** Open the tour on demand (e.g. from the sidebar profile menu). */
  startTour: () => void;
}

const ProductTourContext = createContext<ProductTourContextValue | null>(null);

export function ProductTourProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const startTour = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  // Note: first-time auto-launch of this 14-step tour is owned by AppShell
  // (it waits for the onboarding survey to close, then calls startTour() if
  // !hasSeenTour()). We deliberately do NOT auto-open here too, to avoid the
  // tour firing twice for a brand-new user.

  return (
    <ProductTourContext.Provider value={{ startTour }}>
      {children}
      {open && <ProductTourModal onDone={close} />}
    </ProductTourContext.Provider>
  );
}

export function useProductTour(): ProductTourContextValue {
  const ctx = useContext(ProductTourContext);
  if (!ctx) throw new Error("useProductTour must be used within a ProductTourProvider");
  return ctx;
}

export { hasSeenTour };
