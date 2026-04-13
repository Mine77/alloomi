/**
 * Onboarding step configuration
 * This is the single maintenance point for onboarding content, add/modify steps only by modifying this file
 */

export type OnboardingGroup = "required" | "recommended" | "explore";

/** Configuration structure for a single step */
export interface OnboardingStepConfig {
  /** Globally unique step ID */
  id: string;
  /** Belonging group */
  group: OnboardingGroup;
  /** i18n key for step title */
  titleKey: string;
  /** i18n key for step description */
  descKey: string;
  /** RemixIcon icon name */
  icon: string;
  /**
   * List of sidebar navigation item keys to unlock after completing this step
   * key corresponds to navItemKey in AppSidebar
   */
  unlocksNavItems: string[];
}

/** Group metadata configuration */
export interface OnboardingGroupConfig {
  id: OnboardingGroup;
  /** i18n key for group title */
  titleKey: string;
  /** RemixIcon icon name */
  icon: string;
  /** Tailwind color class (badge prefix color) */
  colorClass: string;
  /** badge background color class */
  bgClass: string;
}

/** Group metadata list (in display order) */
export const ONBOARDING_GROUPS: OnboardingGroupConfig[] = [
  {
    id: "required",
    titleKey: "onboarding.hub.groups.required",
    icon: "sparkling_2",
    colorClass: "text-destructive",
    bgClass: "bg-destructive/10",
  },
  {
    id: "recommended",
    titleKey: "onboarding.hub.groups.recommended",
    icon: "thumb_up",
    colorClass: "text-accent-brand",
    bgClass: "bg-accent-subtle",
  },
  {
    id: "explore",
    titleKey: "onboarding.hub.groups.explore",
    icon: "compass_3",
    colorClass: "text-muted-foreground",
    bgClass: "bg-muted",
  },
];

/** All step configurations (in display order) */
export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // ── Get Started ─────────────────────────────────────────────────────────────
  {
    id: "setup-profile",
    group: "required",
    titleKey: "onboarding.hub.steps.setupProfile.title",
    descKey: "onboarding.hub.steps.setupProfile.desc",
    icon: "user_settings",
    unlocksNavItems: [],
  },
  {
    id: "configure-alloomi-personality",
    group: "required",
    titleKey: "onboarding.hub.steps.configureAlloomiPersonality.title",
    descKey: "onboarding.hub.steps.configureAlloomiPersonality.desc",
    icon: "magic",
    unlocksNavItems: [],
  },
  {
    id: "create-first-event",
    group: "required",
    titleKey: "onboarding.hub.steps.createFirstEvent.title",
    descKey: "onboarding.hub.steps.createFirstEvent.desc",
    icon: "calendar",
    unlocksNavItems: [],
  },

  // ── Experience Alloomi ────────────────────────────────────────────────────────────
  {
    id: "tracking-by-context",
    group: "recommended",
    titleKey: "onboarding.hub.steps.trackingByContext.title",
    descKey: "onboarding.hub.steps.trackingByContext.desc",
    icon: "folder_2",
    unlocksNavItems: [],
  },
  {
    id: "alloomi-first-task",
    group: "recommended",
    titleKey: "onboarding.hub.steps.alloomiFirstTask.title",
    descKey: "onboarding.hub.steps.alloomiFirstTask.desc",
    icon: "list_checks",
    unlocksNavItems: [],
  },
  {
    id: "let-alloomi-know-you-care",
    group: "recommended",
    titleKey: "onboarding.hub.steps.letAlloomiKnowYouCare.title",
    descKey: "onboarding.hub.steps.letAlloomiKnowYouCare.desc",
    icon: "heart",
    unlocksNavItems: [],
  },

  // ── Learn More ──────────────────────────────────────────────────────────────
  {
    id: "first-chat",
    group: "explore",
    titleKey: "onboarding.hub.steps.firstChat.title",
    descKey: "onboarding.hub.steps.firstChat.desc",
    icon: "chat_ai",
    unlocksNavItems: [],
  },
  {
    id: "explore-agents",
    group: "explore",
    titleKey: "onboarding.hub.steps.exploreAgents.title",
    descKey: "onboarding.hub.steps.exploreAgents.desc",
    icon: "robot_2",
    unlocksNavItems: ["scheduled-jobs"],
  },
  {
    id: "explore-library",
    group: "explore",
    titleKey: "onboarding.hub.steps.exploreLibrary.title",
    descKey: "onboarding.hub.steps.exploreLibrary.desc",
    icon: "book_open",
    unlocksNavItems: ["workspace"],
  },
];

/** Set of step IDs that must be completed to exit onboarding */
export const REQUIRED_STEP_IDS = new Set(
  ONBOARDING_STEPS.filter((s) => s.group === "required").map((s) => s.id),
);

/**
 * Nav item keys always visible during onboarding (no unlock required)
 * Corresponds to navItemKey in AppSidebar
 */
export const ALWAYS_UNLOCKED_NAV_KEYS = new Set(["focus"]);

/** Compute set of unlocked nav item keys based on completed steps */
export function computeUnlockedNavKeys(
  completedStepIds: string[],
): Set<string> {
  const unlocked = new Set<string>(ALWAYS_UNLOCKED_NAV_KEYS);
  for (const stepId of completedStepIds) {
    const step = ONBOARDING_STEPS.find((s) => s.id === stepId);
    if (step) {
      for (const key of step.unlocksNavItems) {
        unlocked.add(key);
      }
    }
  }
  return unlocked;
}
