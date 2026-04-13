"use client";

import { Suspense } from "react";
import { DiscordLinker } from "@/components/discord-linker";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";

function DiscordLoginContent() {
  const { t } = useTranslation();

  const searchParams = useSearchParams();
  const rawToken = searchParams.get("token");
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  if (!token || token.trim().length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold">
            {t("discord.missingTokenTitle")}
          </h1>
          <p className="mt-4 text-muted-foreground">
            {t("discord.missingTokenDesc")}
          </p>
        </div>
      </div>
    );
  }

  const supportLink = process.env.MARKETING_SUPPORT_URL ?? "/support";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <DiscordLinker token={token} supportLink={supportLink} />
    </div>
  );
}

export default function DiscordLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          Loading...
        </div>
      }
    >
      <DiscordLoginContent />
    </Suspense>
  );
}
