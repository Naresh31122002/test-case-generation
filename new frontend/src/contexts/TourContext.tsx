"use client";
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const TOUR_DONE_KEY = "testsurge_tour_completed";
const TOUR_SEEN_KEY = "testsurge_tour_seen";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  target?: string; // CSS selector for the element to highlight
  placement?: "top" | "bottom" | "left" | "right";
  action?: string; // optional CTA label
}

const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    title: "Welcome to TestSurge 👋",
    description: "TestSurge turns your user stories and requirements into comprehensive AI-powered test cases. Let's take a quick tour — it takes about 60 seconds.",
    placement: "bottom",
  },
  {
    id: "stories",
    title: "Stories are your workspace",
    description: "Each story is a user requirement or feature spec. Upload a PDF, Word doc, or paste text directly. TestSurge understands the intent and generates tests automatically.",
    target: "[data-tour='nav-stories']",
    placement: "right",
  },
  {
    id: "new-story",
    title: "Create your first story",
    description: "Click this button to upload a requirements document. You can paste text, upload a file, or import from Jira. The AI handles the rest.",
    target: "[data-tour='create-first-story-btn'], [data-tour='new-story-btn']",
    placement: "bottom",
  },
  {
    id: "test-cases",
    title: "AI generates test cases",
    description: "Once uploaded, TestSurge generates Functional, Negative, Boundary, Security, and Performance test cases — typically 20–60 tests per story in under 60 seconds.",
    target: "[data-tour='nav-stories']",
    placement: "right",
  },
  {
    id: "coverage",
    title: "Track test coverage",
    description: "The Coverage tab shows what percentage of your story's requirements have test cases. Gaps highlight requirements that need more tests.",
    target: "[data-tour='nav-coverage']",
    placement: "right",
  },
  {
    id: "impact",
    title: "Detect cross-story impact",
    description: "When you update a story, TestSurge automatically detects which test cases in OTHER stories may be affected — preventing escaped defects.",
    target: "[data-tour='nav-changes']",
    placement: "right",
  },
  {
    id: "kanban",
    title: "Kanban board view",
    description: "Switch to the Kanban board to visualise your stories by status — drag cards between In Review, In Progress, and Completed columns to update them instantly.",
    target: "[data-tour='nav-kanban']",
    placement: "right",
  },
  {
    id: "export",
    title: "Export to your tools",
    description: "Export test cases to Excel (for TestRail, Zephyr, Jira), or generate Playwright/Cypress/PyTest automation scripts ready to run in CI.",
    target: "[data-tour='nav-exports']",
    placement: "right",
  },
  {
    id: "team",
    title: "Invite your team",
    description: "Add teammates with role-based access: Admins manage the workspace, Editors create and edit tests, Viewers can read and export.",
    target: "[data-tour='nav-settings']",
    placement: "right",
  },
  {
    id: "done",
    title: "You're ready! 🚀",
    description: "That's the full tour. Start by uploading your first user story. You can replay this tour anytime from the sidebar.",
    placement: "bottom",
  },
];

interface TourContextValue {
  isFirstTime: boolean;
  tourActive: boolean;
  currentStep: number;
  steps: TourStep[];
  startTour: () => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  completeTour: () => void;
}

const TourContext = createContext<TourContextValue>({
  isFirstTime: false,
  tourActive: false,
  currentStep: 0,
  steps: TOUR_STEPS,
  startTour: () => {},
  nextStep: () => {},
  prevStep: () => {},
  skipTour: () => {},
  completeTour: () => {},
});

export function TourProvider({ children, onboardingCompleted }: { children: React.ReactNode; onboardingCompleted?: boolean }) {
  const [isFirstTime] = useState(() => {
    if (typeof window === "undefined") return false;
    const done = localStorage.getItem(TOUR_DONE_KEY);
    // First time = onboarding not completed OR tour never seen
    return !done && onboardingCompleted === false;
  });
  const [tourActive, setTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  // Auto-start for first-time users after a short delay
  useEffect(() => {
    if (!isFirstTime) return;
    const seen = localStorage.getItem(TOUR_SEEN_KEY);
    if (seen) return;
    const t = setTimeout(() => {
      localStorage.setItem(TOUR_SEEN_KEY, "1");
      setTourActive(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [isFirstTime]);

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setTourActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(s => {
      if (s >= TOUR_STEPS.length - 1) return s;
      return s + 1;
    });
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(s => Math.max(0, s - 1));
  }, []);

  const completeTour = useCallback(() => {
    localStorage.setItem(TOUR_DONE_KEY, "1");
    setTourActive(false);
  }, []);

  const skipTour = useCallback(() => {
    localStorage.setItem(TOUR_DONE_KEY, "1");
    setTourActive(false);
  }, []);

  return (
    <TourContext.Provider value={{ isFirstTime, tourActive, currentStep, steps: TOUR_STEPS, startTour, nextStep, prevStep, skipTour, completeTour }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() { return useContext(TourContext); }
