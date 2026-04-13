"use client";

/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import { useTranslation } from "react-i18next";
import { RemixIcon } from "@/components/remix-icon";
import type { IntegrationId } from "@/hooks/use-integrations";

export interface IntegrationPlatformCardProps {
  /** Integration platform unique identifier */
  platformId: IntegrationId;
  /** Platform name */
  label: string;
  /** Brief summary of connected accounts */
  summary: string | null;
  /** Whether in linking state */
  isLinking: boolean;
  /** Whether the connect button is disabled (e.g. Coming soon) */
  disabled?: boolean;
  /** Platform connection logic triggered when right button is clicked */
  onConnect: () => void | Promise<void>;
}

/**
 * Integration platform card component
 * The entire card is a clickable hotspot, uniformly displaying platform logo, name and “Add” icon on hover
 */
export function IntegrationPlatformCard({
  platformId,
  label,
  summary,
  isLinking,
  disabled,
  onConnect,
}: IntegrationPlatformCardProps) {
  const { t } = useTranslation();
  const logoSrc = resolvePlatformLogo(platformId);
  const isDisabled = isLinking || disabled;

  const handleClick = () => {
    if (!isDisabled) void onConnect();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !isDisabled) {
      e.preventDefault();
      void onConnect();
    }
  };

  return (
    <div
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-disabled={isDisabled}
      data-disabled={isDisabled || undefined}
      aria-label={
        isLinking
          ? t("integrations.platformCardAriaConnecting")
          : t("integrations.platformCardAriaConnect", { label })
      }
      className="group flex cursor-pointer items-stretch rounded-xl border border-[#e5e5e5] bg-white hover:bg-[#f5f5f5] transition-colors data-[disabled]:cursor-not-allowed"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex flex-1 items-center gap-4 sm:gap-4 pl-4 pr-0 py-2">
        <div className="flex items-center justify-center shrink-0">
          {logoSrc ? (
            <Image
              src={logoSrc}
              alt={label}
              width={40}
              height={40}
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
          ) : (
            <RemixIcon
              name="apps"
              size="size-5"
              className="sm:!text-[1.5rem] text-[#37352f]"
            />
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center">
          <span className="text-sm font-serif font-semibold text-[#37352f]">
            {label}
          </span>
        </div>
      </div>

      <div className="flex items-center pr-3 sm:pr-4 pointer-events-none">
        <span
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
          aria-hidden
        >
          {isLinking ? (
            <RemixIcon name="loader_2" size="size-4" className="animate-spin" />
          ) : (
            <RemixIcon name="add" size="size-4" />
          )}
        </span>
      </div>
    </div>
  );
}

/**
 * Resolve static logo resource path based on platform identifier
 * Prefers real brand logos, falls back to default icon when not available
 */
export function resolvePlatformLogo(platformId: IntegrationId): string | null {
  const map: Partial<Record<IntegrationId, string>> = {
    slack: "/images/apps/slack.png",
    telegram: "/images/apps/telegram.png",
    discord: "/images/apps/discord.png",
    whatsapp: "/images/apps/whatsapp.png",
    gmail: "/images/apps/gmail.png",
    outlook: "/images/apps/outlook.png",
    imessage: "/images/apps/iMessage.png",
    hubspot: "/images/apps/hubspot.png",
    asana: "/images/apps/asana.png",
    jira: "/images/apps/jira.png",
    linear: "/images/apps/linear.png",
    google_docs: "/images/apps/google_docs.png",
    google_drive: "/images/apps/google_drive.png",
    google_calendar: "/images/apps/google_calendar.png",
    linkedin: "/images/apps/linkedin.png",
    facebook_messenger: "/images/apps/facebook_messenger.png",
    teams: "/images/apps/teams.png",
    notion: "/images/apps/notion.png",
    github: "/images/apps/github.png",
    twitter: "/images/apps/twitter.png",
    instagram: "/images/apps/Instagram.png",
    outlook_calendar: "/images/apps/outlook_calendar.png",
    feishu: "/images/apps/feishu.png",
    dingtalk: "/images/apps/DingTalk.png",
    qqbot: "/images/apps/qq.png",
    weixin: "/images/apps/WeChat.png",
  };

  return map[platformId] ?? null;
}
