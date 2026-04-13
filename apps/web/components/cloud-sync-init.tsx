/**
 * Cloud sync initialization component
 *
 * Used to start cloud integration sync polling when the app starts
 */

"use client";

import { useCloudSync } from "@/hooks/use-cloud-sync";

export function CloudSyncInit() {
  useCloudSync();

  return null;
}
