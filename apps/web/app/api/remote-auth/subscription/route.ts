/**
 * Cloud subscription information API
 * Used to get user subscription information in Tauri desktop version
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { userSubscriptions } from "@/lib/db/schema";
import { db } from "@/lib/db/queries";
import {
  verifyToken,
  extractToken,
  withErrorHandler,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/auth/remote-auth-utils";

export async function GET(request: NextRequest) {
  return withErrorHandler(async () => {
    const token = extractToken(request);

    if (!token) {
      return createErrorResponse("Unauthorized", 401);
    }

    const result = verifyToken(token);

    if (!result) {
      return createErrorResponse("Invalid token", 401);
    }

    const userId = result.id;

    // Query user subscription
    const [subscription] = await db
      .select()
      .from(userSubscriptions)
      .where(eq(userSubscriptions.userId, userId))
      .limit(1);

    if (!subscription) {
      return createSuccessResponse(null);
    }

    return createSuccessResponse({
      planName: subscription.planName,
      status: subscription.status,
      endDate: subscription.endDate?.toISOString() || null,
    });
  });
}
