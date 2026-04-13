/**
 * Google OAuth URL Generator for Cloud
 * Generate Google OAuth URL directly on cloud side, using cloud's own callback
 */

import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return NextResponse.json(
        { error: "Google OAuth not configured: missing GOOGLE_CLIENT_ID" },
        { status: 500 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const state = searchParams.get("state") || randomBytes(32).toString("hex");

    // Support client-provided redirect_uri (for backward compatibility)
    // Also support no redirect_uri (new cloud autonomous mode)
    const clientRedirectUri = searchParams.get("redirect_uri");
    const redirectUri =
      clientRedirectUri || `${request.nextUrl.origin}/api/auth/callback/google`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
    });

    const googleOAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    return NextResponse.json({
      url: googleOAuthUrl,
      state,
    });
  } catch (error) {
    console.error("[OAuth] Failed to generate Google OAuth URL:", error);
    return NextResponse.json(
      {
        error: "Failed to generate OAuth URL",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
