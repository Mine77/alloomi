import { useCallback, useEffect, useRef, useState } from "react";

export interface UsePullToRefreshOptions {
  /** Threshold distance to trigger refresh */
  threshold?: number;
  /** Maximum pull distance */
  maxDistance?: number;
  /** Refresh callback function */
  onRefresh: () => Promise<void> | void;
  /** Whether pull-to-refresh is enabled */
  enabled?: boolean;
}

export interface UsePullToRefreshReturn {
  /** Current pull distance */
  pullDistance: number;
  /** Whether refresh is in progress */
  isRefreshing: boolean;
  /** Whether refresh can be triggered (threshold reached) */
  canRefresh: boolean;
  /** Trigger element ref */
  triggerRef: React.RefObject<HTMLDivElement | null>;
  /** Callback function to set ref */
  setupRefCallback: (node: HTMLElement | null) => void;
}

/**
 * Pull-to-refresh Hook
 * Supports touch and mouse operations, used to implement mobile-friendly pull-to-refresh functionality
 */
export function usePullToRefresh({
  threshold = 60,
  maxDistance = 120,
  onRefresh,
  enabled = true,
}: UsePullToRefreshOptions): UsePullToRefreshReturn {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // At runtime the ref may be null before mount; using optional chaining / type assertions ensures type correctness.
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const isPullingRef = useRef(false);

  // Calculate if refresh threshold is reached
  const canRefresh = pullDistance >= threshold;

  const reset = useCallback(() => {
    setPullDistance(0);
    startYRef.current = null;
    isPullingRef.current = false;
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    reset();
    try {
      await onRefresh();
    } catch (error) {
      console.error("[usePullToRefresh] Refresh error:", error);
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefresh, reset]);

  const handleStart = useCallback(
    (clientY: number) => {
      if (!enabled || isRefreshing) return;

      // ScrollArea's viewport is under data-radix-scroll-area-viewport attribute
      const container = containerRef.current?.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement;
      if (!container) return;

      // Only pull down when at top
      const { scrollTop } = container;
      if (scrollTop > 0) return;

      startYRef.current = clientY;
      isPullingRef.current = true;
    },
    [enabled, isRefreshing],
  );

  const handleMove = useCallback(
    (clientY: number) => {
      if (!isPullingRef.current || startYRef.current === null || isRefreshing) {
        return;
      }

      const deltaY = clientY - startYRef.current;

      // Only respond to downward drag
      if (deltaY <= 0) return;

      // Limit maximum pull distance
      const easedDelta = Math.min(deltaY, maxDistance);
      // Apply easing effect to make pulling feel more natural
      const pullDistance = easedDelta * 0.6;

      setPullDistance(pullDistance);
    },
    [isRefreshing, maxDistance],
  );

  const handleEnd = useCallback(() => {
    if (!isPullingRef.current) return;

    if (canRefresh) {
      handleRefresh();
    } else {
      reset();
    }
  }, [canRefresh, handleRefresh, reset]);

  // Touch event handling
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // ScrollArea's viewport is under the data-radix-scroll-area-viewport attribute
    const container = root.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;

    const handleTouchStart = (e: TouchEvent) => {
      handleStart(e.touches[0].clientY);
    };

    const handleTouchMove = (e: TouchEvent) => {
      handleMove(e.touches[0].clientY);
      // Prevent page scrolling
      if (pullDistance > 0) {
        e.preventDefault();
      }
    };

    const handleTouchEnd = () => {
      handleEnd();
    };

    if (container) {
      container.addEventListener("touchstart", handleTouchStart, {
        passive: true,
      });
      container.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      container.addEventListener("touchend", handleTouchEnd);
      container.addEventListener("touchcancel", handleEnd);
    }

    return () => {
      if (container) {
        container.removeEventListener("touchstart", handleTouchStart);
        container.removeEventListener("touchmove", handleTouchMove);
        container.removeEventListener("touchend", handleTouchEnd);
        container.removeEventListener("touchcancel", handleEnd);
      }
    };
  }, [handleStart, handleMove, handleEnd, pullDistance]);

  // Mouse event handling (for desktop debugging)
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    // ScrollArea's viewport is under the data-radix-scroll-area-viewport attribute
    const container = root.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;

    const handleMouseDown = (e: MouseEvent) => {
      handleStart(e.clientY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      handleMove(e.clientY);
    };

    const handleMouseUp = () => {
      handleEnd();
    };

    if (container) {
      container.addEventListener("mousedown", handleMouseDown);
    }
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      if (container) {
        container.removeEventListener("mousedown", handleMouseDown);
      }
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [handleStart, handleMove, handleEnd]);

  // Set ref callback function
  const setupRefCallback = useCallback((node: HTMLElement | null) => {
    containerRef.current = node;
  }, []);

  return {
    pullDistance,
    isRefreshing,
    canRefresh,
    triggerRef,
    setupRefCallback,
  };
}
