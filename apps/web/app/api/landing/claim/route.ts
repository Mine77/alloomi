import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { claimLandingPromo } from "@/lib/db/landing-promo";

/**
 * POST /api/landing/claim
 * Claim 6 months free Pro membership from landing page
 *
 * Body:
 * {
 *   "email": string,
 *   "name": string (optional),
 *   "password": string (optional, required for new users),
 *   "referralCode": string (optional),
 *   "trackingParams": Record<string, string> (optional)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    let { email, name, password, referralCode, trackingParams } = body;

    // Check if user is logged in
    const session = await auth();
    const userId = session?.user?.id;

    // If user is logged in, use their session email
    if (userId && session?.user?.email) {
      email = session.user.email;
    }

    // Validate email
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          error: "Valid email is required",
        },
        { status: 400 },
      );
    }

    // If no password and no session, require password
    if (!userId && !password) {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required for new users",
        },
        { status: 400 },
      );
    }

    // Claim promo
    const result = await claimLandingPromo({
      email,
      name,
      password: userId ? undefined : password, // Don't send password if user is logged in
      referralCode,
      userId,
      trackingParams,
    });

    // Don't expose sensitive data
    const responseData = {
      success: result.success,
      message: result.message,
      referralCode: result.registration?.referralCode,
      expiresAt: result.registration?.expiresAt,
      monthsGranted: result.registration?.monthsGranted,
    };

    if (result.success) {
      return NextResponse.json(responseData);
    } else {
      return NextResponse.json(responseData, { status: 400 });
    }
  } catch (error) {
    console.error("[Landing Claim] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to claim promo",
      },
      { status: 500 },
    );
  }
}
