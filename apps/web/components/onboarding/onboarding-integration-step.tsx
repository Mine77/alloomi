"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "@alloomi/ui";
import { useIntegrations, type IntegrationId } from "@/hooks/use-integrations";
import { useTelegramTokenForm } from "@/components/platform-integrations";
import { TelegramTokenForm } from "@/components/telegram-token-form";
import { openUrl } from "@/lib/tauri";
import {
  GoogleAuthForm,
  type GoogleAuthSubmission,
} from "@/components/google-auth";
import {
  WhatsAppAuthForm,
  type WhatsAppUserInfo,
} from "@/components/whatsapp-auth";
import {
  OutlookAuthForm,
  type OutlookAuthSubmission,
} from "@/components/outlook-auth";
import {
  MessengerAuthForm,
  type MessengerAuthSubmission,
} from "@/components/messenger-auth-form";
import { IMessageAuthForm } from "@/components/imessage-auth-form";
import { useIsMobile } from "@alloomi/hooks/use-is-mobile";
import { createIntegrationAccount } from "@/lib/integration/client";
import { toast } from "@/components/toast";
import {
  getSlackAuthorizationUrl,
  getDiscordAuthorizationUrl,
  getTeamsAuthorizationUrl,
  getHubspotAuthorizationUrl,
  getJiraAuthorizationUrl,
  getLinearAuthorizationUrl,
} from "@/lib/integration";
import { OnboardingStepLayout } from "./onboarding-step-layout";
import { getAuthToken } from "@/lib/auth/token-manager";

/**
 * Onboarding integration step component props
 */
interface OnboardingIntegrationStepProps {
  /** AI assistant name */
  digitalTwinName: string;
  /** Complete handler function */
  onComplete: () => void;
  /** Skip handler function (optional) */
  onSkip?: () => void;
  /** Back handler function (optional) */
  onBack?: () => void;
  /** Whether submitting */
  isSubmitting?: boolean;
}

/**
 * Platform definition type
 */
type PlatformDefinition = {
  id: IntegrationId;
  label: string;
  logoSrc: string;
  onConnect: () => void | Promise<void>;
  disable?: boolean;
};

/**
 * Onboarding integration step component
 * Displays platform authorization interface, allows users to authorize supported platforms
 */
