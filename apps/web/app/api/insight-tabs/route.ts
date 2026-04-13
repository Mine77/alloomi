import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getUserInsightTabs, createInsightTab } from "@/lib/db/queries";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const tabs = await getUserInsightTabs(session.user.id);
    return NextResponse.json({ tabs });
  } catch (error) {
    console.error("Failed to fetch insight tabs:", error);
    return NextResponse.json(
      { error: "Failed to fetch tabs" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, filter } = body;

    if (!name || !filter) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    const tab = await createInsightTab({
      userId: session.user.id,
      name,
      filter,
    });

    return NextResponse.json({ tab });
  } catch (error) {
    console.error("Failed to create insight tab:", error);
    return NextResponse.json(
      { error: "Failed to create tab" },
      { status: 500 },
    );
  }
}
