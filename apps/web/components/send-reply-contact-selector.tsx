import { RemixIcon } from "@/components/remix-icon";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export interface SimilarContact {
  contactId: string;
  contactName: string;
  botId: string;
}

interface SendReplyContactSelectorProps {
  similarContacts: SimilarContact[];
  searchTerm?: string;
  message?: string;
  onSelect?: (contactId: string) => void;
  className?: string;
}

/**
 * SendReply contact selector component
 * Shows similar contacts for user selection when exact contact cannot be found
 */
export const SendReplyContactSelector = memo<SendReplyContactSelectorProps>(
  ({ similarContacts, searchTerm, message, onSelect, className }) => {
    const { t } = useTranslation();

    if (similarContacts.length === 0) {
      return null;
    }

    const handleSelect = (contactId: string) => {
      if (onSelect) {
        onSelect(contactId);
      }
    };

    return (
      <div className={cn("w-full", className)}>
        {message && (
          <p className="text-sm text-muted-foreground mb-3">{message}</p>
        )}

        <div className="space-y-2">
          {similarContacts.map((contact) => (
            <button
              type="button"
              key={contact.contactId}
              onClick={() => handleSelect(contact.contactName)}
              className="w-full group relative flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 hover:border-primary/50 transition-all duration-200 text-left"
            >
              {/* Icon */}
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <RemixIcon
                    name="user"
                    size="size-4"
                    className="text-primary"
                  />
                </div>
              </div>

              {/* Contact Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {contact.contactName}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  ID: {contact.contactId}
                </p>
              </div>

              {/* Selection Indicator */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground mt-3">
          {t(
            "sendReply.selectContactHint",
            "Click a name to select this contact",
          )}
        </p>
      </div>
    );
  },
);

SendReplyContactSelector.displayName = "SendReplyContactSelector";

/**
 * SendReply contact selection card component
 * Used to display contact selection interface inline in messages
 */
export const SendReplyContactCard = memo<SendReplyContactSelectorProps>(
  ({ similarContacts, searchTerm, message, onSelect, className }) => {
    const { t } = useTranslation();

    return (
      <div
        className={cn(
          "my-4 rounded-xl border border-border bg-muted/30 p-4",
          className,
        )}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center">
            <RemixIcon name="user" size="size-4" className="text-orange-500" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">
              {t("sendReply.selectContactTitle", "Select Contact")}
            </h4>
            <p className="text-xs text-muted-foreground">
              {searchTerm &&
                t(
                  "sendReply.selectContactSubtitle",
                  `Couldn't find "{{searchTerm}}". Please select from similar contacts:`,
                  { searchTerm },
                )}
            </p>
          </div>
        </div>

        <SendReplyContactSelector
          similarContacts={similarContacts}
          searchTerm={searchTerm}
          message={message}
          onSelect={onSelect}
        />
      </div>
    );
  },
);

SendReplyContactCard.displayName = "SendReplyContactCard";
