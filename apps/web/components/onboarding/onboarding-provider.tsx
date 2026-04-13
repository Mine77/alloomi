"use client";

import {
  useEffect,
  useState,
  useCallback,
  Suspense,
  useMemo,
  useRef,
} from "react";
import { useSession } from "next-auth/react";
import { usePathname, useSearchParams } from "next/navigation";
import { isTauri } from "@/lib/tauri";
import { OnboardingContext, type OnboardingView } from "./onboarding-context";
import { REQUIRED_STEP_IDS, computeUnlockedNavKeys } from "./onboarding-config";
import { useSidePanel } from "@/components/agent/side-panel-context";

/** localStorage storage keys */
const LS_KEY_SEEN_WELCOME = "alloomi_onboarding_seen_welcome";
const LS_KEY_COMPLETED_STEPS = "alloomi_onboarding_steps";

/**
 * Safely read completed steps list from localStorage
 */
function loadCompletedSteps(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY_COMPLETED_STEPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Safely read whether user has seen welcome page from localStorage
 */
function loadHasSeenWelcome(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_KEY_SEEN_WELCOME) === "true";
}

/**
 * Check forceOnboarding debug mode (URL param or localStorage)
 */
function useForceOnboardingDebug() {
  const searchParams = useSearchParams();
  const [force, setForce] = useState(false);

  useEffect(() => {
    const urlParam = searchParams.get("forceOnboarding");
    if (urlParam === "true") {
      setForce(true);
      localStorage.setItem("forceOnboarding", "true");
      return;
    }
    if (localStorage.getItem("forceOnboarding") === "true") {
      setForce(true);
      return;
    }
    setForce(false);
  }, [searchParams]);

  useEffect(() => {
    /** Keyboard shortcut: Cmd/Ctrl + Shift + O */
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if (
        (isMac ? e.metaKey : e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "o"
      ) {
        e.preventDefault();
        setForce((prev) => {
          const next = !prev;
          localStorage.setItem("forceOnboarding", String(next));
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return force;
}

/**
 * Get user onboarding completion status (with Tauri retry)
 */
async function fetchOnboardingStatus(): Promise<{ finishOnboarding: boolean }> {
  const attempt = async () => {
    const res = await fetch("/api/onboarding", { method: "GET" });
    if (!res.ok) return { finishOnboarding: true };
    return (await res.json()) as { finishOnboarding: boolean };
  };
  try {
    return await attempt();
  } catch {
    if (isTauri()) {
      await new Promise((r) => setTimeout(r, 800));
      try {
        return await attempt();
      } catch {
        /* ignore */
      }
    }
    return { finishOnboarding: true };
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Onboarding Provider inner implementation (needs Suspense wrapper due to useSearchParams)
 */
function OnboardingProviderInner({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const forceOnboarding = useForceOnboardingDebug();
  const { closeSidePanel } = useSidePanel();

  /** Whether user is still in onboarding flow */
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  /** Dialog toggle */
  const [isOpen, setIsOpen] = useState(false);

  /**
   * Whether current open was triggered by user clicking "onboarding" button (not auto-show).
   * When true, route changes will auto-close onboarding to let user navigate to the target page.
   */
  const [openedManually, setOpenedManually] = useState(false);
  const prevPathnameRef = useRef<string | undefined>(undefined);

  /** Dialog internal view */
  const [currentView, setCurrentView] = useState<OnboardingView>("welcome");

  /** Whether welcome page has been seen */
  const [hasSeenWelcome, setHasSeenWelcome] = useState(false);

  /** List of completed step IDs */
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  /**
   * Register debug helper method for quickly resetting onboarding state in dev
   * Only mounted to window in non-production to avoid affecting real users
   */
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    if (typeof window === "undefined") return;

    (
      window as typeof window & { alloomiDebugResetOnboarding?: () => void }
    ).alloomiDebugResetOnboarding = () => {
      localStorage.removeItem(LS_KEY_COMPLETED_STEPS);
      localStorage.removeItem(LS_KEY_SEEN_WELCOME);
      localStorage.removeItem("forceOnboarding");
      setCompletedSteps([]);
      setHasSeenWelcome(false);
      setIsOnboarding(true);
      setIsOpen(true);
      setCurrentView("welcome");
    };
  }, []);

  /** Initialize: restore state from localStorage */
  useEffect(() => {
    setCompletedSteps(loadCompletedSteps());
    setHasSeenWelcome(loadHasSeenWelcome());
  }, []);

  /** Check if onboarding needs to be shown automatically */
  useEffect(() => {
    const check = async () => {
      if (status === "loading") return;

      if (forceOnboarding) {
        setIsOnboarding(true);
        setIsOpen(true);
        setOpenedManually(false); // Debug force-open counts as auto-show
        setCurrentView(loadHasSeenWelcome() ? "hub" : "welcome");
        setIsChecking(false);
        return;
      }

      if (!session?.user) {
        setIsOnboarding(false);
        setIsChecking(false);
        return;
      }

      const { finishOnboarding } = await fetchOnboardingStatus();
      const shouldShow = !finishOnboarding;
      setIsOnboarding(shouldShow);
      if (shouldShow) {
        setIsOpen(true);
        setOpenedManually(false); // Auto-show: first entry for incomplete onboarding
        setCurrentView(loadHasSeenWelcome() ? "hub" : "welcome");
      }
      setIsChecking(false);
    };

    void check();
  }, [session, status, forceOnboarding]);

  /** Listen for sidebar "onboarding" button open event (treated as manual open, closes on route change) */
  useEffect(() => {
    const handleOpen = () => {
      setOpenedManually(true);
      setIsOpen(true);
      setCurrentView(loadHasSeenWelcome() ? "hub" : "welcome");
    };
    window.addEventListener("alloomi:open-onboarding", handleOpen);
    return () =>
      window.removeEventListener("alloomi:open-onboarding", handleOpen);
  }, []);

  /** When manually opened: auto-close on route change to let user navigate */
  useEffect(() => {
    if (!isOpen || !openedManually) {
      prevPathnameRef.current = pathname;
      return;
    }
    if (
      prevPathnameRef.current !== undefined &&
      prevPathnameRef.current !== pathname
    ) {
      setOpenedManually(false);
      setIsOpen(false);
      closeSidePanel();
    }
    prevPathnameRef.current = pathname;
  }, [pathname, isOpen, openedManually, closeSidePanel]);

  /** Mark step as completed and persist to localStorage */
  const completeStep = useCallback((id: string) => {
    setCompletedSteps((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(LS_KEY_COMPLETED_STEPS, JSON.stringify(next));
      return next;
    });
  }, []);

  /** Complete entire onboarding flow */
  const finishOnboarding = useCallback(async () => {
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finishOnboarding: true }),
      });
      if (!res.ok) throw new Error("Failed to finish onboarding");
      setOpenedManually(false);
      closeSidePanel();
      setIsOnboarding(false);
      setIsOpen(false);
    } catch (err) {
      console.error("[Onboarding] finishOnboarding failed:", err);
      throw err;
    }
  }, [closeSidePanel]);

  /** Open dialog (sidebar button, treated as manual open, closes on route change) */
  const openOnboarding = useCallback(() => {
    setOpenedManually(true);
    setIsOpen(true);
    setCurrentView(loadHasSeenWelcome() ? "hub" : "welcome");
  }, []);

  /** Close dialog */
  const closeOnboarding = useCallback(() => {
    setOpenedManually(false);
    closeSidePanel();
    setIsOpen(false);
  }, [closeSidePanel]);

  /** Switch view and handle hasSeenWelcome side effect */
  const handleSetCurrentView = useCallback((view: OnboardingView) => {
    if (view === "hub" && !loadHasSeenWelcome()) {
      localStorage.setItem(LS_KEY_SEEN_WELCOME, "true");
      setHasSeenWelcome(true);
    }
    setCurrentView(view);
  }, []);

  /** Compute unlocked nav items (useMemo to avoid recalculation on every render) */
  const unlockedNavKeys = useMemo(
    () => computeUnlockedNavKeys(completedSteps),
    [completedSteps],
  );

  /** Whether onboarding can be finished (all required steps completed) */
  const canFinish = useMemo(
    () => [...REQUIRED_STEP_IDS].every((id) => completedSteps.includes(id)),
    [completedSteps],
  );

  if (isChecking) return <>{children}</>;

  return (
    <OnboardingContext.Provider
      value={{
        isOnboarding,
        hasSeenWelcome,
        completedSteps,
        unlockedNavKeys,
        canFinish,
        currentView,
        isOpen,
        completeStep,
        finishOnboarding,
        openOnboarding,
        closeOnboarding,
        setCurrentView: handleSetCurrentView,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

/**
 * Onboarding Provider
 * Wraps entire app, provides onboarding state and UI
 */
export function OnboardingProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={children}>
      <OnboardingProviderInner>{children}</OnboardingProviderInner>
    </Suspense>
  );
}
