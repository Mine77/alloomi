import "server-only";

import { sql } from "drizzle-orm";

import { db } from "@/lib/db/queries";
import { sendLifecycleEmail } from "./service";
import type { MarketingUserSnapshot } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type Candidate = {
  userId: string;
  email?: string | null;
  dedupeKey?: string;
  snapshot?: MarketingUserSnapshot;
};

type TriggerFetchContext = {
  now: Date;
  limit: number;
};

type TriggerDefinition = {
  id: string;
  description: string;
  templateId: string;
  fetchCandidates: (context: TriggerFetchContext) => Promise<Candidate[]>;
};

function toCandidates(
  rows: Array<{ userId: string; email: string | null }>,
): Candidate[] {
  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
  }));
}

async function fetchActivationConnect(
  context: TriggerFetchContext,
): Promise<Candidate[]> {
  const threshold = new Date(context.now.getTime() - 24 * HOUR_MS);
  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email"
    FROM "User" AS u
    WHERE u.first_login_at IS NOT NULL
      AND u.first_login_at <= ${threshold}
      AND NOT EXISTS (
        SELECT 1 FROM "Bot" b WHERE b."userId" = u.id
      )
    ORDER BY u.first_login_at ASC
    LIMIT ${context.limit};
  `)) as Array<{ userId: string; email: string | null }>;

  return toCandidates(rows);
}

async function fetchActivationFirstSummary(
  context: TriggerFetchContext,
): Promise<Candidate[]> {
  const threshold = new Date(context.now.getTime() - 48 * HOUR_MS);
  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email"
    FROM "User" AS u
    WHERE u.first_login_at IS NOT NULL
      AND u.first_login_at <= ${threshold}
      AND EXISTS (
        SELECT 1 FROM "Bot" b WHERE b."userId" = u.id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM "Summary" s
        JOIN "Bot" b2 ON b2.id = s."botId"
        WHERE b2."userId" = u.id
      )
    ORDER BY u.first_login_at ASC
    LIMIT ${context.limit};
  `)) as Array<{ userId: string; email: string | null }>;

  return toCandidates(rows);
}

async function fetchUsersByFirstLoginAge(
  context: TriggerFetchContext,
  minHours: number,
): Promise<Candidate[]> {
  const threshold = new Date(context.now.getTime() - minHours * HOUR_MS);
  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email"
    FROM "User" AS u
    WHERE u.first_login_at IS NOT NULL
      AND u.first_login_at <= ${threshold}
    ORDER BY u.first_login_at ASC
    LIMIT ${context.limit};
  `)) as Array<{ userId: string; email: string | null }>;

  return toCandidates(rows);
}

async function fetchWeeklyDigestCandidates(
  context: TriggerFetchContext,
): Promise<Candidate[]> {
  const activeThreshold = new Date(context.now.getTime() - 14 * DAY_MS);
  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email", u.last_login_at AS "lastLoginAt"
    FROM "User" AS u
    WHERE u.last_login_at IS NOT NULL
      AND u.last_login_at >= ${activeThreshold}
    ORDER BY u.last_login_at DESC
    LIMIT ${context.limit};
  `)) as Array<{
    userId: string;
    email: string | null;
    lastLoginAt: Date | null;
  }>;

  const weekKey = getWeekKey(context.now);
  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    dedupeKey: `weekly_digest_default:${weekKey}`,
    snapshot: {
      lastLoginAt: row.lastLoginAt,
    },
  }));
}

