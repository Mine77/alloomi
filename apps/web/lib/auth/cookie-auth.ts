/**
 * Shared cookie-setting utility for authentication.
 * Used by all token-generation endpoints (login, register, refresh, OAuth).
 */

import { randomBytes } from "node:crypto";
import type { NextResponse, NextRequest } from "next/server";
import {
  AUTH_TOKEN_COOKIE,
  AUTH_TOKEN_CLIENT_COOKIE,
  AUTH_PAYLOAD_COOKIE,
  AUTH_COOKIE_MAX_AGE,
  AUTH_TOKEN_OPTIONS,
  AUTH_TOKEN_CLIENT_OPTIONS,
  AUTH_PAYLOAD_OPTIONS,
  CSRF_TOKEN_COOKIE,
  CSRF_TOKEN_CLIENT_COOKIE,
} from "./cookie-names";
import { timingSafeCompare } from "./remote-auth-utils";

/**
 * Generate a random CSRF token.
 */
function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Encode payload object as base64url for the payload cookie.
 */
function encodePayload(payload: object): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

/**
 * Set all authentication cookies on a response.
 * - HttpOnly Bearer token cookie (defense-in-depth, browser auto-sends)
 * - Non-HttpOnly Bearer token cookie (JS-readable for Authorization header)
 * - Non-HttpOnly payload info cookie (JS-readable for parseToken, expiry checks)
 * - CSRF double-submit cookies (HttpOnly + client-readable)
 */
export function setAuthCookies(
  response: NextResponse,
  token: string,
  payload: { id: string; email: string; exp: number; iat: number },
): NextResponse {
  // HttpOnly Bearer token cookie (JS cannot read — XSS-safe)
  response.cookies.set(AUTH_TOKEN_COOKIE, token, AUTH_TOKEN_OPTIONS);

  // Non-HttpOnly Bearer token cookie (JS-readable — used by getAuthToken for Authorization header)
  response.cookies.set(
    AUTH_TOKEN_CLIENT_COOKIE,
    token,
    AUTH_TOKEN_CLIENT_OPTIONS,
  );

  // Non-HttpOnly payload info cookie (JS-readable — used by parseToken, expiry checks)
  const encodedPayload = encodePayload(payload);
  response.cookies.set(
    AUTH_PAYLOAD_COOKIE,
    encodedPayload,
    AUTH_PAYLOAD_OPTIONS,
  );

  // CSRF double-submit cookies
  const csrfToken = generateCsrfToken();
  response.cookies.set(CSRF_TOKEN_COOKIE, csrfToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
  response.cookies.set(CSRF_TOKEN_CLIENT_COOKIE, csrfToken, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  return response;
}

/**
 * Clear all authentication cookies.
 */
export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(AUTH_TOKEN_COOKIE);
  response.cookies.delete(AUTH_TOKEN_CLIENT_COOKIE);
  response.cookies.delete(AUTH_PAYLOAD_COOKIE);
  response.cookies.delete(CSRF_TOKEN_COOKIE);
  response.cookies.delete(CSRF_TOKEN_CLIENT_COOKIE);
  return response;
}

/**
 * Validate CSRF token using the double-submit cookie pattern.
 * Compares the token from the request header with the HttpOnly cookie value.
 * Only validates for state-changing methods.
 *
 * Returns true if valid or non-state-changing method. Returns false if CSRF detected.
 */
export function validateCsrfToken(request: NextRequest): boolean {
  const method = request.method;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return true; // No CSRF check needed for safe methods
  }

  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;
  const headerToken =
    request.headers.get("x-csrf-token") || request.headers.get("x-xsrf-token");

  if (!cookieToken || !headerToken) {
    return false; // Missing CSRF token
  }

  return timingSafeCompare(cookieToken, headerToken);
}

/**
 * Get the client-readable CSRF token from the cookie header string.
 * Used on the client side to read the non-HttpOnly CSRF cookie.
 */
export function getCsrfTokenFromCookie(cookieHeader: string): string | null {
  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    }),
  );
  return cookies[CSRF_TOKEN_CLIENT_COOKIE] || null;
}

/**
 * Parse the payload cookie value and return the decoded object.
 * Returns null if parsing fails.
 */
export function parsePayloadCookie(
  payloadCookie: string,
): { id: string; email: string; exp: number; iat: number } | null {
  try {
    let base64Payload = payloadCookie.replace(/-/g, "+").replace(/_/g, "/");
    while (base64Payload.length % 4 !== 0) base64Payload += "=";
    const decoded = Buffer.from(base64Payload, "base64").toString("utf-8");
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}
