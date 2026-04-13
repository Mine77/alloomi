import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getUserStorageUsage } from "@/lib/db/storageService";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const usage = await getUserStorageUsage(session.user.id, session.user.type);

  return NextResponse.json(usage);
}