async function fetchLoyaltyCandidates(
  context: TriggerFetchContext,
  minDays: number,
): Promise<Candidate[]> {
  const threshold = new Date(context.now.getTime() - minDays * DAY_MS);
  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email"
    FROM "User" AS u
    WHERE u.first_login_at IS NOT NULL
      AND u.first_login_at <= ${threshold}
    ORDER BY u.first_login_at ASC
    LIMIT ${context.limit};
  `)) as Array<{ userId: string; email: string | null }>;

  return toCandidates(rows);
}

async function fetchWinbackCandidates(
  context: TriggerFetchContext,
  minDays: number,
  maxDays?: number,
): Promise<Candidate[]> {
  const maxThreshold = maxDays
    ? new Date(context.now.getTime() - maxDays * DAY_MS)
    : null;
  const minThreshold = new Date(context.now.getTime() - minDays * DAY_MS);

  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email", u.last_login_at AS "lastLoginAt"
    FROM "User" AS u
    WHERE u.last_login_at IS NOT NULL
      AND u.last_login_at <= ${minThreshold}
      ${maxThreshold ? sql`AND u.last_login_at > ${maxThreshold}` : sql``}
    ORDER BY u.last_login_at ASC
    LIMIT ${context.limit};
  `)) as Array<{
    userId: string;
    email: string | null;
    lastLoginAt: Date | null;
  }>;

  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    snapshot: {
      lastLoginAt: row.lastLoginAt,
    },
  }));
}

