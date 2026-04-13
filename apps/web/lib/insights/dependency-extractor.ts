/**
 * Event dependency extractor
 * Uses LLM to analyze dependencies between Insights (prerequisites, references, etc.)
 *
 * Used for Day 2 enhancement of EventRank algorithm
 */

import { z } from "zod";
import type { Insight } from "@/lib/db/schema";

/**
 * Lazy import model, only load when needed
 * Avoid checking environment variables at module load time
 */
async function getModel() {
  const { model } = await import("@/lib/ai");
  return model;
}

/**
 * Lazy import generateText, only load when needed
 */
async function getGenerateText() {
  const { generateText } = await import("ai");
  return generateText;
}

/**
 * Dependency types
 */
export enum DependencyType {
  PREREQUISITE = "prerequisite", // Prerequisite: A must be completed before B
  REFERENCE = "reference", // Reference: B can reference A's content
  BLOCKED_BY = "blocked_by", // Blocked: B is blocked by A
  RELATED = "related", // Related: A and B are related but not dependent
}

/**
 * Dependency weights (used for EventRank calculation)
 */
export const DEPENDENCY_WEIGHTS: Record<DependencyType, number> = {
  [DependencyType.PREREQUISITE]: 0.9, // Prerequisite: strong dependency
  [DependencyType.BLOCKED_BY]: 0.85, // Blocked: strong dependency
  [DependencyType.REFERENCE]: 0.3, // Reference: weak dependency
  [DependencyType.RELATED]: 0.2, // Related: weakest
};

/**
 * Extracted dependency
 */
export interface InsightDependency {
  fromId: string; // Source Insight ID
  toId: string; // Target Insight ID
  type: DependencyType;
  reason: string; // AI explanation for why this dependency exists
  confidence: number; // 0-1, confidence
}

/**
 * Schema for LLM output dependency
 */
