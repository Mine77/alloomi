import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { reorderInsightTabs } from "@/lib/db/queries";

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { tabIds } = body;

    if (!Array.isArray(tabIds)) {
      return NextResponse.json({ error: "Invalid tabIds" }, { status: 400 });
    }

    await reorderInsightTabs({
      userId: session.user.id,
      tabIds,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to reorder insight tabs:", error);
    return NextResponse.json(
      { error: "Failed to reorder tabs" },
      { status: 500 },
    );
  }
}
