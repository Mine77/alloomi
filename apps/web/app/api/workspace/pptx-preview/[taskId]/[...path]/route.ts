import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/app/(auth)/auth";
import { getOrCreatePptxRenderManifest } from "@/lib/files/pptx-render";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ taskId: string; path: string[] }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { taskId, path } = await context.params;

    if (!taskId) {
      return NextResponse.json(
        { error: "taskId is required" },
        { status: 400 },
      );
    }

    if (!path?.length) {
      return NextResponse.json(
        { error: "PPTX path is required" },
        { status: 400 },
      );
    }

    const pptxPath = decodeURIComponent(path.join("/"));
    const manifest = await getOrCreatePptxRenderManifest(taskId, pptxPath);

    return NextResponse.json(manifest);
  } catch (error) {
    console.error("[WorkspacePptxPreviewAPI] GET error:", error);
    return NextResponse.json(
      {
        error: "Failed to render PPTX preview",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
