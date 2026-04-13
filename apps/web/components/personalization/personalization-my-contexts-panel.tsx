"use client";

import { PersonalizationSwrBoundary } from "./personalization-swr-boundary";
import { PersonalizationContextsSettings } from "./personalization-contexts-settings";

/**
 * Full-page My Contexts settings (formerly the personalization dialog "contexts" tab).
 */
export function PersonalizationMyContextsPanel() {
  return (
    <PersonalizationSwrBoundary>
      <PersonalizationContextsSettings />
    </PersonalizationSwrBoundary>
  );
}
