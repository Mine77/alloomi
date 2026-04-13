/**
 * Cloud integration sync hook
 *
 * Used to sync cloud integration accounts once on app startup for local version
 */

import { useEffect } from "react";
import { initializeCloudSync } from "@/lib/integration/cloud-sync";

export function useCloudSync() {
  useEffect(() => {
    // Sync once on app startup
    initializeCloudSync();
  }, []);
}
