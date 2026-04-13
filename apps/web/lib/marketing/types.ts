export type MarketingStage =
  | "welcome"
  | "activation"
  | "education"
  | "reinforcement"
  | "conversion"
  | "weekly_digest"
  | "product_updates"
  | "upgrade_prompt"
  | "renewal"
  | "loyalty"
  | "winback";

export type MarketingLinkId =
  | "appHome"
  | "connectPlatform"
  | "watchTutorial"
  | "startSummary"
  | "viewTips"
  | "upgrade"
  | "viewPricing"
  | "viewWeeklyDigest"
  | "viewChangelog"
  | "inviteTeam"
  | "manageSubscription"
  | "community"
  | "feedback"
  | "support"
  | "reactivate"
  | "marketingHome";

export type MarketingLinkMap = Record<MarketingLinkId, string>;

export type MarketingSupportChannels = {
  supportEmail: string;
  supportUrl: string;
  feedbackUrl: string;
  unsubscribeUrl: string;
};

export type MarketingUserSnapshot = {
  createdAt?: Date | null;
  firstLoginAt?: Date | null;
  lastLoginAt?: Date | null;
  lastSummaryAt?: Date | null;
  hasConnectedPlatform?: boolean;
  connectedPlatforms?: string[];
  isPayingCustomer?: boolean;
  planName?: string | null;
  freeQuotaRemaining?: number | null;
  paidQuotaRemaining?: number | null;
  daysToSubscriptionEnd?: number | null;
  hasTeamShare?: boolean;
};

export type TemplateBuildContext = {
  user: {
    id: string;
    email: string;
    displayName?: string | null;
    firstName?: string | null;
  };
  support: MarketingSupportChannels;
  links: MarketingLinkMap;
  snapshot?: MarketingUserSnapshot;
};

export type StructuredEmailSection = {
  title?: string;
  paragraphs: string[];
  bullets?: string[];
};

export type StructuredEmailContent = {
  greeting?: string;
  intro: string[];
  highlights?: Array<{ label: string; description: string }>;
  sections?: StructuredEmailSection[];
  checklist?: string[];
  ctas?: Array<{
    label: string;
    href: MarketingLinkId;
    description?: string;
    variant?: "primary" | "secondary";
  }>;
  closing?: string[];
};

export type MarketingEmailTemplateDefinition = {
  id: string;
  name: string;
  stage: MarketingStage;
  goal: string;
  subject: string | ((ctx: TemplateBuildContext) => string);
  previewText: string;
  dedupeKey?: string | ((ctx: TemplateBuildContext) => string);
  recommendedDelayHours?: number;
  buildContent: (ctx: TemplateBuildContext) => StructuredEmailContent;
};

export type RenderedMarketingEmail = {
  subject: string;
  previewText: string;
  html: string;
  text: string;
};
