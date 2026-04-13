/**
 * Events Panel type definitions
 */

export type ViewOptionValue = "all" | string; // Extended to support tab ID (focus removed, only timeline scenario retained)
export type QuickFilterValue = string;

export const isViewOptionValue = (value: unknown): value is ViewOptionValue => {
  // Backward compatibility: if value is "other", also consider valid (will convert to "all" when used)
  return value === "all" || value === "other" || typeof value === "string";
};
