/**
 * Google OAuth Token Exchange for Tauri
 * Receive Google authorization code, exchange for access token, get user info, return auth token
 *
 * This is a cloud endpoint, used by Tauri desktop version via local server callback route
 */

import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import {
  generateToken,
  createSuccessResponse,
  createErrorResponse,
} from "@/lib/auth/remote-auth-utils";
import { db, getUser, createUser } from "@/lib/db/queries";
import { user as userTable } from "@/lib/db/schema";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
  refresh_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string | null;
  picture: string | null;
}

async function exchangeCodeWithGoogle(
  code: string,
  redirectUri: string,
): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured on server");
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
  });

  return response.json() as Promise<GoogleTokenResponse>;
}

async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Google user info: ${response.status}`);
  }

  return response.json() as Promise<GoogleUserInfo>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return createErrorResponse("Missing authorization code");
    }

    // The redirect_uri must match what was used in the authorize step
    // For Tauri mode, it's /api/auth/callback/google
    const redirectUri = `${request.nextUrl.origin}/api/auth/callback/google`;

    // Step 1: Exchange code with Google
    const tokenResponse = await exchangeCodeWithGoogle(code, redirectUri);

    if (tokenResponse.error) {
      console.error(
        "[OAuth Exchange] Google token error:",
        tokenResponse.error_description,
      );
      return createErrorResponse(
        tokenResponse.error_description || tokenResponse.error,
        400,
      );
    }

    const accessToken = tokenResponse.access_token;

    // Step 2: Get user info from Google
    const googleUser = await getGoogleUserInfo(accessToken);

    // Step 3: Find or create user in cloud database
    const users = await getUser(googleUser.email);

    let userId: string;
    const userName: string | null = googleUser.name;
    const userAvatar: string | null = googleUser.picture;
    // Dummy password for local shadow user sign-in
    const dummyPassword = `oauth_google_${googleUser.sub}`;

    if (users.length === 0) {
      await createUser(googleUser.email, dummyPassword);
      const newUsers = await getUser(googleUser.email);
      userId = newUsers[0].id;

      await db
        .update(userTable)
        .set({
          name: googleUser.name || googleUser.email.split("@")[0],
          avatarUrl: googleUser.picture,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
    } else {
      userId = users[0].id;
      // Update name and avatar if changed
      await db
        .update(userTable)
        .set({
          name: googleUser.name || users[0].name,
          avatarUrl: googleUser.picture || users[0].avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
    }

    // Step 4: Generate auth token
    const token = generateToken(userId, googleUser.email);

    // Step 5: Return token, user info, and dummy password (so local can sign in)
    return createSuccessResponse({
      token,
      user: {
        id: userId,
        email: googleUser.email,
        name: userName,
        avatarUrl: userAvatar,
      },
      password: dummyPassword,
    });
  } catch (error) {
    console.error("[OAuth Exchange] Error:", error);
    return createErrorResponse(
      error instanceof Error ? error.message : "Token exchange failed",
      500,
    );
  }
}
