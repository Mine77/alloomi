"use client";

import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@alloomi/ui";
import { Button } from "@alloomi/ui";
import { cn } from "@/lib/utils";

/** Supported UI languages (flag kept for potential future use, not shown in menu UI). */
export const languages = [
  { code: "zh-Hans", name: "Simplified Chinese", flag: "🇨🇳" },
  { code: "en-US", name: "English", flag: "🇺🇸" },
] as const;

export type LanguageOption = (typeof languages)[number];

export type AccountMenuLanguageRowStyles = {
  iconSize: string;
  itemGap: string;
  itemPadding: string;
  itemTextSize: string;
  itemHover: string;
};

type LanguageSettingsMenuPropsBase = {
  currentLang: string;
  onLanguageChange: (code: string) => void;
  isMobile?: boolean;
};

export type LanguageSettingsMenuProps =
  | (LanguageSettingsMenuPropsBase & {
      variant: "settings-sidebar";
      sidebarCollapsed?: boolean;
    })
  | (LanguageSettingsMenuPropsBase & {
      variant: "account-menu";
      accountMenuRow: AccountMenuLanguageRowStyles;
    });

/**
 * Language entry shared by the settings sidebar and the account menu:
 * globe + bilingual label + right chevron; list items are text-only (no emoji).
 */
export function LanguageSettingsMenu(props: LanguageSettingsMenuProps) {
  const { currentLang, onLanguageChange, variant, isMobile = false } = props;
  const sidebarCollapsed =
    variant === "settings-sidebar" ? (props.sidebarCollapsed ?? false) : false;
  const { t } = useTranslation();

  const contentSide =
    variant === "settings-sidebar"
      ? isMobile
        ? "bottom"
        : "right"
      : isMobile
        ? "bottom"
        : "left";
  const contentAlign =
    variant === "settings-sidebar" ? "start" : isMobile ? "start" : "center";

  const contentClassName =
    variant === "settings-sidebar"
      ? "w-48"
      : cn(
          "z-[10000] rounded-lg border-border bg-surface-elevated",
          isMobile ? "w-full max-w-[calc(100vw-2rem)]" : "w-48",
        );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "settings-sidebar" ? (
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "w-full gap-2 px-3 py-2 h-10 rounded-md transition-colors text-muted-foreground hover:bg-sidebar-hover hover:text-muted-foreground",
              sidebarCollapsed ? "justify-center" : "justify-start",
            )}
            aria-label={t("nav.languageSidebar")}
          >
            <RemixIcon name="global" size="size-5" />
            {!sidebarCollapsed && (
              <>
                <span className="truncate font-medium">
                  {t("nav.languageSidebar")}
                </span>
                <RemixIcon
                  name="chevron_right"
                  size="size-5"
                  className="ml-auto shrink-0"
                />
              </>
            )}
          </Button>
        ) : (
          <button
            type="button"
            className={cn(
              "flex items-center justify-between w-full rounded-sm cursor-pointer text-foreground bg-transparent border-0",
              props.accountMenuRow.itemGap,
              props.accountMenuRow.itemPadding,
              props.accountMenuRow.itemTextSize,
              props.accountMenuRow.itemHover,
            )}
            aria-label={t("nav.languageSidebar")}
          >
            <div
              className={cn("flex items-center", props.accountMenuRow.itemGap)}
            >
              <RemixIcon name="global" size={props.accountMenuRow.iconSize} />
              <span>{t("nav.languageSidebar")}</span>
            </div>
            <RemixIcon
              name="chevron_right"
              size={props.accountMenuRow.iconSize}
              className="shrink-0"
            />
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={contentSide}
        align={contentAlign}
        className={contentClassName}
        sideOffset={variant === "account-menu" && isMobile ? 4 : undefined}
        collisionPadding={variant === "account-menu" ? 16 : undefined}
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => {
              onLanguageChange(lang.code);
            }}
            className={cn(
              "flex items-center gap-2 cursor-pointer",
              currentLang === lang.code && "bg-primary/10 text-primary",
            )}
          >
            <span className="flex-1">{lang.name}</span>
            {currentLang === lang.code && (
              <div className="size-2 bg-primary rounded-full shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