export function OnboardingIntegrationStep({
  digitalTwinName: _digitalTwinName,
  onComplete,
  onSkip,
  onBack,
  isSubmitting = false,
}: OnboardingIntegrationStepProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const { accounts, groupedByIntegration, mutate } = useIntegrations();
  const [linkingPlatform, setLinkingPlatform] = useState<IntegrationId | null>(
    null,
  );
  const {
    showTelegramTokenForm,
    hideTelegramTokenForm,
    telegramReconnectAccountId,
    isTelegramTokenFormOpen,
  } = useTelegramTokenForm();
  const [isGoogleAuthFormOpen, setIsGoogleAuthFormOpen] = useState(false);
  const [isWhatsAppAuthFormOpen, setIsWhatsAppAuthFormOpen] = useState(false);
  const [isOutlookAuthFormOpen, setIsOutlookAuthFormOpen] = useState(false);
  const [isMessengerAuthFormOpen, setIsMessengerAuthFormOpen] = useState(false);
  const [isIMessageAuthFormOpen, setIsIMessageAuthFormOpen] = useState(false);
  const [isLinkingWhatsApp, setIsLinkingWhatsApp] = useState(false);
  const hubspotEnabled = process.env.NEXT_PUBLIC_HUBSPOT_ENABLED === "true";
  const googleDocsEnabled =
    process.env.NEXT_PUBLIC_GOOGLE_DOCS_ENABLED === "true";
  const outlookCalendarEnabled =
    process.env.NEXT_PUBLIC_OUTLOOK_CALENDAR_ENABLED === "true";

  /**
   * Build platform definitions
   * Contains configuration and connection logic for all available platforms
   */
  const platformDefs = useMemo<
    Partial<Record<IntegrationId, PlatformDefinition>>
  >(() => {
    /**
     * Slack platform connection handler
     * Opens authorization page in new tab
     */
    const slackConnect = async () => {
      setLinkingPlatform("slack");
      try {
        const authorizationUrl = await getSlackAuthorizationUrl();
        openUrl(authorizationUrl);
      } catch (error) {
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("common.operationFailed", "Operation failed"),
        });
      } finally {
        setLinkingPlatform(null);
      }
    };

    /**
     * Microsoft Teams platform connection handler
     * Opens authorization page in new tab
     */
    const teamsConnect = async () => {
      setLinkingPlatform("teams");
      try {
        const authorizationUrl = await getTeamsAuthorizationUrl();
        openUrl(authorizationUrl);
      } catch (error) {
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("common.operationFailed", "Operation failed"),
        });
      } finally {
        setLinkingPlatform(null);
      }
    };

    /**
     * Discord platform connection handler
     * Opens authorization page in new tab
     */
    const discordConnect = async () => {
      setLinkingPlatform("discord");
      try {
        const authorizationUrl = await getDiscordAuthorizationUrl();
        openUrl(authorizationUrl);
      } catch (error) {
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("common.operationFailed", "Operation failed"),
        });
      } finally {
        setLinkingPlatform(null);
      }
    };

    /**
     * Telegram platform connection handler
     * Opens Telegram Token form dialog
     */
    const telegramConnect = () => {
      showTelegramTokenForm();
    };

    /**
     * Gmail platform connection handler
     * Opens Gmail authorization form dialog
     */
    const gmailConnect = () => {
      setIsGoogleAuthFormOpen(true);
    };

    /**
     * Outlook platform connection handler
     * Opens Outlook authorization form dialog
     */
    const outlookConnect = () => {
      setLinkingPlatform("outlook");
      setIsOutlookAuthFormOpen(true);
    };

    const googleDocsConnect = () => {
      setLinkingPlatform("google_docs");
      if (typeof window !== "undefined") {
        openUrl("/api/google-docs/oauth");
      }
      setLinkingPlatform(null);
    };

    /**
     * Google Drive platform connection handler
     * Opens authorization page in new tab
     */
    const googleDriveConnect = () => {
      setLinkingPlatform("google_drive");
      if (typeof window !== "undefined") {
        openUrl("/api/google-drive/oauth");
      }
      setLinkingPlatform(null);
    };

    const googleCalendarConnect = () => {
      setLinkingPlatform("google_calendar");
      if (typeof window !== "undefined") {
        openUrl("/api/google-calendar/oauth");
      }
      setLinkingPlatform(null);
    };

    const outlookCalendarConnect = () => {
      setLinkingPlatform("outlook_calendar");
      if (typeof window !== "undefined") {
        openUrl("/api/outlook-calendar/oauth");
      }
      setLinkingPlatform(null);
    };

    const notionConnect = () => {
      setLinkingPlatform("notion");
      if (typeof window !== "undefined") {
        openUrl("/api/notion/oauth");
      }
      setLinkingPlatform(null);
    };

    const githubConnect = () => {
      setLinkingPlatform("github");
      if (typeof window !== "undefined") {
        openUrl("/api/github/oauth");
      }
      setLinkingPlatform(null);
    };

    const hubspotConnect = async () => {
      setLinkingPlatform("hubspot");
      try {
        const authorizationUrl = await getHubspotAuthorizationUrl();
        openUrl(authorizationUrl);
      } catch (error) {
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("common.operationFailed", "Operation failed"),
        });
      } finally {
        setLinkingPlatform(null);
      }
    };

    const asanaConnect = () => {
      setLinkingPlatform("asana");
      if (typeof window !== "undefined") {
        openUrl("/api/asana/oauth");
      }
      setLinkingPlatform(null);
    };

    const jiraConnect = async () => {
      setLinkingPlatform("jira");
      try {
        const authorizationUrl = await getJiraAuthorizationUrl();
        openUrl(authorizationUrl);
      } catch (error) {
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("common.operationFailed", "Operation failed"),
        });
      } finally {
        setLinkingPlatform(null);
      }
    };

    const linearConnect = async () => {
      setLinkingPlatform("linear");
      try {
        const authorizationUrl = await getLinearAuthorizationUrl();
        openUrl(authorizationUrl);
      } catch (error) {
        toast({
          type: "error",
          description:
            error instanceof Error
              ? error.message
              : t("common.operationFailed", "Operation failed"),
        });
      } finally {
        setLinkingPlatform(null);
      }
    };

    /**
     * WhatsApp platform connection handler
     * Opens WhatsApp authorization form dialog
     */
    const whatsappConnect = () => {
      setIsWhatsAppAuthFormOpen(true);
    };

    /**
     * Facebook Messenger platform connection handler
     * Opens Messenger authorization form dialog
     */
    const messengerConnect = () => {
      setLinkingPlatform("facebook_messenger");
      setIsMessengerAuthFormOpen(true);
    };

    /**
     * iMessage platform connection handler
     * Opens iMessage authorization form dialog
     */
    const imessageConnect = () => {
      setIsIMessageAuthFormOpen(true);
    };

    return {
      telegram: {
        id: "telegram",
        label: "Telegram",
        logoSrc: "/images/telegram.svg",
        onConnect: telegramConnect,
      },
      whatsapp: {
        id: "whatsapp",
        label: "WhatsApp",
        logoSrc: "/images/whatsapp.svg",
        onConnect: whatsappConnect,
      },
      imessage: {
        id: "imessage",
        label: "iMessage",
        logoSrc: "/images/imessage.svg",
        onConnect: imessageConnect,
      },
      gmail: {
        id: "gmail",
        label: "Gmail",
        logoSrc: "/images/gmail.svg",
        onConnect: gmailConnect,
      },
      slack: {
        id: "slack",
        label: "Slack",
        logoSrc: "/images/slack.svg",
        onConnect: slackConnect,
      },
      discord: {
        id: "discord",
        label: "Discord",
        logoSrc: "/images/discord.svg",
        onConnect: discordConnect,
      },
      outlook: {
        id: "outlook",
        label: "Outlook",
        logoSrc: "/images/outlook.svg",
        onConnect: outlookConnect,
      },
      google_drive: {
        id: "google_drive",
        label: "Google Drive",
        logoSrc: "/images/google-drive.svg",
        onConnect: googleDriveConnect,
        disable: true,
      },
      github: {
        id: "github",
        label: "GitHub",
        logoSrc: "/images/github.svg",
        onConnect: githubConnect,
        disable: true,
      },
      google_docs: {
        id: "google_docs",
        label: "Google Docs",
        logoSrc: "/images/google-docs.svg",
        onConnect: googleDocsConnect,
        disable: !googleDocsEnabled,
      },
      outlook_calendar: {
        id: "outlook_calendar",
        label: "Outlook Calendar",
        logoSrc: "/images/outlook.svg",
        onConnect: outlookCalendarConnect,
        disable: !outlookCalendarEnabled,
      },
      hubspot: {
        id: "hubspot",
        label: "HubSpot",
        logoSrc: "/images/hubspot.svg",
        onConnect: hubspotConnect,
        disable: !hubspotEnabled,
      },
      linkedin: {
        id: "linkedin",
        label: "LinkedIn",
        logoSrc: "/images/linkedin.svg",
        onConnect: () => {
          if (typeof window !== "undefined") {
            openUrl("/api/linkedin/oauth");
          }
        },
        disable: true,
      },
      twitter: {
        id: "twitter",
        label: "X (Twitter)",
        logoSrc: "/images/x.svg",
        onConnect: () => {
          if (typeof window !== "undefined") {
            openUrl("/api/x/oauth");
          }
        },
        disable: true,
      },
      instagram: {
        id: "instagram",
        label: "Instagram",
        logoSrc: "/images/instagram.svg",
        onConnect: () => {
          if (typeof window !== "undefined") {
            openUrl("/api/instagram/oauth");
          }
        },
        disable: true,
      },
      facebook_messenger: {
        id: "facebook_messenger",
        label: "Facebook Messenger",
        logoSrc: "/images/facebook-messenger.svg",
        onConnect: messengerConnect,
        disable: true,
      },
      google_calendar: {
        id: "google_calendar",
        label: "Google Calendar",
        logoSrc: "/images/google-calendar.svg",
        onConnect: googleCalendarConnect,
        disable: true,
      },
      notion: {
        id: "notion",
        label: "Notion",
        logoSrc: "/images/notion.svg",
        onConnect: notionConnect,
        disable: true,
      },
      teams: {
        id: "teams",
        label: "Microsoft Teams",
        logoSrc: "/images/teams.svg",
        onConnect: teamsConnect,
        disable: true,
      },
      asana: {
        id: "asana",
        label: "Asana",
        logoSrc: "/images/asana.svg",
        onConnect: asanaConnect,
        disable: true,
      },
      jira: {
        id: "jira",
        label: "Jira",
        logoSrc: "/images/jira.svg",
        onConnect: jiraConnect,
        disable: true,
      },
      linear: {
        id: "linear",
        label: "Linear",
        logoSrc: "/images/linear.svg",
        onConnect: linearConnect,
        disable: true,
      },
    };
  }, [t, hubspotEnabled, googleDocsEnabled, outlookCalendarEnabled]);

  const platformIds = useMemo(
    () => Object.keys(platformDefs) as IntegrationId[],
    [platformDefs],
  );

  /**
   * Handle Google authorization submission
   */
  const handleGoogleSubmit = useCallback(
    async ({ email, appPassword, name }: GoogleAuthSubmission) => {
      const account = await createIntegrationAccount({
        platform: "gmail",
        externalId: email,
        displayName: name ?? email,
        credentials: {
          email,
          appPassword,
        },
        metadata: {
          email,
          name: name ?? email,
        },
        bot: {
          name: `Gmail · ${name ?? email}`,
          description: "Automatically created through Gmail authorization",
          adapter: "gmail",
          enable: true,
        },
      });

      await mutate();

      // Initialize Gmail Self Message Listener
      try {
        const cloudAuthToken = getAuthToken() || undefined;
        const response = await fetch("/api/gmail/init-self-listener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            cloudAuthToken ? { authToken: cloudAuthToken } : {},
          ),
        });
        if (response.ok) {
          console.log("[Gmail] Self Message Listener initialized successfully");
        }
      } catch (error) {
        console.error(
          "[Gmail] Failed to initialize Self Message Listener:",
          error,
        );
      }

      setIsGoogleAuthFormOpen(false);
      toast({
        type: "success",
        description: t("auth.gmailLogin", "Gmail connected successfully"),
      });
    },
    [mutate, t],
  );

  const handleOutlookSubmit = useCallback(
    async ({ email, appPassword, name }: OutlookAuthSubmission) => {
      try {
        const account = await createIntegrationAccount({
          platform: "outlook",
          externalId: email,
          displayName: name ?? email,
          credentials: {
            email,
            appPassword,
          },
          metadata: {
            email,
            name: name ?? email,
          },
          bot: {
            name: `Outlook · ${name ?? email}`,
            description: "Automatically created through Outlook authorization",
            adapter: "outlook",
            enable: true,
            adapterConfig: {
              IMAP_HOST: "outlook.office365.com",
              IMAP_PORT: 993,
              SMTP_HOST: "smtp.office365.com",
              SMTP_PORT: 587,
            },
          },
        });

        await mutate();
        setIsOutlookAuthFormOpen(false);
        setLinkingPlatform(null);
        toast({
          type: "success",
          description: t("auth.outlookLogin", "Outlook connected successfully"),
        });
      } finally {
        setIsOutlookAuthFormOpen(false);
        setLinkingPlatform(null);
      }
    },
    [mutate, t],
  );

  /**
   * Handle WhatsApp authorization success
   */
  const handleWhatsAppSuccess = useCallback(
    async (sessionKey: string, user: WhatsAppUserInfo) => {
      try {
        const account = await createIntegrationAccount({
          platform: "whatsapp",
          externalId: user.wid ?? sessionKey,
          displayName:
            user.pushName ?? user.formattedNumber ?? user.wid ?? "WhatsApp",
          credentials: {
            sessionKey, // Only store the session key, user info is in metadata
          },
          metadata: {
            wid: user.wid,
            pushName: user.pushName ?? null,
            formattedNumber: user.formattedNumber ?? null,
          },
          bot: {
            name: `WhatsApp · ${user.pushName ?? user.formattedNumber ?? user.wid ?? sessionKey}`,
            description: "Automatically created through WhatsApp authorization",
            adapter: "whatsapp",
            enable: true,
          },
        });

        await mutate();

        // Initialize WhatsApp Self Message Listener
        try {
          const cloudAuthToken = getAuthToken() || undefined;
          const response = await fetch("/api/whatsapp/init-self-listener", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              cloudAuthToken ? { authToken: cloudAuthToken } : {},
            ),
          });
          if (response.ok) {
            console.log(
              "[WhatsApp] Self Message Listener initialized successfully",
            );
          }
        } catch (error) {
          console.error(
            "[WhatsApp] Failed to initialize Self Message Listener:",
            error,
          );
        }

        setIsWhatsAppAuthFormOpen(false);
        toast({
          type: "success",
          description: t(
            "auth.whatsappLogin",
            "WhatsApp connected successfully",
          ),
        });
      } finally {
        setIsLinkingWhatsApp(false);
        setIsWhatsAppAuthFormOpen(false);
      }
    },
    [mutate, t],
  );

  const handleMessengerSubmit = useCallback(
    async ({
      pageId,
      pageAccessToken,
      pageName,
      appId,
      appSecret,
      verifyToken,
    }: MessengerAuthSubmission) => {
      try {
        const account = await createIntegrationAccount({
          platform: "facebook_messenger",
          externalId: pageId,
          displayName: pageName ?? `Messenger · ${pageId}`,
          credentials: {
            pageId,
            pageAccessToken,
            pageName,
            appId,
            appSecret,
            verifyToken,
          },
          metadata: {
            pageId,
            pageName: pageName ?? null,
            appId: appId ?? null,
            platform: "facebook_messenger",
          },
          bot: {
            name: `Messenger · ${pageName ?? pageId}`,
            description:
              "Automatically created through Facebook Messenger authorization",
            adapter: "facebook_messenger",
            adapterConfig: { pageId },
            enable: true,
          },
        });

        await mutate();
        setIsMessengerAuthFormOpen(false);
        setLinkingPlatform(null);
        toast({
          type: "success",
          description: t(
            "auth.messengerSuccess",
            "Messenger connected successfully",
          ),
        });
      } finally {
        setIsMessengerAuthFormOpen(false);
        setLinkingPlatform(null);
      }
    },
    [mutate, t],
  );

  /**
   * Check if there are any connected platforms
   */
  const hasConnectedPlatforms = useMemo(() => {
    return accounts.length > 0;
  }, [accounts]);
  const connectedCount = accounts.length;

  /**
   * Handle complete button click
   * If there are connected platforms, complete directly; otherwise prompt user to connect at least one platform
   */
  const handleComplete = () => {
    if (hasConnectedPlatforms) {
      onComplete();
    } else {
      // Can show prompt, but here we allow user to skip
      if (onSkip) {
        onSkip();
      } else {
        onComplete();
      }
    }
  };

  return (
    <>
      <OnboardingStepLayout
        title={t(
          "onboarding.integration.title",
          "Connect platforms, unlock deeper insights",
        )}
        subtitle={t("onboarding.integration.subtitle")}
        showBack={!!onBack}
        onBack={onBack}
        actionButtonText={t("onboarding.integration.next", "Next")}
        onAction={handleComplete}
        actionButtonDisabled={
          (!hasConnectedPlatforms && !onSkip) || isSubmitting
        }
        skipButtonText={
          onSkip ? t("onboarding.integration.skip", "Skip for now") : undefined
        }
        onSkip={onSkip}
        isSubmitting={isSubmitting}
        submittingText={t(
          "onboarding.painPoints.generating",
          "Generating your avatar...",
        )}
        contentClassName="flex flex-1 flex-col gap-8 items-center"
      >
        {/* Platform list */}
        <div className="flex flex-1 w-full flex-col justify-center items-center">
          <div className="grid w-full grid-cols-1 gap-6 px-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {platformIds.map((platformId) => {
              const definition = platformDefs[platformId];
              if (!definition) {
                return <></>;
              }
              const accountsForPlatform =
                groupedByIntegration[platformId] || [];
              const isLinking = linkingPlatform === platformId;
              const isConnected = accountsForPlatform.length > 0;

              return (
                <div
                  key={platformId}
                  className="flex w-full max-w-[400px] flex-col items-center rounded-2xl border border-[#e5e5e5] bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md mx-auto"
                >
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f5f5f5]">
                    <Image
                      src={definition.logoSrc}
                      alt={`${definition.label} logo`}
                      width={32}
                      height={32}
                      className="h-8 w-8 object-contain"
                    />
                  </div>

                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-semibold text-[#37352f]">
                      {definition.label}
                    </span>
                    {isConnected && (
                      <RemixIcon
                        name="circle_check"
                        size="size-4"
                        className="text-green-600"
                      />
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void definition.onConnect();
                    }}
                    className="w-full"
                    disabled={isLinking || isConnected || definition?.disable}
                    size="sm"
                  >
                    {isLinking ? (
                      <>
                        <RemixIcon
                          name="loader_2"
                          size="size-4"
                          className="animate-spin sm:mr-2"
                        />
                        <span className="hidden sm:inline">
                          {t("common.processing")}
                        </span>
                      </>
                    ) : isConnected ? (
                      <>
                        <RemixIcon
                          name="circle_check"
                          size="size-4"
                          className="sm:mr-2"
                        />
                        <span className="hidden sm:inline">
                          {t("common.connected", "Connected")}
                        </span>
                      </>
                    ) : (
                      <>
                        <RemixIcon
                          name="add"
                          size="size-4"
                          className="sm:mr-2"
                        />
                        <span className="hidden sm:inline">
                          {definition?.disable
                            ? t("common.comingSoon")
                            : t("common.connect")}
                        </span>
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          {/* Privacy tips */}
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
            <h4 className="text-sm font-semibold mb-2">
              {t("onboarding.integration.privacyTipsTitle")}
            </h4>
            <p className="text-sm leading-relaxed whitespace-pre-line">
              {t("onboarding.integration.privacyTips")}
            </p>
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t(
              "onboarding.integration.footerNote",
              "You can go to the integration management page to authorize Alloomi to access more of your content, such as RSS feeds and file uploads.",
            )}
          </p>
        </div>
      </OnboardingStepLayout>

      {/* Telegram Token form */}
      <TelegramTokenForm
        isOpen={isTelegramTokenFormOpen}
        onClose={hideTelegramTokenForm}
        isMobile={isMobile}
        reconnectAccountId={telegramReconnectAccountId}
      />

      {/* Google authorization form */}
      <GoogleAuthForm
        isOpen={isGoogleAuthFormOpen}
        onClose={() => setIsGoogleAuthFormOpen(false)}
        onSubmit={handleGoogleSubmit}
      />

      <OutlookAuthForm
        isOpen={isOutlookAuthFormOpen}
        onClose={() => {
          setIsOutlookAuthFormOpen(false);
          setLinkingPlatform(null);
        }}
        onSubmit={handleOutlookSubmit}
      />

      {/* WhatsApp authorization form */}
      <WhatsAppAuthForm
        isOpen={isWhatsAppAuthFormOpen}
        onClose={() => setIsWhatsAppAuthFormOpen(false)}
        onSuccess={handleWhatsAppSuccess}
      />

      <MessengerAuthForm
        isOpen={isMessengerAuthFormOpen}
        onClose={() => {
          setIsMessengerAuthFormOpen(false);
          setLinkingPlatform(null);
        }}
        onSubmit={handleMessengerSubmit}
      />

      <IMessageAuthForm
        isOpen={isIMessageAuthFormOpen}
        onClose={() => setIsIMessageAuthFormOpen(false)}
        onSuccess={() => {
          mutate();
        }}
      />
    </>
  );
}
