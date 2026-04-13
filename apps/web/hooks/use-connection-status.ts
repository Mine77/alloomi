"use client";

import { useMemo } from "react";
import type { TgUserInfo } from "@/lib/integration/sources/telegram";
import { useIntegrations } from "./use-integrations";

export interface ConnectionStatus {
  id: string;
  icon: string;
  label: string;
  connected: boolean;
  detail?: string;
}

type DiscordUserInfo = {
  name?: string | null;
  email?: string | null;
};

type PlatformConfig = {
  id: ConnectionStatus["id"];
  icon: string;
  label: string;
};

const PLATFORM_CONFIGS: PlatformConfig[] = [
  { id: "slack", icon: "/images/slack.svg", label: "Slack" },
  { id: "telegram", icon: "/images/telegram.svg", label: "Telegram" },
  { id: "discord", icon: "/images/discord.svg", label: "Discord" },
  { id: "gmail", icon: "/images/gmail.svg", label: "Gmail" },
  { id: "whatsapp", icon: "/images/whatsapp.svg", label: "WhatsApp" },
  { id: "teams", icon: "/images/teams.svg", label: "Microsoft Teams" },
];

export function summarizeAccounts(
  displayNameList: string[],
  totalCount: number,
): string | undefined {
  if (displayNameList.length === 0 || totalCount === 0) {
    return undefined;
  }
  const primary = displayNameList[0];
  if (totalCount === 1) {
    return primary;
  }
  return `${primary} +${totalCount - 1}`;
}

export function summarizeTelegramUser(
  userInfo: TgUserInfo | null,
): string | undefined {
  if (!userInfo) return undefined;
  const names: string[] = [];

  if (userInfo.userName) {
    names.push(userInfo.userName);
  }

  const fullName = [userInfo.firstName, userInfo.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName.length > 0) {
    names.push(fullName);
  }

  return names[0];
}

export function useConnectionStatus() {
  const { groupedByIntegration } = useIntegrations();

  const connections = useMemo<ConnectionStatus[]>(() => {
    return PLATFORM_CONFIGS.map((config) => {
      const accounts =
        groupedByIntegration[config.id as keyof typeof groupedByIntegration] ??
        [];
      const displayNames = accounts
        .map((account) => account.displayName)
        .filter(
          (name): name is string => typeof name === "string" && name.length > 0,
        );

      const fallbackConnected = false;
      let fallbackDetail: string | undefined;

      const connected = accounts.length > 0 || fallbackConnected;
      const detail =
        summarizeAccounts(displayNames, accounts.length) ?? fallbackDetail;

      return {
        id: config.id,
        icon: config.icon,
        label: config.label,
        connected,
        detail,
      };
    }).sort((a, b) => {
      if (a.connected === b.connected) {
        return a.label.localeCompare(b.label);
      }
      return a.connected ? -1 : 1;
    });
  }, [groupedByIntegration]);

  return {
    connections,
    hasAnyConnection: connections.some((connection) => connection.connected),
  };
}
