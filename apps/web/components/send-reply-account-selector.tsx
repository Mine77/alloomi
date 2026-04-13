import { RemixIcon } from "@/components/remix-icon";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import IntegrationIcon from "./integration-icon";
import { cn } from "@/lib/utils";

export interface AvailableAccount {
  botId: string;
  platform: string;
  accountName: string;
  botName: string;
}

interface SendReplyAccountSelectorProps {
  availableAccounts: AvailableAccount[];
  message?: string;
  onSelect?: (botId: string) => void;
  className?: string;
}

/**
 * SendReply account selector component.
 * Displays this component when the sendReply tool returns multiple available accounts for user selection.
 */
export const SendReplyAccountSelector = memo<SendReplyAccountSelectorProps>(
  ({ availableAccounts, message, onSelect, className }) => {
    const { t } = useTranslation();

    if (availableAccounts.length === 0) {
      return null;
    }

    const handleSelect = (botId: string) => {
      if (onSelect) {
        onSelect(botId);
      }
    };

    return (
      <div className={cn("w-full", className)}>
        {message && (
          <p className="text-sm text-muted-foreground mb-3">{message}</p>
        )}

        <div className="space-y-2">
          {availableAccounts.map((account) => (
            <button
              type="button"
              key={account.botId}
              onClick={() => handleSelect(account.botId)}
              className="w-full group relative flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-200 text-left"
            >
              {/* Platform Icon */}
              <div className="flex-shrink-0">
                <IntegrationIcon platform={account.platform} />
              </div>

              {/* Account Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm">
                    {account.accountName}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("sendReply.via", "via")} {account.platform}
                  </span>
                </div>
                {account.botName && account.botName !== "Unnamed" && (
                  <p className="text-xs text-muted-foreground truncate">
                    {account.botName}
                  </p>
                )}
              </div>

              {/* Selection Indicator */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                  <RemixIcon name="chevron_right" size="size-4" />
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {t("sendReply.selectAccountHint", "Select an account to continue")}
        </p>
      </div>
    );
  },
);

SendReplyAccountSelector.displayName = "SendReplyAccountSelector";

/**
 * SendReply account selection card component
 * Used to display account selection interface inline in messages
 */
export const SendReplyAccountCard = memo<SendReplyAccountSelectorProps>(
  ({ availableAccounts, message, onSelect, className }) => {
    const { t } = useTranslation();

    return (
      <div
        className={cn(
          "my-4 rounded-xl border border-border bg-muted/30 p-4",
          className,
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <RemixIcon name="check" size="size-4" className="text-primary" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">
              {t("sendReply.selectAccountTitle", "Select Account")}
            </h4>
            <p className="text-xs text-muted-foreground">
              {t(
                "sendReply.selectAccountSubtitle",
                "Choose which account to use for sending",
              )}
            </p>
          </div>
        </div>

        <SendReplyAccountSelector
          availableAccounts={availableAccounts}
          message={message}
          onSelect={onSelect}
        />
      </div>
    );
  },
);

SendReplyAccountCard.displayName = "SendReplyAccountCard";
