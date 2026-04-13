"use client";

/**
 * Development environment only: display chat message components with "real conversation flow"
 * Each assistant message = actual component order in that round of conversation, no state display
 */
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { NativeToolCall } from "@/components/message/native-tool-call";
import { ToolCallAccordion } from "@/components/message/tool-call-accordion";
import { ErrorMessageDisplay } from "@/components/message/error-message-display";
import { MessageReasoning } from "@/components/message-reasoning";
import { QuestionInput } from "@/components/question-input";
import { PermissionDialog } from "@/components/permission-dialog";
import { AgentPlanMessage } from "@/components/agent-plan-message";
import { IntegrationAuthCard } from "@/components/integration-auth-card";
import { motion } from "framer-motion";
import type { ToolCallPart } from "@/components/message/tool-call-accordion";
import type { AgentQuestion } from "@alloomi/agent/types";
import { useTranslation } from "react-i18next";
import "../../../../i18n";
import { Badge, Tabs, TabsContent, TabsList, TabsTrigger } from "@alloomi/ui";
import { HorizontalScrollContainer } from "@alloomi/ui";
import { InsightCardBadgesRow } from "@/components/insight-card/insight-card-badges-row";
import { InsightBadge, FOCUS_GROUP_LEVELS } from "@/components/insight-badge";
import {
  AvatarDisplay,
  AvatarEditor,
  getAvatarConfigByState,
} from "@/components/agent-avatar";
import type { AvatarConfiguration } from "@/components/agent-avatar/types";

const isDev = process.env.NODE_ENV === "development";

const EXPRESSION_VARIANTS: {
  id: string;
  label: string;
  config: AvatarConfiguration;
}[] = [
  {
    id: "default-happy",
    label: "Default · Smiling",
    config: {
      ...getAvatarConfigByState(),
      eyesId: "wide",
      eyebrowsId: "high-curve",
      noseId: "dot",
      mouthId: "smile",
    },
  },
  {
    id: "curious-oh",
    label: "Curious · Oh",
    config: {
      ...getAvatarConfigByState(),
      eyesId: "wide",
      eyebrowsId: "determined",
      noseId: "dot",
      mouthId: "circle",
    },
  },
  {
    id: "chill-neutral",
    label: "Chill · Neutral",
    config: {
      ...getAvatarConfigByState(),
      eyesId: "chill",
      eyebrowsId: "flat",
      noseId: "line",
      mouthId: "neutral",
    },
  },
  {
    id: "wink-smirk",
    label: "Wink · Smirk",
    config: {
      ...getAvatarConfigByState(),
      eyesId: "wink",
      eyebrowsId: "short",
      noseId: "triangle",
      mouthId: "smirk",
    },
  },
];

