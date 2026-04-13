import { NextResponse } from "next/server";

import { auth } from "@/app/(auth)/auth";
import { getUserStorageUsage, listUserFiles } from "@/lib/db/storageService";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limitParam = searchParams.get("limit");
  const limit =
    limitParam && Number.parseInt(limitParam, 10) > 0
      ? Math.min(Number.parseInt(limitParam, 10), 50)
      : 20;

  const usage = await getUserStorageUsage(session.user.id, session.user.type);
  const { files, nextCursor, hasMore } = await listUserFiles({
    userId: session.user.id,
    limit,
    cursor,
  });

  return NextResponse.json({
    files: files.map((file: any) => ({
      id: file.id,
      name: file.name,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      savedAt: file.savedAt,
      url: file.blobUrl,
      blobPathname: file.blobPathname,
      chatId: file.chatId,
      messageId: file.messageId,
      storageProvider: file.storageProvider,
      providerFileId: file.providerFileId,
      providerMetadata: file.providerMetadata ?? null,
    })),
    pagination: {
      nextCursor,
      hasMore,
    },
    usage,
  });
}
