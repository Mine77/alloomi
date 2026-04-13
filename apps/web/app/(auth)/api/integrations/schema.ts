import { z } from "zod";

export const IntegrationAccountPayloadSchema = z.object({
  platform: z.enum([
    "telegram",
    "whatsapp",
    "slack",
    "discord",
    "gmail",
    "outlook",
    "linkedin",
    "instagram",
    "twitter",
    "google_calendar",
    "outlook_calendar",
    "teams",
    "facebook_messenger",
    "google_drive",
    "google_docs",
    "hubspot",
    "notion",
    "github",
    "asana",
    "jira",
    "linear",
    "imessage",
    "feishu",
    "dingtalk",
    "qqbot",
    "weixin",
  ]),
  externalId: z.string().min(1),
  displayName: z.string().min(1),
  status: z.enum(["active", "paused", "disabled"]).optional().default("active"),
  credentials: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  bot: z
    .object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().min(1),
      adapter: z.string().min(1),
      adapterConfig: z.record(z.string(), z.unknown()).optional().nullable(),
      enable: z.boolean().optional(),
    })
    .optional(),
});

export type IntegrationAccountPayload = z.infer<
  typeof IntegrationAccountPayloadSchema
>;
