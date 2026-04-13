/**
 * GitHub OAuth Token Exchange for Tauri
 * Receive GitHub authorization code, exchange for access token, get user info, return auth token
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

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USERINFO_URL = "https://api.github.com/user";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
  error_description?: string;
}

interface GitHubUserInfo {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string | null;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

async function exchangeCodeWithGitHub(
  code: string,
  redirectUri: string,
): Promise<GitHubTokenResponse> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth credentials not configured on server");
  }

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  return response.json() as Promise<GitHubTokenResponse>;
}

async function getGitHubUserInfo(accessToken: string): Promise<GitHubUserInfo> {
  const response = await fetch(GITHUB_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub user info: ${response.status}`);
  }

  return response.json() as Promise<GitHubUserInfo>;
}

async function getGitHubEmails(accessToken: string): Promise<GitHubEmail[]> {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub emails: ${response.status}`);
  }

  return response.json() as Promise<GitHubEmail[]>;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code) {
      return createErrorResponse("Missing authorization code");
    }

    // The redirect_uri must match what was used in the authorize step
    // For Tauri mode, it's /api/auth/callback/github
    const redirectUri = `${request.nextUrl.origin}/api/auth/callback/github`;

    // Step 1: Exchange code with GitHub
    const tokenResponse = await exchangeCodeWithGitHub(code, redirectUri);

    if (tokenResponse.error) {
      console.error(
        "[OAuth Exchange] GitHub token error:",
        tokenResponse.error_description,
      );
      return createErrorResponse(
        tokenResponse.error_description || tokenResponse.error,
        400,
      );
    }

    const accessToken = tokenResponse.access_token;

    // Step 2: Get user info and emails from GitHub
    const githubUser = await getGitHubUserInfo(accessToken);

    // GitHub API may not return email by default if user has it hidden
    // Try to find a real (non-noreply) verified email from the emails list first
    let userEmail: string;
    if (githubUser.email && !githubUser.email.includes("noreply")) {
      userEmail = githubUser.email;
    } else {
      const emails = await getGitHubEmails(accessToken);
      const realEmail = emails.find(
        (e) =>
          e.verified &&
          !e.email.includes("noreply") &&
          e.visibility === "public",
      );
      userEmail =
        realEmail?.email ||
        githubUser.email ||
        `${githubUser.login}@users.noreply.github.com`;
    }

    // Step 3: Find or create user in cloud database
    const users = await getUser(userEmail);

    let userId: string;
    const userName: string | null = githubUser.name || githubUser.login;
    const userAvatar: string | null = githubUser.avatar_url;
    // Dummy password for local shadow user sign-in
    const dummyPassword = `oauth_github_${githubUser.id}`;

    if (users.length === 0) {
      await createUser(userEmail, dummyPassword);
      const newUsers = await getUser(userEmail);
      userId = newUsers[0].id;

      await db
        .update(userTable)
        .set({
          name: userName,
          avatarUrl: userAvatar,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
    } else {
      userId = users[0].id;
      // Update name and avatar if changed
      await db
        .update(userTable)
        .set({
          name: userName || users[0].name,
          avatarUrl: userAvatar || users[0].avatarUrl,
          updatedAt: new Date(),
        })
        .where(eq(userTable.id, userId));
    }

    // Step 4: Generate auth token
    const token = generateToken(userId, userEmail);

    // Step 5: Return token, user info, and dummy password (so local can sign in)
    return createSuccessResponse({
      token,
      user: {
        id: userId,
        email: userEmail,
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
