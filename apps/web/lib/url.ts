import { getAppUrl as getEnvAppUrl, isTauriMode } from "./env";

export function getApplicationBaseUrl() {
  // Prefer URL configured in environment variables
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.APPLICATION_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  // Tauri mode uses localhost
  if (isTauriMode()) {
    return getEnvAppUrl();
  }

  // Vercel deployment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  // Default to localhost:3415
  return "http://localhost:3415";
}