async function fetchConversionFreeQuota(
  context: TriggerFetchContext,
): Promise<Candidate[]> {
  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email"
    FROM "User" AS u
    JOIN user_free_quota q ON q.userId = u.id
    WHERE q.total_quota > 0
      AND q.used_quota::decimal >= q.total_quota::decimal * 0.8
      AND NOT EXISTS (
        SELECT 1 FROM user_subscriptions s
        WHERE s.userId = u.id AND s.is_active = true
      )
    ORDER BY q.used_quota DESC
    LIMIT ${context.limit};
  `)) as Array<{ userId: string; email: string | null }>;

  return toCandidates(rows);
}

async function fetchRenewalCandidates(
  context: TriggerFetchContext,
  daysAhead: number,
): Promise<Candidate[]> {
  const windowStart = new Date(
    context.now.getTime() + (daysAhead - 0.5) * DAY_MS,
  );
  const windowEnd = new Date(
    context.now.getTime() + (daysAhead + 0.5) * DAY_MS,
  );

  const rows = (await db.execute(sql`
    SELECT u.id AS "userId", u.email AS "email", s.end_date AS "endDate"
    FROM user_subscriptions s
    JOIN "User" u ON u.id = s.userId
    WHERE s.is_active = true
      AND s.end_date IS NOT NULL
      AND s.end_date BETWEEN ${windowStart} AND ${windowEnd}
    ORDER BY s.end_date ASC
    LIMIT ${context.limit};
  `)) as Array<{
    userId: string;
    email: string | null;
    endDate: Date | null;
  }>;

  return rows.map((row) => ({
    userId: row.userId,
    email: row.email,
    snapshot: {
      daysToSubscriptionEnd: row.endDate
        ? Math.round((row.endDate.getTime() - context.now.getTime()) / DAY_MS)
        : null,
    },
  }));
}

function getWeekKey(date: Date) {
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = target.getUTCDay() || 7;
  if (day !== 1) {
    target.setUTCDate(target.getUTCDate() + (1 - day));
  }
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const diff = (target.getTime() - yearStart.getTime()) / (1000 * 60 * 60 * 24);
  const week = Math.ceil((diff + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const TRIGGERS: TriggerDefinition[] = [
  {
    id: "activation_no_integration_day1",
    description:
      "Users with a first login 24h ago but no integrations connected.",
    templateId: "activation_connect_day1",
    fetchCandidates: fetchActivationConnect,
  },
  {
    id: "activation_no_summary_day2",
    description:
      "Users with connected channels who have not yet generated a summary after 48h.",
    templateId: "activation_first_summary_day2",
    fetchCandidates: fetchActivationFirstSummary,
  },
  {
    id: "education_day4",
    description: "Send education email on day 4 after first login.",
    templateId: "education_value_day4",
    fetchCandidates: (ctx) => fetchUsersByFirstLoginAge(ctx, 96),
  },
  {
    id: "education_day6",
    description: "Send pro tips on day 6 after first login.",
    templateId: "education_pro_tips_day6",
    fetchCandidates: (ctx) => fetchUsersByFirstLoginAge(ctx, 144),
  },
  {
    id: "education_day9",
    description: "Nudge consistency on day 9 after first login.",
    templateId: "education_keep_active_day9",
    fetchCandidates: (ctx) => fetchUsersByFirstLoginAge(ctx, 216),
  },
  {
    id: "reinforcement_day14",
    description: "Celebrate streaks on day 14.",
    templateId: "reinforcement_progress_day14",
    fetchCandidates: (ctx) => fetchUsersByFirstLoginAge(ctx, 336),
  },
  {
    id: "reinforcement_day21",
    description: "Promote advanced workflows on day 21.",
    templateId: "reinforcement_advanced_day21",
    fetchCandidates: (ctx) => fetchUsersByFirstLoginAge(ctx, 504),
  },
  {
    id: "conversion_free_limit",
    description: "Free users approaching quota limit.",
    templateId: "conversion_limit_reached",
    fetchCandidates: fetchConversionFreeQuota,
  },
  {
    id: "weekly_digest",
    description: "Weekly recap for active users.",
    templateId: "weekly_digest_default",
    fetchCandidates: fetchWeeklyDigestCandidates,
  },
  {
    id: "loyalty_community",
    description: "Invite long-term users to the community after 30 days.",
    templateId: "loyalty_community_invite",
    fetchCandidates: (ctx) => fetchLoyaltyCandidates(ctx, 30),
  },
  {
    id: "loyalty_team_referral",
    description: "Encourage team expansion after 37 days.",
    templateId: "loyalty_teams_referral",
    fetchCandidates: (ctx) => fetchLoyaltyCandidates(ctx, 37),
  },
  {
    id: "renewal_day7",
    description: "Notify customers 7 days before renewal.",
    templateId: "renewal_day_7",
    fetchCandidates: (ctx) => fetchRenewalCandidates(ctx, 7),
  },
  {
    id: "renewal_day3",
    description: "Notify customers 3 days before renewal.",
    templateId: "renewal_day_3",
    fetchCandidates: (ctx) => fetchRenewalCandidates(ctx, 3),
  },
  {
    id: "renewal_day0",
    description: "Final day renewal reminder.",
    templateId: "renewal_final_day",
    fetchCandidates: (ctx) => fetchRenewalCandidates(ctx, 0),
  },
  {
    id: "winback_7",
    description: "Re-engage users inactive for 7 days.",
    templateId: "winback_week",
    fetchCandidates: (ctx) => fetchWinbackCandidates(ctx, 7, 14),
  },
  {
    id: "winback_14",
    description: "Extend help to users inactive for 14+ days.",
    templateId: "winback_two_weeks",
    fetchCandidates: (ctx) => fetchWinbackCandidates(ctx, 14, 60),
  },
];

export async function runMarketingAutomation({
  now = new Date(),
  limit = 50,
}: {
  now?: Date;
  limit?: number;
} = {}) {
  const results: Array<{
    triggerId: string;
    templateId: string;
    userId: string;
    delivered: boolean;
    reason?: string;
  }> = [];

  let remaining = limit;

  for (const trigger of TRIGGERS) {
    if (remaining <= 0) {
      break;
    }

    const candidates = await trigger.fetchCandidates({
      now,
      limit: remaining,
    });

    for (const candidate of candidates) {
      if (remaining <= 0) {
        break;
      }

      const outcome = await sendLifecycleEmail({
        templateId: trigger.templateId,
        userId: candidate.userId,
        email: candidate.email ?? undefined,
        dedupeKeyOverride: candidate.dedupeKey,
        snapshot: candidate.snapshot,
      });

      results.push({
        triggerId: trigger.id,
        templateId: trigger.templateId,
        userId: candidate.userId,
        delivered: outcome.delivered,
        reason: outcome.reason,
      });

      remaining -= 1;
    }
  }

  return results;
}