/** Simulate single user message */
function SimulatedUserMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full px-0 sm:px-0 group/message" data-role="user">
      <div className="flex gap-2 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl group-data-[role=user]/message:w-fit">
        <div className="flex flex-col gap-2 w-full min-w-0">
          <div
            data-testid="message-content"
            className="flex flex-col gap-1 min-w-0 max-w-full break-words rounded-2xl p-4 bg-[var(--primary-50)] text-slate-900 border-0 dark:bg-[#1e3a5f]/30 dark:text-slate-100"
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Simulate single assistant message (no caption, close to real conversation) */
function SimulatedAssistantMessage({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <motion.div
      className="w-full px-0 sm:px-0 group/message"
      data-role="assistant"
      initial={false}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex gap-2 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl">
        <div className="flex flex-col gap-2 w-full min-w-0 relative pl-0 font-serif">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

export default function DevComponentsPage() {
  const { t } = useTranslation();
  const [avatarLabConfig, setAvatarLabConfig] = useState<AvatarConfiguration>(
    () => getAvatarConfigByState(),
  );
  const toolPartsSubmitCheck: ToolCallPart[] = useMemo(
    () => [
      {
        key: "dev-skill-1",
        toolName: "Skill",
        status: "completed",
        toolInput: { skill: "frontend-design" },
      },
      {
        key: "dev-skill-2",
        toolName: "Skill",
        status: "completed",
        toolInput: { skill: "submit-check-and-pr" },
      },
    ],
    [],
  );

  const mergeMainQuestion: AgentQuestion = useMemo(
    () => ({
      id: "merge-main-confirm",
      questions: [
        {
          question: "Do you need to merge main before committing?",
          header: "Confirm",
          options: [
            { label: "Yes, merge main", description: "Recommended" },
            { label: "No, push directly" },
          ],
          multiSelect: false,
        },
      ],
    }),
    [],
  );

  const planSteps = useMemo(
    () => [
      { step: 1, action: "Run lint and tsc", tool: "Bash" as const },
      { step: 2, action: "Compare local design with origin/main", tool: null },
      { step: 3, action: "Ask whether to merge main", tool: null },
    ],
    [],
  );

  const permissionRequestBash = useMemo(
    () => ({
      toolName: "Bash",
      toolInput: { command: "ls -la" },
      toolUseID: "dev-mock-tool-use-id",
      decisionReason: "This tool will execute a system command",
      blockedPath: undefined as string | undefined,
    }),
    [],
  );

  if (!isDev) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8">
        <p className="text-muted-foreground text-center">
          This page is only available in development environment
          (NODE_ENV=development).
        </p>
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col bg-card/90 backdrop-blur-md">
      <div className="flex flex-1 min-h-0 w-full flex-col overflow-x-hidden overflow-y-auto">
        <div className="px-4 pb-4 w-full min-w-0">
          <div className="mx-auto w-full max-w-3xl min-w-0 pt-2 sm:pt-4">
            <Tabs defaultValue="conversation" className="w-full">
              <TabsList className="mb-4">
                <TabsTrigger value="conversation">Conversation</TabsTrigger>
                <TabsTrigger value="badge">Badge</TabsTrigger>
                <TabsTrigger value="avatar">AI Avatar</TabsTrigger>
              </TabsList>

              <TabsContent value="conversation" className="mt-0">
                <p className="text-xs text-muted-foreground mb-6 px-0.5">
                  Below are simulated multi-turn conversations, with components
                  displayed in the order they appear in real conversations for
                  style review.
                </p>
                <div className="mb-8">
                  <SimulatedUserMessage>
                    Please help me with the pre-commit check.
                  </SimulatedUserMessage>
                </div>

                {/* Assistant: call skill -> tool -> reasoning -> ask -> plan (appears in sequence within one message) */}
                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <div className="mt-0 space-y-2">
                      <ToolCallAccordion
                        parts={toolPartsSubmitCheck}
                        isExecuting={false}
                        renderToolCall={(part, options) => (
                          <NativeToolCall
                            toolName={part.toolName}
                            status={part.status}
                            toolInput={part.toolInput}
                            isExecuting={part.isExecuting}
                            embeddedInAccordion={options?.embeddedInAccordion}
                          />
                        )}
                      />
                      <NativeToolCall
                        toolName="Bash"
                        status="completed"
                        toolInput={{ command: "pnpm lint" }}
                        toolOutput={`> alloomi-monorepo@0.1.0 lint
> pnpm -r lint
Scope: 3 of 4 workspace projects
apps/web lint: Checked 1068 files in 434ms. No fixes applied.
apps/web lint: Done`}
                      />
                      <MessageReasoning
                        isLoading={false}
                        reasoning="First run lint and tsc, then compare design with origin/main, finally ask whether to merge main."
                      />
                      <QuestionInput
                        question={mergeMainQuestion}
                        onSubmit={() => {}}
                      />
                      <AgentPlanMessage
                        thought="According to the commit check process, I need your confirmation on whether to merge main before proceeding."
                        plan={planSteps}
                        currentStep={0}
                        isRunning={false}
                        approvalStatus="pending_approval"
                        requiresApproval
                        onApprove={() => {}}
                        onReject={() => {}}
                      />
                    </div>
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedUserMessage>Yes, merge main.</SimulatedUserMessage>
                </div>

                {/* Assistant: run check + text conclusion */}
                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <div className="mt-0 space-y-2">
                      <NativeToolCall
                        toolName="Bash"
                        status="completed"
                        toolInput={{ command: "pnpm tsc" }}
                        toolOutput={`> web@0.3.0 tsc
> NODE_OPTIONS=--max-old-space-size=8192 pnpm exec tsc
✓ Type check passed.`}
                      />
                      <div className="flex flex-col gap-1 min-w-0 max-w-full break-words font-serif text-foreground">
                        Check passed, ready to commit/push.
                      </div>
                    </div>
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedUserMessage>
                    Run ls -la to check the current directory.
                  </SimulatedUserMessage>
                </div>

                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <PermissionDialog
                      request={permissionRequestBash}
                      onDecision={() => {}}
                    />
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedUserMessage>Allow.</SimulatedUserMessage>
                </div>

                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <NativeToolCall
                      toolName="Bash"
                      status="completed"
                      toolInput={{ command: "ls -la" }}
                      toolOutput={`total 48
drwxr-x  6 user  staff   192 Mar  9 10:00 .
drwxr-x  5 user  staff   160 Mar  8 14:00 ..
-rw-r--r--  1 user  staff  1024 package.json
drwxr-x  4 user  staff   128 apps`}
                    />
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedUserMessage>
                    Check the server status.
                  </SimulatedUserMessage>
                </div>

                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <motion.div
                      initial={{ y: 5, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border border-border/50 bg-white/95 px-3 py-2 dark:border-white/10 dark:bg-slate-900/70",
                      )}
                    >
                      <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap">
                        Querying...
                      </span>
                    </motion.div>
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <ErrorMessageDisplay errorContent="Service temporarily unavailable (503)." />
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedUserMessage>
                    Sync Telegram messages.
                  </SimulatedUserMessage>
                </div>

                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <div className="flex items-center gap-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-primary/80">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                      <span className="font-medium">Connecting to Alloomi</span>
                    </div>
                  </SimulatedAssistantMessage>
                </div>

                <div className="mb-8">
                  <SimulatedAssistantMessage>
                    <IntegrationAuthCard showTitle={false} />
                  </SimulatedAssistantMessage>
                </div>

                <div className="shrink-0 min-w-[24px] min-h-[24px]" />
              </TabsContent>

              <TabsContent value="avatar" className="mt-0">
                <p className="text-xs text-muted-foreground mb-6 px-0.5">
                  Below is the complete AvatarEditor for debugging appearance,
                  colors, facial features and borders; followed by a static grid
                  of expression combinations for regression comparison.
                </p>
                <section className="mb-10 w-full min-w-0">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Full Config (AvatarEditor)
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Shared editor component with character editing and other
                    places.
                  </p>
                  <AvatarEditor
                    config={avatarLabConfig}
                    onConfigChange={setAvatarLabConfig}
                    className="max-w-full !p-0 md:flex-col md:items-stretch"
                  />
                </section>
                <section className="mt-8">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Expression Variants
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Keep the same base color, only combine eyes, eyebrows, nose
                    and mouth to create different personalities and emotions.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
                    {EXPRESSION_VARIANTS.map((variant) => (
                      <div
                        key={variant.id}
                        className="flex flex-col items-center gap-2"
                      >
                        <AvatarDisplay
                          config={variant.config}
                          className="size-20 sm:size-24"
                          enableInteractions={false}
                        />
                        <span className="text-xs text-muted-foreground text-center max-w-full truncate px-1">
                          {variant.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              </TabsContent>

              <TabsContent value="badge" className="mt-0">
                {/* Sidebar Alpha badge: same style as app-sidebar brand badge, for unified maintenance */}
                <section className="mb-6">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    Alpha / Group Badge (Unified Maintenance)
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    Sidebar Alpha, event panel group Tab, Brief three groups
                    (urgent / important / monitor), consistent with styles used
                    in the product.
                  </p>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Alpha badge (beside sidebar brand)
                      </h3>
                      <p className="text-xs text-muted-foreground/80 mb-2">
                        Same style as the one on the right side of Logo in
                        app-sidebar header, border-accent-700, gradient
                        background, text-accent-brand.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border border-accent-700 bg-[linear-gradient(90deg,#FDF6EF_0%,#F1F5F9_100%)] text-accent-brand text-[10px] font-bold uppercase tracking-[0.12em] px-2 py-0.5 rounded-lg"
                        >
                          Alpha
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Group badge (event panel header group Tab)
                      </h3>
                      <p className="text-xs text-muted-foreground/80 mb-2">
                        Same style as the group Tab inside
                        HorizontalScrollContainer in event panel header,
                        selected and unselected states.
                      </p>
                      <div className="space-y-3">
                        <HorizontalScrollContainer
                          className="w-full gap-1"
                          disableDrag
                        >
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-primary/20 bg-primary/10 text-primary",
                            )}
                          >
                            <span className="truncate">All</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              13
                            </span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-border bg-background text-muted-foreground",
                            )}
                          >
                            <span className="truncate">Important</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              4
                            </span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-border bg-background text-muted-foreground",
                            )}
                          >
                            <span className="truncate">@Me</span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-border bg-background text-muted-foreground",
                            )}
                          >
                            <span className="truncate">Urgent</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              2
                            </span>
                          </button>
                        </HorizontalScrollContainer>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            Selected:
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary px-3 py-1.5 h-8 text-xs font-semibold shrink-0 max-w-[96px] min-w-0 truncate"
                          >
                            <span className="truncate">All</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              13
                            </span>
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background text-muted-foreground px-3 py-1.5 h-8 text-xs font-semibold shrink-0 max-w-[96px] min-w-0 truncate"
                          >
                            <span className="truncate">Important</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              4
                            </span>
                          </button>
                          <span className="text-[10px] text-muted-foreground ml-2">
                            Unselected
                          </span>
                        </div>
                      </div>
                    </div>
                    {/* Three group badges: consistent with InsightBadge focusGroup, shared by Brief / Focus pages */}
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-2">
                        Group badge (High / Medium / Low)
                      </h3>
                      <p className="text-xs text-muted-foreground/80 mb-2">
                        {
                          'Using InsightBadge type="focusGroup", light gray background + foreground, signal-cellular-3/2/1-fill.'
                        }
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {FOCUS_GROUP_LEVELS.map((level) => (
                          <InsightBadge
                            key={level}
                            type="focusGroup"
                            focusGroupLevel={level}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* InsightCard Badges display: variants + different lengths */}
                <section className="mb-6">
                  <h2 className="text-lg font-semibold text-foreground mb-1">
                    InsightCard Badges Display
                  </h2>
                  <p className="text-xs text-muted-foreground mb-4">
                    All badge variants in InsightCardBadgesRow and their display
                    at different lengths.
                  </p>

                  {/* Badge variants */}
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 mt-6">
                    Badge Variants
                  </h3>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Channel
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <InsightBadge
                          type="channel"
                          platform="telegram"
                          iconSize="size-3"
                        />
                        <InsightBadge
                          type="channel"
                          label="Hacker News"
                          platform="telegram"
                          tooltip="Hacker News"
                          iconSize="size-3"
                        />
                        <InsightBadge
                          type="channel"
                          label="Product & Design"
                          platform="slack"
                          tooltip="Product & Design"
                          iconSize="size-3"
                        />
                        <InsightBadge
                          type="channel"
                          label="Very Long Channel Name That Truncates"
                          platform="telegram"
                          tooltip="Very Long Channel Name That Truncates"
                          iconSize="size-3"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Context
                      </h4>
                      <div className="flex flex-wrap items-center gap-2">
                        <InsightBadge
                          type="context"
                          label="Work"
                          tooltip="Work"
                          iconSize="size-3"
                        />
                        <InsightBadge
                          type="context"
                          label="Product & Design"
                          tooltip="Product & Design"
                          iconSize="size-3"
                        />
                        <InsightBadge
                          type="context"
                          label="Very Long Context Category Name"
                          tooltip="Very Long Context Category Name"
                          iconSize="size-3"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Action / Urgent / Important (combinations in BadgesRow)
                      </h4>
                      <div className="space-y-3">
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["Sample Channel"]}
                          details={[{ platform: "telegram" }]}
                          categories={null}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="slack"
                          groups={["Slack"]}
                          details={[{ platform: "slack" }]}
                          categories={null}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["TG"]}
                          details={[{ platform: "telegram" }]}
                          categories={null}
                          importance="high"
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["TG"]}
                          details={[{ platform: "telegram" }]}
                          categories={null}
                          importance={null}
                          urgency="urgent"
                        />
                      </div>
                    </div>
                    {/* Event group badge (group Tab in event panel header) */}
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Event Group Badge (All / Important / @Me / Urgent)
                      </h4>
                      <p className="text-xs text-muted-foreground/80 mb-2">
                        Same style as the group Tab inside
                        HorizontalScrollContainer in event panel header,
                        selected and unselected states.
                      </p>
                      <div className="space-y-3">
                        <HorizontalScrollContainer
                          className="w-full gap-1"
                          disableDrag
                        >
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-primary/20 bg-primary/10 text-primary",
                            )}
                          >
                            <span className="truncate">All</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              13
                            </span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-border bg-background text-muted-foreground",
                            )}
                          >
                            <span className="truncate">Important</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              4
                            </span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-border bg-background text-muted-foreground",
                            )}
                          >
                            <span className="truncate">@Me</span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 h-8 text-xs font-semibold transition-colors shrink-0 max-w-[96px] min-w-0 truncate",
                              "border-border bg-background text-muted-foreground",
                            )}
                          >
                            <span className="truncate">Urgent</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              2
                            </span>
                          </button>
                        </HorizontalScrollContainer>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] text-muted-foreground">
                            Selected:
                          </span>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 text-primary px-3 py-1.5 h-8 text-xs font-semibold shrink-0 max-w-[96px] min-w-0 truncate"
                          >
                            <span className="truncate">All</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              13
                            </span>
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background text-muted-foreground px-3 py-1.5 h-8 text-xs font-semibold shrink-0 max-w-[96px] min-w-0 truncate"
                          >
                            <span className="truncate">Important</span>
                            <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium bg-primary/10 text-primary shrink-0">
                              4
                            </span>
                          </button>
                          <span className="text-[10px] text-muted-foreground ml-2">
                            Unselected
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Different lengths */}
                  <h3 className="text-sm font-medium text-muted-foreground mb-3 mt-8">
                    Different Lengths
                  </h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Combinations of channels, contexts, actions at different
                    quantities and text lengths in the same row.
                  </p>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Channels Only (0 / 1 / 2 / 3+)
                      </h4>
                      <div className="space-y-3">
                        <InsightCardBadgesRow
                          platform={undefined}
                          groups={[]}
                          details={[]}
                          categories={null}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["Hacker News"]}
                          details={[{ platform: "telegram" }]}
                          categories={null}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["Hacker News", "RSS"]}
                          details={[{ platform: "telegram" }]}
                          categories={null}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="slack"
                          groups={["Product", "Design", "Dev", "Ops"]}
                          details={[{ platform: "slack" }]}
                          categories={null}
                          importance={null}
                          urgency={null}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Channel + Context
                      </h4>
                      <div className="space-y-3">
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["Hacker News"]}
                          details={[{ platform: "telegram" }]}
                          categories={["Work"]}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="slack"
                          groups={["Product & Design"]}
                          details={[{ platform: "slack" }]}
                          categories={["Work", "Product"]}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["Channel A"]}
                          details={[{ platform: "telegram" }]}
                          categories={["Context 1", "Context 2", "Context 3"]}
                          importance={null}
                          urgency={null}
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Full Combo (Channel + Context + Action +
                        Urgent/Important)
                      </h4>
                      <div className="space-y-3">
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={["Hacker News"]}
                          details={[{ platform: "telegram" }]}
                          categories={["Work"]}
                          importance={null}
                          urgency={null}
                        />
                        <InsightCardBadgesRow
                          platform="slack"
                          groups={["Product", "Design"]}
                          details={[{ platform: "slack" }]}
                          categories={["Product", "Design"]}
                          importance="high"
                          urgency="urgent"
                        />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-muted-foreground/80 mb-2">
                        Long Text (Truncation)
                      </h4>
                      <div className="space-y-3 max-w-md">
                        <InsightCardBadgesRow
                          platform="telegram"
                          groups={[
                            "Very Long Channel Name That Should Truncate in Card",
                          ]}
                          details={[{ platform: "telegram" }]}
                          categories={[
                            "Very Long Context Category Name for Truncation Test",
                          ]}
                          importance={null}
                          urgency={null}
                        />
                      </div>
                    </div>
                  </div>
                </section>

                <div className="shrink-0 min-w-[24px] min-h-[24px]" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </div>
  );
}
