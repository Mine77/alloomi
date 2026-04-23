import { NextResponse } from "next/server";
import { createUser, getUser } from "@/lib/db/queries";
import { signIn } from "@/app/(auth)/auth";
import { DUMMY_PASSWORD } from "@/lib/env/constants";

/**
 * Create a guest account and sign in automatically.
 * GET /api/auth/guest?redirectUrl=/ -> creates guest, signs in, redirects to redirectUrl
 * POST /api/auth/guest -> same, but uses default redirectUrl
 */
export async function GET(request: Request) {
  return handleGuestAuth(request);
}

export async function POST(request: Request) {
  return handleGuestAuth(request);
}

async function handleGuestAuth(request: Request) {
  try {
    let callbackUrl = "/";

    // GET requests can pass redirectUrl as query param
    if (request.method === "GET") {
      const { searchParams } = new URL(request.url);
      callbackUrl = searchParams.get("redirectUrl") || "/";
    }

    // Generate a unique guest email
    const guestId = `guest-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const guestEmail = `${guestId}@guest.local`;

    // Check if user already exists (shouldn't happen for new guests)
    const existingUsers = await getUser(guestEmail);
    if (existingUsers.length === 0) {
      // Create the guest user
      await createUser(guestEmail, DUMMY_PASSWORD);
    }

    // Sign in as the guest user using credentials provider
    const result = await signIn("credentials", {
      email: guestEmail,
      password: DUMMY_PASSWORD,
      redirect: false,
    });

    if (result?.url) {
      // Successfully signed in, redirect to callbackUrl
      return NextResponse.redirect(new URL(callbackUrl, request.url));
    }

    // Fallback: redirect to callbackUrl anyway (session should be set)
    return NextResponse.redirect(new URL(callbackUrl, request.url));
  } catch (error) {
    console.error("[GuestAuth] Error:", error);
    // On error, redirect to home
    return NextResponse.redirect(new URL("/", request.url));
  }
}
