"use client";

import { useEffect } from "react";
import { detectAndSetLanguage } from "@/i18n";

// Ensure i18n config is imported and initialized
import "@/i18n";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only detect and set language after client mount
    detectAndSetLanguage();
  }, []);

  return <>{children}</>;
}
