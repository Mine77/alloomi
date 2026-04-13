"use client";

import { useState } from "react";
import { PageSectionHeader } from "@alloomi/ui";
import { Button } from "@alloomi/ui";
import { PersonalizationLinkedAccounts } from "@/components/personalization/personalization-linked-accounts";
import { useTranslation } from "react-i18next";
import "../../../i18n";

/**
 * Standalone Connectors page: manage linked platforms and RSS (moved out of Personalization dialog).
 * URL `?addPlatform=true` opens the add-platform flow via PlatformIntegrations.
 */
export default function ConnectorsPage() {
  const { t } = useTranslation();
  const [isAddConnectorDialogOpen, setIsAddConnectorDialogOpen] =
    useState(false);

  return (
    <div className="flex h-full min-h-0 min-h-[60vh] flex-1 flex-col">
      <PageSectionHeader
        title={t("nav.connectors", "Connectors")}
        description={t(
          "connectors.pageDescription",
          "Link your platforms or subscribe to content you care about — Alloomi keeps watch so you don't have to.",
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsAddConnectorDialogOpen(true)}
          className="gap-1.5"
        >
          <i className="ri-add-line" />
          {t("integrations.addConnector", "Add connector")}
        </Button>
      </PageSectionHeader>
      <div className="min-h-0 flex-1 overflow-hidden">
        <PersonalizationLinkedAccounts
          open={true}
          isAddConnectorDialogOpen={isAddConnectorDialogOpen}
          onAddConnectorDialogOpenChange={setIsAddConnectorDialogOpen}
        />
      </div>
    </div>
  );
}
