import { randomBytes } from "node:crypto";

/**
 * OAuth State Management
 * Used to prevent CSRF attacks
 */

const STATE_KEY_PREFIX = "oauth_state_";
const STATE_EXPIRY = 10 * 60 * 1000; // 10 minutes

/**
 * Generate and store OAuth state
 */
export function generateState(provider: string): string {
  const state = `${provider}_${Date.now()}_${randomBytes(16).toString("hex")}`;
  const key = STATE_KEY_PREFIX + state;

  if (typeof window !== "undefined") {
    sessionStorage.setItem(key, Date.now().toString());
  }

  return state;
}

/**
 * Verify OAuth state
 */
export function verifyState(state: string): boolean {
  if (typeof window === "undefined") return false;

  const key = STATE_KEY_PREFIX + state;
  const stored = sessionStorage.getItem(key);

  if (!stored) {
    return false;
  }

  const timestamp = Number.parseInt(stored, 10);
  const now = Date.now();

  // Check if expired
  if (now - timestamp > STATE_EXPIRY) {
    sessionStorage.removeItem(key);
    return false;
  }

  // Delete after use
  sessionStorage.removeItem(key);

  return true;
}

/**
 * Clear expired states
 */
export function clearExpiredStates(): void {
  if (typeof window === "undefined") return;

  const now = Date.now();

  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);

    if (key?.startsWith(STATE_KEY_PREFIX)) {
      const stored = sessionStorage.getItem(key);

      if (stored) {
        const timestamp = Number.parseInt(stored, 10);

        if (now - timestamp > STATE_EXPIRY) {
          sessionStorage.removeItem(key);
        }
      }
    }
  }
}
