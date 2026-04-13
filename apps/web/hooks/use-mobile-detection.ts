import { useState, useEffect } from "react";

/**
 * Hook to detect if the app is running on a mobile device
 * Handles both window resize and orientation change events
 */
export function useMobileDetection() {
  const [isMobile, setIsMobile] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const updateIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    updateIsMobile();
    window.addEventListener("resize", updateIsMobile);
    window.addEventListener("orientationchange", updateIsMobile);

    return () => {
      window.removeEventListener("resize", updateIsMobile);
      window.removeEventListener("orientationchange", updateIsMobile);
    };
  }, []);

  // During SSR and before client mount, always return false to avoid hydration mismatch
  // After mount, return the actual detection result
  return mounted ? isMobile : false;
}