const dependencyExtractionSchema = z.object({
  dependencies: z.array(
    z.object({
      fromIndex: z.number().describe("Source Insight index in input array"),
      toIndex: z.number().describe("Target Insight index in input array"),
      type: z.enum(["prerequisite", "reference", "blocked_by", "related"]),
      reason: z.string().describe("Explanation of why this dependency exists"),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

/**
 * System prompt for dependency extraction
 */
const DEPENDENCY_EXTRACTION_PROMPT = `## Role Definition

You are an expert task dependency analyzer. Your job is to analyze a list of events/insights and identify dependencies between them.

## Dependency Types

1. **prerequisite** (前置条件): Event A must be completed before Event B can start
   - Example: "Design approval" must be done before "Implementation starts"
   - Weight: 0.9 (strong dependency)

2. **blocked_by** (被阻塞): Event B is blocked by Event A
   - Example: "Deployment" is blocked by "Bug fix"
   - Weight: 0.85 (strong dependency)

3. **reference** (参考资料): Event B can reference information from Event A
   - Example: "Weekly report" can reference data from "Monday's meeting"
   - Weight: 0.3 (weak dependency)

4. **related** (相关): Events A and B are related but neither depends on the other
   - Example: Two tasks in the same project
   - Weight: 0.2 (weakest dependency)

## Analysis Guidelines

1. **Extract Explicit Dependencies**: Look for:
   - Keywords: "after", "before", "once", "when", "depends on", "requires"
   - Temporal relationships: "first do X, then Y"
   - Blocking conditions: "waiting for", "blocked by", "holding on"

2. **Infer Implicit Dependencies**: Consider:
   - Logical workflow: Design → Develop → Test → Deploy
   - Data flow: Collect data → Analyze → Report
   - Approval chains: Draft → Review → Approve

3. **Avoid False Positives**: Do NOT mark as dependent if:
   - Events are just in the same project/channel but unrelated
   - Events share only keywords but no logical connection
   - Events are independent parallel tasks

4. **Confidence Scoring**:
   - 0.9-1.0: Explicit dependency stated in text
   - 0.7-0.9: Strong logical inference
   - 0.5-0.7: Moderate inference
   - 0.3-0.5: Weak inference
   - <0.3: Too uncertain, skip

5. **Output Format**:
   - Use 0-based indices for fromIndex and toIndex
   - Each dependency should only be listed once (no duplicates)
   - Do not create self-referential dependencies (fromIndex === toIndex)

## Examples

Input:
[
  {title: "Q3 Budget Approval", description: "Need CEO approval by Friday"},
  {title: "Submit Q3 Report", description: "Report depends on approved budget"},
  {title: "Team Meeting Notes", description: "Notes from Monday's all-hands"}
]

Output:
{
  "dependencies": [
    {
      "fromIndex": 0,
      "toIndex": 1,
      "type": "prerequisite",
      "reason": "Q3 Report submission explicitly depends on approved budget",
      "confidence": 0.95
    }
  ]
}

Now analyze the given events and output dependencies in JSON format.`;

/**
 * Extract dependencies from a group of Insights
 *
 * @param insights - Insight array
 * @param maxInsights - Maximum number of Insights to process (avoid LLM context overflow)
 * @returns List of extracted dependencies
 */
export async function extractDependencies(
  insights: Insight[],
  options: {
    maxInsights?: number;
    timeoutMs?: number;
  } = {},
): Promise<InsightDependency[]> {
  const { maxInsights = 50, timeoutMs = 30000 } = options;

  // If there are too few insights, return empty
  if (insights.length < 2) {
    return [];
  }

  // Limit the number of insights to process
  const limitedInsights = insights.slice(0, maxInsights);

  try {
    // Prepare input: simplified insight information
    const insightSummaries = limitedInsights.map((insight, index) => ({
      index,
      id: insight.id,
      title: insight.title,
      description: insight.description || "",
      taskLabel: insight.taskLabel || "",
      myTasks: insight.myTasks || [],
      waitingForMe: insight.waitingForMe || [],
      waitingForOthers: insight.waitingForOthers || [],
      people: insight.people || [],
      topKeywords: insight.topKeywords || [],
    }));

    const prompt = `Analyze the following ${insightSummaries.length} events and extract dependencies between them:

${JSON.stringify(insightSummaries, null, 2)}

Output the dependencies in the specified JSON format.`;

    // Lazily get generateText and model
    const [generateText, model] = await Promise.all([
      getGenerateText(),
      getModel(),
    ]);

    const result = await generateText({
      model,
      system: DEPENDENCY_EXTRACTION_PROMPT,
      prompt,
      temperature: 0.1, // Low temperature for stable results
    });

    // Parse LLM output
    const parsed = dependencyExtractionSchema.safeParse(
      JSON.parse(result.text),
    );

    if (!parsed.success) {
      console.error(
        "[DependencyExtractor] Failed to parse LLM output:",
        parsed.error,
      );
      return [];
    }

    // Convert to InsightDependency format
    const dependencies: InsightDependency[] = [];

    for (const dep of parsed.data.dependencies) {
      // Validate indices
      if (
        dep.fromIndex < 0 ||
        dep.fromIndex >= limitedInsights.length ||
        dep.toIndex < 0 ||
        dep.toIndex >= limitedInsights.length
      ) {
        console.warn(
          `[DependencyExtractor] Invalid index: from=${dep.fromIndex}, to=${dep.toIndex}, length=${limitedInsights.length}`,
        );
        continue;
      }

      // Avoid self-reference
      if (dep.fromIndex === dep.toIndex) {
        continue;
      }

      dependencies.push({
        fromId: limitedInsights[dep.fromIndex].id,
        toId: limitedInsights[dep.toIndex].id,
        type: dep.type as DependencyType,
        reason: dep.reason,
        confidence: dep.confidence,
      });
    }

    // Deduplicate (same from-to pair)
    const uniqueDependencies = dependencies.filter(
      (dep, index, self) =>
        index ===
        self.findIndex((d) => d.fromId === dep.fromId && d.toId === dep.toId),
    );

    console.log(
      `[DependencyExtractor] Extracted ${uniqueDependencies.length} dependencies from ${limitedInsights.length} insights`,
    );

    return uniqueDependencies;
  } catch (error) {
    console.error(
      "[DependencyExtractor] Failed to extract dependencies:",
      error,
    );
    return [];
  }
}

/**
 * Batch extract dependencies (for large number of insights)
 * Process insights in batches to avoid LLM context overflow
 *
 * @param insights - Insight array
 * @param batchSize - Number of Insights per batch
 * @returns All extracted dependencies
 */
export async function extractDependenciesBatched(
  insights: Insight[],
  options: {
    batchSize?: number;
    maxInsights?: number;
    timeoutMs?: number;
  } = {},
): Promise<InsightDependency[]> {
  const { batchSize = 50, maxInsights = 200, timeoutMs = 30000 } = options;

  if (insights.length < 2) {
    return [];
  }

  // Limit total count
  const limitedInsights = insights.slice(0, maxInsights);

  // Process in batches
  const batches: Insight[][] = [];
  for (let i = 0; i < limitedInsights.length; i += batchSize) {
    batches.push(limitedInsights.slice(i, i + batchSize));
  }

  console.log(
    `[DependencyExtractor] Processing ${limitedInsights.length} insights in ${batches.length} batches`,
  );

  // Process batches in parallel
  const results = await Promise.all(
    batches.map((batch) =>
      extractDependencies(batch, { maxInsights: batchSize, timeoutMs }),
    ),
  );

  // Merge results
  const allDependencies = results.flat();

  // Deduplicate
  const uniqueDependencies = allDependencies.filter(
    (dep, index, self) =>
      index ===
      self.findIndex((d) => d.fromId === dep.fromId && d.toId === dep.toId),
  );

  console.log(
    `[DependencyExtractor] Extracted ${uniqueDependencies.length} unique dependencies from ${limitedInsights.length} insights`,
  );

  return uniqueDependencies;
}

/**
 * Convert dependencies to edge format required by EventRank
 */
export function dependenciesToEventEdges(
  dependencies: InsightDependency[],
): Array<{ fromId: string; toId: string; weight: number }> {
  return dependencies.map((dep) => ({
    fromId: dep.fromId,
    toId: dep.toId,
    weight: DEPENDENCY_WEIGHTS[dep.type] * dep.confidence,
  }));
}
