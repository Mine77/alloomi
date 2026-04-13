"use client";

import { createContext, useContext } from "react";

/** View state within onboarding dialog */
export type OnboardingView = "welcome" | "hub";

/** Onboarding Context value type */
export interface OnboardingContextValue {
  /** Whether user is still in onboarding flow (finishOnboarding === false) */
  isOnboarding: boolean;
  /** Whether user has seen welcome page (localStorage: alloomi_onboarding_seen_welcome) */
  hasSeenWelcome: boolean;
  /** List of completed step IDs (localStorage: alloomi_onboarding_steps) */
  completedSteps: string[];
  /** Set of currently unlocked sidebar nav item keys (computed from completedSteps) */
  unlockedNavKeys: Set<string>;
  /** Whether onboarding can be finished (all required steps must be completed) */
  canFinish: boolean;
  /** Current dialog view: welcome or Hub */
  currentView: OnboardingView;
  /** Whether dialog is open */
  isOpen: boolean;
  /** Mark a step as completed */
  completeStep: (id: string) => void;
  /** Complete entire onboarding flow (calls API to persist, closes dialog) */
  finishOnboarding: () => Promise<void>;
  /** Open onboarding dialog (triggered from sidebar button) */
  openOnboarding: () => void;
  /** Close onboarding dialog */
  closeOnboarding: () => void;
  /** Switch dialog internal view */
  setCurrentView: (view: OnboardingView) => void;
}

/** Default value (fallback when Provider is not mounted) */
const defaultValue: OnboardingContextValue = {
  isOnboarding: false,
  hasSeenWelcome: false,
  completedSteps: [],
  unlockedNavKeys: new Set(["focus"]),
  canFinish: false,
  currentView: "welcome",
  isOpen: false,
  completeStep: () => {},
  finishOnboarding: async () => {},
  openOnboarding: () => {},
  closeOnboarding: () => {},
  setCurrentView: () => {},
};

export const OnboardingContext =
  createContext<OnboardingContextValue>(defaultValue);

/**
 * Get onboarding context
 * Can be used in any child component without prop drilling
 */
export function useOnboarding(): OnboardingContextValue {
  return useContext(OnboardingContext);
}
