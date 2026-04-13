"use client";
import type {
  InsightFilterCondition,
  InsightFilterDefinition,
  InsightFilterBinaryExpr,
  InsightFilterNotExpr,
  InsightFilter,
} from "@/lib/insights/filter-schema";
import {
  isFilterBinaryExpr,
  isFilterDefinition,
  isFilterNotExpr,
} from "@/lib/insights/filter-utils";
import { generateUUID } from "@/lib/utils";

export type TabFilterCondition = InsightFilterCondition & {
  id: string;
  op: "and" | "or";
  not?: boolean;
};

/**
 * Recursively parse InsightFilter to TabFilterCondition list
 * @param filter Nested InsightFilter expression
 * @param parentOp Parent combinator (for multi-condition merging)
 * @returns TabFilterCondition list
 */
export function insightFilterToTabConditions(
  filter: InsightFilter,
): TabFilterCondition[] {
  const conditions: TabFilterCondition[] = [];

  // Recursive parse function
  const parseFilter = (
    expr: InsightFilter,
    not = false,
    op: "and" | "or" = "and", // Default combinator
  ) => {
    if (isFilterDefinition(expr)) {
      expr.conditions.forEach((cond) => {
        conditions.push({
          ...cond,
          id: generateUUID(),
          op,
          not,
        });
      });
      return;
    }

    if (isFilterNotExpr(expr)) {
      parseFilter(expr.operand, true, op);
      return;
    }

    if (isFilterBinaryExpr(expr)) {
      const currentOp = expr.op.toLowerCase() as "and" | "or";
      parseFilter(expr.left, false, currentOp);
      parseFilter(expr.right, false, currentOp);
      return;
    }
  };

  parseFilter(filter);

  if (conditions.length > 1) {
    conditions.forEach((cond, index) => {
      if (index === 0) {
        cond.op = conditions[1]?.op || "and";
      }
    });
  }

  return conditions;
}

export function tabConditionToFilter(
  condition: TabFilterCondition,
): InsightFilter {
  const { id, op, not, ...rawCondition } = condition;
  const atomicDefinition: InsightFilterDefinition = {
    match: "all",
    conditions: [rawCondition],
  };

  if (not) {
    const notExpr: InsightFilterNotExpr = {
      op: "not",
      operand: atomicDefinition,
    };
    return notExpr;
  }

  return atomicDefinition;
}

export function combineFiltersIntoTree(
  filters: InsightFilter[],
  op: "and" | "or",
): InsightFilter {
  if (filters.length === 0) {
    throw new Error("Conditions MUST not be empty");
  }
  if (filters.length === 1) {
    return filters[0];
  }

  const mid = Math.floor(filters.length / 2);
  const left = combineFiltersIntoTree(filters.slice(0, mid), op);
  const right = combineFiltersIntoTree(filters.slice(mid), op);

  // Build binary expression node
  const binaryExpr: InsightFilterBinaryExpr = {
    op,
    left,
    right,
  };

  return binaryExpr;
}

export function tabConditionsToTreeFilter(
  conditions: TabFilterCondition[],
): InsightFilter {
  if (conditions.length === 0) {
    throw new Error("Conditions MUST not be empty");
  }
  const atomicFilters = conditions.map((cond) => tabConditionToFilter(cond));
  const andGroups: InsightFilter[][] = [[]];
  conditions.forEach((cond, index) => {
    const currentGroup = andGroups[andGroups.length - 1];
    let currentIndex = index;
    currentGroup.push(atomicFilters[currentIndex]);
    if (
      currentIndex < conditions.length - 1 &&
      conditions[currentIndex + 1].op === "or"
    ) {
      andGroups.push([]);
      currentIndex++;
    }
  });
  const andSubTrees = andGroups.map((group) =>
    combineFiltersIntoTree(group, "and"),
  );
  const rootFilter = combineFiltersIntoTree(andSubTrees, "or");
  return rootFilter;
}

export function tabConditionsToLinearTreeFilter(
  conditions: TabFilterCondition[],
): InsightFilter {
  if (conditions.length === 0) {
    throw new Error("Conditions MUST not be empty");
  }
  const atomicFilters = conditions.map((cond) => tabConditionToFilter(cond));
  let root: InsightFilter = atomicFilters[0];
  for (let i = 1; i < atomicFilters.length; i++) {
    const op = conditions[i].op.toUpperCase() as "and" | "or";
    const newNode: InsightFilterBinaryExpr = {
      op,
      left: root,
      right: atomicFilters[i],
    };
    root = newNode;
  }
  return root;
}
