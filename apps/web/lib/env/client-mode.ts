/**
 * Client-safe deployment mode detection
 *
 * For client-side components only, use @/lib/env/constants for server-side
 */

const DEPLOYMENT_MODE =
  typeof process !== "undefined" &&
  (process.env.TAURI_MODE === "tauri" || process.env.IS_TAURI === "true")
    ? "tauri"
    : "server";

export function isTauriMode(): boolean {
  return DEPLOYMENT_MODE === "tauri";
}

export function isServerMode(): boolean {
  return DEPLOYMENT_MODE === "server";
}
