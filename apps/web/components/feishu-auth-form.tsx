"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@alloomi/ui";
import { Button, Input, Label } from "@alloomi/ui";
import { RemixIcon } from "@/components/remix-icon";
import { createIntegrationAccount } from "@/lib/integration/client";
import { FeishuStepsDialog } from "@/components/feishu-steps-dialog";
import { FeishuConnectSuccessAlert } from "@/components/feishu-connect-success-alert";
import { getAuthToken } from "@/lib/auth/token-manager";
import { getHomePath } from "@/lib/utils";

type AuthStatus = "idle" | "connecting" | "completed" | "error";

interface FeishuAuthFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  /** When true, renders form content inline without the Dialog wrapper */
  embedded?: boolean;
}

/**
 * Feishu authorization form.
 * Supports standalone dialog mode (default) and embedded inline mode.
 */
export function FeishuAuthForm({
  isOpen,
  onClose,
  onSuccess,
  embedded = false,
}: FeishuAuthFormProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [appId, setAppId] = useState("");
  const [appSecret, setAppSecret] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [successAlertOpen, setSuccessAlertOpen] = useState(false);

  const resetState = useCallback(() => {
    setStatus("idle");
    setAppId("");
    setAppSecret("");
    setDisplayName("");
    setErrorMessage(null);
    setSuccessAlertOpen(false);
  }, []);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [status, resetState, onClose]);

  const handleConnect = useCallback(async () => {
    const trimmedAppId = appId.trim();
    const trimmedSecret = appSecret.trim();
    if (!trimmedAppId || !trimmedSecret) {
      setErrorMessage(
        t(
          "auth.feishuAppIdSecretRequired",
          "Please fill in App ID and App Secret",
        ),
      );
      return;
    }

    setStatus("connecting");
    setErrorMessage(null);

    try {
      const name =
        displayName.trim() || `Feishu · ${trimmedAppId.slice(0, 12)}`;
      await createIntegrationAccount({
        platform: "feishu",
        externalId: trimmedAppId,
        displayName: name,
        credentials: {
          appId: trimmedAppId,
          appSecret: trimmedSecret,
        },
        bot: {
          name,
          description: t(
            "auth.feishuBotDescription",
            "Chat with Alloomi via Feishu",
          ),
          adapter: "feishu",
          enable: true,
        },
      });

      setStatus("completed");

      // Start Feishu WebSocket listener (pass cloud auth token in Tauri for AI authentication of incoming messages)
      try {
        const cloudAuthToken =
          typeof window !== "undefined" ? getAuthToken() : null;
        const response = await fetch("/api/feishu/listener/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cloudAuthToken ? { cloudAuthToken } : {}),
        });
        if (response.ok) {
          console.log("[Feishu] Listener initialized successfully");
        }
      } catch (e) {
        console.warn("[Feishu] Listener error:", e);
      }

      setSuccessAlertOpen(true);
    } catch (error) {
      setStatus("error");
      const msg =
        error instanceof Error ? error.message : t("common.operationFailed");
      setErrorMessage(msg);
    }
  }, [appId, appSecret, displayName, t]);

  const handleFeishuSuccessConfirm = useCallback(() => {
    router.push(getHomePath());
    router.refresh();
    handleClose();
    onSuccess?.();
  }, [router, handleClose, onSuccess]);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleClose();
      }
    },
    [handleClose],
  );

  const formBody = (
    <>
      <p className="text-sm text-muted-foreground">
        {t(
          "auth.feishuDescription",
          "Create an enterprise self-built app on Feishu Open Platform and enable bot capability, select Use long connection to receive events and subscribe to im.message.receive_v1, fill in the credentials below to chat with Alloomi.",
        )}
      </p>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="feishu-app-id">
            {t("auth.feishuAppId", "App ID")}
          </Label>
          <Input
            id="feishu-app-id"
            placeholder="cli_xxxxxxxxxx"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
            disabled={status === "connecting"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feishu-app-secret">
            {t("auth.feishuAppSecret", "App Secret")}
          </Label>
          <Input
            id="feishu-app-secret"
            type="password"
            placeholder="••••••••••••••••"
            value={appSecret}
            onChange={(e) => setAppSecret(e.target.value)}
            disabled={status === "connecting"}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="feishu-display-name">
            {t("auth.feishuDisplayName", "Display name (optional)")}
          </Label>
          <Input
            id="feishu-display-name"
            placeholder={t("auth.feishuDisplayNamePlaceholder", "My Feishu")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={status === "connecting"}
          />
        </div>
        {errorMessage && (
          <p className="text-sm text-destructive">{errorMessage}</p>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setStepsOpen(true)}
          disabled={status === "connecting"}
          className="border-[#3370FF] text-[#3370FF] hover:bg-[#3370FF]/10"
        >
          {t("auth.feishuStepsLink", "Setup steps")}
        </Button>
        {!embedded && (
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={status === "connecting"}
          >
            {t("common.cancel", "Cancel")}
          </Button>
        )}
        <Button
          onClick={handleConnect}
          disabled={status === "connecting"}
          className="bg-[#3370FF] hover:bg-[#2860E6]"
        >
          {status === "connecting"
            ? t("auth.connecting", "Connecting...")
            : t("auth.feishuConnect", "Connect Feishu")}
        </Button>
      </div>
    </>
  );

  if (embedded) {
    return (
      <>
        {formBody}
        <FeishuStepsDialog open={stepsOpen} onOpenChange={setStepsOpen} />
        <FeishuConnectSuccessAlert
          open={successAlertOpen}
          onOpenChange={setSuccessAlertOpen}
          onConfirm={handleFeishuSuccessConfirm}
        />
      </>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogContent
          className="z-[1010] sm:max-w-md overflow-hidden max-h-[90vh] overflow-y-auto"
          overlayClassName="z-[1009]"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RemixIcon name="chat-smile" className="h-5 w-5 text-[#3370FF]" />
              {t("auth.feishuTitle", "Connect Feishu")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "auth.feishuDescription",
                "Create an enterprise self-built app on Feishu Open Platform and enable bot capability, select Use long connection to receive events and subscribe to im.message.receive_v1, fill in the credentials below to chat with Alloomi.",
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feishu-app-id">
                {t("auth.feishuAppId", "App ID")}
              </Label>
              <Input
                id="feishu-app-id"
                placeholder="cli_xxxxxxxxxx"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
                disabled={status === "connecting"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feishu-app-secret">
                {t("auth.feishuAppSecret", "App Secret")}
              </Label>
              <Input
                id="feishu-app-secret"
                type="password"
                placeholder="••••••••••••••••"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                disabled={status === "connecting"}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="feishu-display-name">
                {t("auth.feishuDisplayName", "Display name (optional)")}
              </Label>
              <Input
                id="feishu-display-name"
                placeholder={t(
                  "auth.feishuDisplayNamePlaceholder",
                  "My Feishu",
                )}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={status === "connecting"}
              />
            </div>
            {errorMessage && (
              <p className="text-sm text-destructive">{errorMessage}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setStepsOpen(true)}
              disabled={status === "connecting"}
              className="border-[#3370FF] text-[#3370FF] hover:bg-[#3370FF]/10"
            >
              {t("auth.feishuStepsLink", "Setup steps")}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={status === "connecting"}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleConnect}
              disabled={status === "connecting"}
              className="bg-[#3370FF] hover:bg-[#2860E6]"
            >
              {status === "connecting"
                ? t("auth.connecting", "Connecting...")
                : t("auth.feishuConnect", "Connect Feishu")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FeishuStepsDialog open={stepsOpen} onOpenChange={setStepsOpen} />
      <FeishuConnectSuccessAlert
        open={successAlertOpen}
        onOpenChange={setSuccessAlertOpen}
        onConfirm={handleFeishuSuccessConfirm}
      />
    </>
  );
}
