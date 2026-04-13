import type { InsightSettings } from "@/lib/db/schema";

const ACTIVITY_TIER_CONFIG = {
  high: { priority: 0, refreshMinutes: 15, thresholdHours: 1 },
  medium: { priority: 1, refreshMinutes: 60, thresholdHours: 6 },
  low: { priority: 2, refreshMinutes: 180, thresholdHours: 24 },
  dormant: {
    priority: 3,
    refreshMinutes: 1440,
    thresholdHours: Number.POSITIVE_INFINITY,
  },
} as const;

export type ActivityTier = keyof typeof ACTIVITY_TIER_CONFIG;

export const ACTIVITY_TIER_PRIORITIES: Record<ActivityTier, number> = {
  high: ACTIVITY_TIER_CONFIG.high.priority,
  medium: ACTIVITY_TIER_CONFIG.medium.priority,
  low: ACTIVITY_TIER_CONFIG.low.priority,
  dormant: ACTIVITY_TIER_CONFIG.dormant.priority,
};

export function clampActivityTier(tier?: string | null): ActivityTier {
  switch (tier) {
    case "high":
    case "medium":
    case "low":
    case "dormant":
      return tier;
    default:
      return "low";
  }
}

export function deriveActivityTier(
  now: Date,
  lastActiveAt: Date | null,
): ActivityTier {
  if (!lastActiveAt) {
    return "low";
  }

  const diffHours = (now.getTime() - lastActiveAt.getTime()) / (60 * 60 * 1000);

  if (diffHours <= ACTIVITY_TIER_CONFIG.high.thresholdHours) {
    return "high";
  }
  if (diffHours <= ACTIVITY_TIER_CONFIG.medium.thresholdHours) {
    return "medium";
  }
  if (diffHours <= ACTIVITY_TIER_CONFIG.low.thresholdHours) {
    return "low";
  }
  return "dormant";
}

export function resolveTierRefreshMinutes(tier?: string | null): number {
  const resolvedTier = clampActivityTier(tier);
  return ACTIVITY_TIER_CONFIG[resolvedTier].refreshMinutes;
}

export function resolveTierPriority(tier?: string | null): number {
  const resolvedTier = clampActivityTier(tier);
  return ACTIVITY_TIER_PRIORITIES[resolvedTier];
}

export function getEffectiveRefreshIntervalMinutes(
  settings: InsightSettings,
): number {
  const tierMinutes = resolveTierRefreshMinutes(settings.activityTier);
  return Math.max(settings.refreshIntervalMinutes, tierMinutes);
}

export function getCacheTtlMs(settings: InsightSettings): number {
  return getEffectiveRefreshIntervalMinutes(settings) * 60 * 1000;
}

export function filterDueInsightSettings({
  settings,
  now,
  limit,
  ttlHours,
}: {
  settings: InsightSettings[];
  now: Date;
  limit: number;
  ttlHours: number;
}): InsightSettings[] {
  const ttlMs = ttlHours * 60 * 60 * 1000;

  const dueSettings = settings.filter((setting) => {
    const lastProcessed = setting.lastMessageProcessedAt?.getTime() ?? 0;
    const intervalMs =
      resolveTierRefreshMinutes(setting.activityTier) * 60 * 1000;
    const dueByInterval = now.getTime() - lastProcessed >= intervalMs;
    const dueByTtl = now.getTime() - lastProcessed >= ttlMs;
    return dueByInterval || dueByTtl;
  });

  dueSettings.sort((a, b) => {
    const tierPriorityDiff =
      resolveTierPriority(a.activityTier) - resolveTierPriority(b.activityTier);
    if (tierPriorityDiff !== 0) {
      return tierPriorityDiff;
    }
    const lastA = a.lastMessageProcessedAt?.getTime() ?? 0;
    const lastB = b.lastMessageProcessedAt?.getTime() ?? 0;
    return lastA - lastB;
  });

  return dueSettings.slice(0, limit);
}
