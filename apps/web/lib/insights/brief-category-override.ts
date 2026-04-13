import { db } from "@/lib/db/queries";
import { insightBriefCategories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { Insight } from "@/lib/db/schema";

type Category = "urgent" | "important" | "monitor" | "archive";

/**
 * Calculate string similarity (Levenshtein distance)
 * Returns a value between 0-1, 1 means identical
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = (s1: string, s2: string): number => {
    const matrix: number[][] = [];
    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1, // insertion
            matrix[i - 1][j] + 1, // deletion
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  };

  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

/**
 * Get user's fixed category labels (override EventRank)
 *
 * Matching priority:
 * 1. Direct match on insightId (manually assigned by user)
 * 2. Exact match on dedupeKey (same recurring event)
 * 3. Fuzzy match on title (events with title similarity >85%)
 *
 * @param userId - User ID
 * @param insights - List of insights to check for matches
 * @returns { overrides: Map<string, Category>, unpinnedIds: Set<string> } - Category of insights with fixed labels and IDs of unpinned events
 */
export async function getUserCategoryOverrides(
  userId: string,
  insights: Insight[],
): Promise<{ overrides: Map<string, Category>; unpinnedIds: Set<string> }> {
  const overrides = new Map<string, Category>();
  const unpinnedIds = new Set<string>();

  if (insights.length === 0) {
    return { overrides, unpinnedIds };
  }

  // Batch fetch all fixed labels for the user
  const allUserCategories = await db
    .select()
    .from(insightBriefCategories)
    .where(eq(insightBriefCategories.userId, userId));

  if (!allUserCategories || allUserCategories.length === 0) {
    return { overrides, unpinnedIds };
  }

  // Find all unpinned event IDs
  for (const cat of allUserCategories) {
    if (cat.source === "unpinned") {
      unpinnedIds.add(cat.insightId);
    }
  }

  // Find matching fixed labels for each insight
  for (const insight of insights) {
    // Skip if it's in unpinned state
    if (unpinnedIds.has(insight.id)) {
      continue;
    }

    // 1. Direct match on insightId (highest priority)
    const directMatch = allUserCategories.find(
      (c: any) => c.insightId === insight.id,
    );
    if (directMatch) {
      overrides.set(insight.id, directMatch.category as Category);
      continue;
    }

    // 2. Exact match on dedupeKey
    if (insight.dedupeKey) {
      const dedupeMatch = allUserCategories.find(
        (c: any) => c.dedupeKey === insight.dedupeKey && c.source === "manual",
      );
      if (dedupeMatch) {
        overrides.set(insight.id, dedupeMatch.category as Category);
        continue;
      }
    }

    // 3. Fuzzy match on title (similarity >85%)
    for (const cat of allUserCategories) {
      if (!cat.title) continue;

      const similarity = calculateSimilarity(insight.title, cat.title);
      if (similarity > 0.85) {
        overrides.set(insight.id, cat.category as Category);
        break;
      }
    }
  }

  return { overrides, unpinnedIds };
}
