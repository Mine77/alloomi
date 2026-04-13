import { getDownloadUrl } from "@vercel/blob";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/app/(auth)/auth";
import { getUserFileByBlobPathname } from "@/lib/db/storageService";
import { deriveBlobPathFromUrl } from "@/lib/files/blob-path";
import { isTauriMode, getAppUrl } from "@/lib/env";

const requestSchema = z.object({
  blobPath: z.string().min(1).optional(),
  url: z.url().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(rawBody);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const blobPathInput = parsed.data.blobPath;
  const normalizedBlobPath =
    blobPathInput ?? deriveBlobPathFromUrl(parsed.data.url ?? null) ?? null;

  if (!normalizedBlobPath) {
    return NextResponse.json(
      { error: "Unable to resolve attachment blob path." },
      { status: 400 },
    );
  }

  if (!normalizedBlobPath.startsWith(`${session.user.id}/`)) {
    return NextResponse.json(
      { error: "You do not have permission to access this attachment." },
      { status: 403 },
    );
  }

  try {
    // Tauri mode: return local file download API URL
    if (isTauriMode()) {
      const localDownloadUrl = `${getAppUrl()}/api/files/download?path=${encodeURIComponent(normalizedBlobPath)}`;
      return NextResponse.json({ downloadUrl: localDownloadUrl });
    }

    // Server mode: get complete URL from database, then use getDownloadUrl
    const fileRecord = await getUserFileByBlobPathname({
      userId: session.user.id,
      blobPathname: normalizedBlobPath,
    }).catch(() => null);

    const blobUrl = fileRecord?.blobUrl;
    if (!blobUrl) {
      return NextResponse.json(
        { error: "File URL not found." },
        { status: 404 },
      );
    }

    const downloadUrl = getDownloadUrl(blobUrl);
    return NextResponse.json({ downloadUrl });
  } catch (error) {
    console.error("[Insight attachments] Failed to create download URL", error);
    return NextResponse.json(
      { error: "Failed to generate download link. Try again later." },
      { status: 502 },
    );
  }
}
