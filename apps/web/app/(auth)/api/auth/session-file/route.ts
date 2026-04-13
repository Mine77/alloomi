import { type NextRequest, NextResponse } from "next/server";
import { createTauriProductionAuthModule } from "@/app/(auth)/tauri";

/**
 * Session File API
 * Used to sync session to file in Tauri mode
 * proxy.ts reads session from file for permission verification
 */

const tauriAuthModule = createTauriProductionAuthModule();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { cloudUserId, email, provider } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Use tauriAuthModule's signIn method to create session
    // This automatically handles file storage
    const result = await tauriAuthModule.signIn("credentials", {
      cloudUserId,
      email,
      provider: provider || "regular",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error || "Failed to create session file" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[SessionFile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
