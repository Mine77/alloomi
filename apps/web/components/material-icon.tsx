"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Material Icon component props
 */
interface MaterialIconProps {
  /** Material icon name */
  name: string;
  /** Whether selected (FILL is 1 when selected) */
  filled?: boolean;
  /** Custom className */
  className?: string;
  /** Icon size class name, defaults to size-5 */
  size?: string;
}

/**
 * Calculate corresponding pixel and opsz values based on Tailwind size class name
 * Tailwind size class mapping:
 * - size-3 = 12px (0.75rem) -> opsz 12
 * - size-4 = 16px (1rem) -> opsz 16
 * - size-5 = 20px (1.25rem) -> opsz 20
 * - size-6 = 24px (1.5rem) -> opsz 24
 * - size-7 = 28px (1.75rem) -> opsz 28
 * - size-8 = 32px (2rem) -> opsz 32
 *
 * @param size - Tailwind size class name, e.g. "size-4"
 * @returns Object containing fontSize and opsz
 */
function getSizeFromClass(size: string): { fontSize: number; opsz: number } {
  // Extract number from size string (e.g. "size-4" -> 4)
  const match = size.match(/\d+/);
  if (!match) {
    // If no number matched, return size-5 values by default
    return { fontSize: 20, opsz: 20 };
  }
  const sizeNumber = Number.parseInt(match[0], 10);
  // Calculate corresponding pixel value based on size number
  const pixelMap: Record<number, number> = {
    3: 12,
    4: 16,
    5: 20,
    6: 24,
    7: 28,
    8: 32,
  };
  const fontSize = pixelMap[sizeNumber] ?? sizeNumber * 4; // If no mapping, use size * 4 as default
  return { fontSize, opsz: fontSize };
}

/**
 * Check if Material Symbols font has loaded
 * Uses Font Loading API to detect font loading status, avoiding icons displaying as text
 */
function useMaterialSymbolsLoaded(): boolean {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) {
      // If browser does not support Font Loading API, assume font is already loaded
      setIsLoaded(true);
      return;
    }

    const testFont = "16px 'Material Symbols Rounded'";

    // Immediately check if font is already loaded
    if (document.fonts.check(testFont)) {
      setIsLoaded(true);
      return;
    }

    // Wait for font to finish loading
    const loadFont = async () => {
      try {
        // Wait for all fonts to finish loading
        await document.fonts.ready;

        // Check again if font is available
        if (document.fonts.check(testFont)) {
          setIsLoaded(true);
        } else {
          // If still not loaded after ready, may be a font file issue
          // Set a short timeout as fallback to avoid permanently hiding icons
          setTimeout(() => setIsLoaded(true), 200);
        }
      } catch (error) {
        // If loading failed, still show icons (font may have loaded via other means)
        console.warn("[MaterialIcon] Font loading check failed:", error);
        setIsLoaded(true);
      }
    };

    loadFont();
  }, []);

  return isLoaded;
}

/**
 * Unified Material Icon component
 * Uses Material Symbols Rounded font, supports selected state
 * Hides text before font is loaded, avoiding display as plain text
 *
 * @param props - Component props
 * @returns Material Icon component
 */
export function MaterialIcon({
  name,
  filled = false,
  className,
  size = "size-5",
}: MaterialIconProps) {
  const { fontSize, opsz } = getSizeFromClass(size);
  const isFontLoaded = useMaterialSymbolsLoaded();

  return (
    <span
      className={cn("material-symbols-rounded shrink-0", size, className)}
      style={{
        fontSize: `${fontSize}px`,
        fontVariationSettings: filled
          ? `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' ${opsz}`
          : `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${opsz}`,
        // Before font is loaded, use opacity to hide text, avoiding display as plain text
        // Use opacity instead of visibility to support smooth transitions
        opacity: isFontLoaded ? 1 : 0,
        // Add transition effect for smoother display after font loads
        transition: "opacity 0.15s ease-in",
      }}
      aria-hidden="true"
    >
      {name}
    </span>
  );
}
