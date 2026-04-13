"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { RemixIcon } from "@/components/remix-icon";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@alloomi/ui";
import { Input } from "@alloomi/ui";
import type { Insight } from "@/lib/db/schema";
import type { SearchResultItem } from "@/components/global-search-dialog";
import { useGlobalInsightDrawer } from "@/components/global-insight-drawer";
import { fetcher } from "@/lib/utils";
import useSWR from "swr";

/**
 * Event search dialog component
 * Allows users to search event names and focus events into conversations
 * Uses /api/search API to align with global search logic
 */
export function EventSearchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const { openDrawer } = useGlobalInsightDrawer();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search query
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery]);

  /**
   * Search API URL
   * - With search term: use /api/search to search all events
   * - Without search term: use /api/insights/events to show recent events
   */
  const searchUrl = useMemo(() => {
    if (!open) return null;

    if (debouncedQuery.trim()) {
      // Use global search API, aligned with global search logic
      return `/api/search?q=${encodeURIComponent(debouncedQuery)}&types=events&limit=50`;
    }
    // Show recent events when no search term
    return "/api/insights/events?limit=20&days=0";
  }, [debouncedQuery, open]);

  /**
   * Fetch search results
   */
  const { data, isLoading, error } = useSWR<{
    events?: SearchResultItem[];
    items?: Insight[];
  }>(searchUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  /**
   * Extract Insight objects from search results
   * - Global search API return format: { events: SearchResultItem[] }, insight is in extra field
   * - Recent events API return format: { items: Insight[] }
   */
  const insights = useMemo(() => {
    if (!data) return [];

    if (data.events) {
      // Result from global search API
      return data.events
        .map((item) => (item.extra as any)?.insight)
        .filter((insight): insight is Insight => !!insight);
    }

    if (data.items) {
      // Result from recent events API
      return data.items;
    }

    return [];
  }, [data]);

  /**
   * Handle event selection
   */
  const handleSelectEvent = (insight: Insight) => {
    // Open insight detail drawer
    openDrawer(insight);
    // Close dialog
    onOpenChange(false);
    setSearchQuery("");
  };

  /**
   * When dialog opens, focus the input field
   */
  useEffect(() => {
    if (open && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {t("chat.addEvent", "Add event to conversation")}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {/* Search input */}
          <div className="relative">
            <RemixIcon
              name="search"
              size="size-4"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              ref={inputRef}
              type="text"
              placeholder={t(
                "chat.searchEventPlaceholder",
                "Search event name...",
              )}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  onOpenChange(false);
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              >
                <RemixIcon name="close" size="size-4" />
              </button>
            )}
          </div>

          {/* Events list */}
          <div className="flex-1 overflow-y-auto min-h-0 border rounded-lg">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RemixIcon
                  name="loader_2"
                  size="size-6"
                  className="animate-spin text-muted-foreground"
                />
                <span className="ml-2 text-sm text-muted-foreground">
                  {t("common.loading", "Loading")}
                </span>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-12 text-sm text-destructive">
                {t(
                  "chat.searchEventError",
                  "Failed to load events, please try again later",
                )}
              </div>
            ) : insights.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                {searchQuery.trim()
                  ? t("chat.noEventsFound", "No matching events found")
                  : t("chat.noEvents", "No events")}
              </div>
            ) : (
              <div className="divide-y">
                {insights.map((insight) => (
                  <button
                    key={insight.id}
                    type="button"
                    onClick={() => handleSelectEvent(insight)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {insight.title ||
                          t("chat.untitledEvent", "Untitled event")}
                      </div>
                      {insight.description && (
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2 whitespace-pre-line">
                          {insight.description}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        {insight.platform && <span>{insight.platform}</span>}
                        {insight.time && (
                          <span>
                            • {new Date(insight.time).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Bottom hint */}
          <div className="text-xs text-muted-foreground">
            {t(
              "chat.addEventHint",
              "After selecting an event, it will be focused in the conversation and AI will respond based on that event context",
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
