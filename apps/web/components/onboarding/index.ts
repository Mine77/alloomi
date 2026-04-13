/**
 * Onboarding module unified exports
 * New system: Hub-style grouped guidance, supports step-level dialogs and sidebar progressive unlocking
 */

// Context & Provider (external entry point)
export { OnboardingProvider } from "./onboarding-provider";
export { useOnboarding, OnboardingContext } from "./onboarding-context";
export type {
  OnboardingContextValue,
  OnboardingView,
} from "./onboarding-context";

// Config (step definitions, for external reference)
export {
  ONBOARDING_STEPS,
  ONBOARDING_GROUPS,
  REQUIRED_STEP_IDS,
  ALWAYS_UNLOCKED_NAV_KEYS,
  computeUnlockedNavKeys,
} from "./onboarding-config";
export type {
  OnboardingGroup,
  OnboardingStepConfig,
  OnboardingGroupConfig,
} from "./onboarding-config";

// UI Components
export { OnboardingPage } from "./onboarding-page";
export { OnboardingWelcome } from "./onboarding-welcome";
export { OnboardingHub } from "./onboarding-hub";
export { OnboardingStepCard } from "./onboarding-step-card";
export { OnboardingStepDialog } from "./onboarding-step-dialog";
