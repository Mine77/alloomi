"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
} from "react";

/**
 * Async logic that can be registered before "Complete" in step dialog (e.g., save)
 * This callback is executed first when clicking complete, then dialog closes
 */
export type BeforeCompleteFn = (() => Promise<void>) | null;

type StepDialogContextValue = {
  /** Register/unregister before-complete callback (e.g., save in SetupProfile step) */
  registerBeforeComplete: (fn: BeforeCompleteFn) => void;
  /** Called by dialog header complete button */
  runBeforeComplete: () => Promise<void>;
};

const StepDialogContext = createContext<StepDialogContextValue | null>(null);

export function OnboardingStepDialogProvider({
  children,
}: {
  children: ReactNode;
}) {
  const beforeCompleteRef = useRef<BeforeCompleteFn>(null);

  const registerBeforeComplete = useCallback((fn: BeforeCompleteFn) => {
    beforeCompleteRef.current = fn;
  }, []);

  const runBeforeComplete = useCallback(async () => {
    await (beforeCompleteRef.current?.() ?? Promise.resolve());
  }, []);

  return (
    <StepDialogContext.Provider
      value={{ registerBeforeComplete, runBeforeComplete }}
    >
      {children}
    </StepDialogContext.Provider>
  );
}

export function useStepDialogBeforeComplete(): StepDialogContextValue | null {
  return useContext(StepDialogContext);
}
