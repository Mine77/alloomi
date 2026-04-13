/**
 * Brief page categorization operations Hook
 * Provides functionality to update insight categories in Brief panel, supports optimistic updates
 */

import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/toast";

type Category = "urgent" | "important" | "monitor" | "archive";

/**
 * Brief page categorization operations Hook
 */
export function useInsightBriefCategory() {
  const { t } = useTranslation();

  /**
   * Update insight category
   * @param insightId - insight ID
   * @param category - new category
   */
  const updateInsightCategory = useCallback(
    async (insightId: string, category: Category) => {
      try {
        // API call
        const response = await fetch(
          `/api/insights/${insightId}/brief-category`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ category }),
            credentials: "include",
          },
        );

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || "Failed to update category");
        }

        const result = await response.json();

        // Show success toast
        toast({
          type: "success",
          description: t(
            "brief.categoryUpdated",
            "Category updated, system will remember your choice",
          ),
        });

        // Trigger global event to notify other components
        window.dispatchEvent(
          new CustomEvent("insightCategoryChanged", {
            detail: { insightId, category },
          }),
        );

        return result;
      } catch (error) {
        console.error("Failed to update brief category:", error);

        // Show error toast
        toast({
          type: "error",
          description: t(
            "brief.categoryUpdateError",
            "Update failed, please try again",
          ),
        });

        throw error;
      }
    },
    [t],
  );

  return {
    updateInsightCategory,
  };
}
