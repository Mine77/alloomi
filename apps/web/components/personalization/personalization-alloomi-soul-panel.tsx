"use client";

import { PersonalizationSwrBoundary } from "./personalization-swr-boundary";
import { PersonalizationBasicSettings } from "./personalization-basic-settings";

/**
 * Full-page Alloomi Soul settings (formerly the personalization dialog "basic" tab).
 */
export function PersonalizationAlloomiSoulPanel() {
  return (
    <PersonalizationSwrBoundary>
      <PersonalizationBasicSettings open />
    </PersonalizationSwrBoundary>
  );
}
