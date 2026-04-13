import { eq } from "drizzle-orm";

import { db } from "./queries";
import { stripeWebhookEvents } from "./schema";

export type StripeWebhookStatus = "processing" | "succeeded" | "failed";

export async function beginStripeEventProcessing(
  eventId: string,
  eventType: string,
): Promise<boolean> {
  if (!eventId) return false;

  try {
    const [inserted] = await db
      .insert(stripeWebhookEvents)
      .values({
        stripeEventId: eventId,
        eventType,
        status: "processing",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ id: stripeWebhookEvents.id });

    return Boolean(inserted);
  } catch (error) {
    console.error("[Stripe] Failed to record webhook event", eventId, error);
    throw error;
  }
}

export async function completeStripeEventProcessing(
  eventId: string,
  status: Exclude<StripeWebhookStatus, "processing">,
  errorMessage?: string,
) {
  if (!eventId) return;
  const now = new Date();

  try {
    await db
      .update(stripeWebhookEvents)
      .set({
        status,
        updatedAt: now,
        processedAt: now,
        error: errorMessage ?? null,
      })
      .where(eq(stripeWebhookEvents.stripeEventId, eventId));
  } catch (error) {
    console.error("[Stripe] Failed to finalise webhook event", eventId, error);
    throw error;
  }
}
