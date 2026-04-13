/**
 * Auth error codes
 * Used for unified error handling between frontend and backend
 */
export enum AuthErrorCode {
  // Auth-related errors
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_NOT_FOUND = "USER_NOT_FOUND",
  USER_EXISTS = "USER_EXISTS",

  // Request parameter errors
  MISSING_EMAIL = "MISSING_EMAIL",
  MISSING_PASSWORD = "MISSING_PASSWORD",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_PASSWORD = "INVALID_PASSWORD",

  // Server errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Other errors
  RATE_LIMITED = "RATE_LIMITED",
}

/**
 * Get error message mapping by error code (for debugging)
 * Frontend should use i18n to display user-friendly messages
 */
export const errorMessageMap: Record<AuthErrorCode, string> = {
  [AuthErrorCode.INVALID_CREDENTIALS]: "Invalid email or password",
  [AuthErrorCode.USER_NOT_FOUND]: "User not found",
  [AuthErrorCode.USER_EXISTS]: "User already exists",
  [AuthErrorCode.MISSING_EMAIL]: "Email is required",
  [AuthErrorCode.MISSING_PASSWORD]: "Password is required",
  [AuthErrorCode.INVALID_EMAIL]: "Invalid email format",
  [AuthErrorCode.INVALID_PASSWORD]: "Invalid password format",
  [AuthErrorCode.INTERNAL_ERROR]: "Internal server error",
  [AuthErrorCode.SERVICE_UNAVAILABLE]: "Service unavailable",
  [AuthErrorCode.RATE_LIMITED]: "Too many requests",
};
