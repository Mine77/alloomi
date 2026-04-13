import { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/toast";
import { getAuthToken } from "@/lib/auth/token-manager";

interface SingleInsightRefreshResult {
  insight: any;
  credits: {
    input: number;
    output: number;
  };
}

interface UseSingleInsightRefreshReturn {
  isRefreshing: boolean;
  refreshError: string | null;
  refreshCreditsUsed: { input: number; output: number } | null;
  handleRefresh: (
    insightId: string,
  ) => Promise<SingleInsightRefreshResult | null>;
}

/**
 * Custom hook for single Insight refresh related functionality
 * @returns Refresh-related state and functions
 */
export function useSingleInsightRefresh(): UseSingleInsightRefreshReturn {
  const { t } = useTranslation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshCreditsUsed, setRefreshCreditsUsed] = useState<{
    input: number;
    output: number;
  } | null>(null);

  /**
   * Refresh a single Insight
   */
  const handleRefresh = useCallback(
    async (insightId: string): Promise<SingleInsightRefreshResult | null> => {
      if (isRefreshing) {
        return null;
      }

      setIsRefreshing(true);
      setRefreshError(null);
      setRefreshCreditsUsed(null);

      try {
        // Get cloud auth token (if exists)
        let cloudAuthToken: string | undefined;
        try {
          cloudAuthToken = getAuthToken() || undefined;
        } catch (error) {
          console.error(
            "[InsightRefresh] Failed to read cloud_auth_token:",
            error,
          );
        }

        const refreshResponse = await fetch(
          `/api/insights/${insightId}/refresh`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ cloudAuthToken }),
          },
        );

        if (!refreshResponse.ok) {
          let errorMessage = t(
            "insight.refreshError.default",
            "Refresh failed, please try again",
          );
          try {
            const errorBody = await refreshResponse.json();
            errorMessage = errorBody.message || errorBody.error || errorMessage;
          } catch {
            // If JSON parsing fails, use default error
          }
          throw new Error(errorMessage || "Failed to refresh insight");
        }

        const result = await refreshResponse.json();
        setRefreshCreditsUsed(result.credits || null);

        // Show success toast
        toast({
          type: "success",
          description: t("insightDetail.refresh.success", "Insight refreshed"),
        });

        return result;
      } catch (error) {
        console.error("Error refreshing insight:", error);

        const errorMessage =
          error instanceof Error ? error.message : String(error);

        setRefreshError(errorMessage);

        // Show error toast
        toast({
          type: "error",
          description: errorMessage,
        });

        return null;
      } finally {
        setIsRefreshing(false);
      }
    },
    [isRefreshing, t],
  );

  return {
    isRefreshing,
    refreshError,
    refreshCreditsUsed,
    handleRefresh,
  };
}
