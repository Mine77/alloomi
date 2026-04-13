import { z } from "zod";

export const BotRequestSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().min(1).max(255),
  adapter: z.string().min(1).max(255),
  adapterConfig: z.record(z.string(), z.any()).optional().nullable(),
  enable: z.boolean().optional().default(false),
});
export type BotRequest = z.infer<typeof BotRequestSchema>;
export type BotRequestWithId = BotRequest & {
  id: string;
};
