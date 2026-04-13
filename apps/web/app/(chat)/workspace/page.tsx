"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type LegacyRef,
} from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { Button, Input, Textarea } from "@alloomi/ui";
import { ScrollArea } from "@alloomi/ui";
import { usePullToRefresh } from "@alloomi/hooks/use-pull-to-refresh";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@alloomi/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@alloomi/ui";
import { getFileColor } from "@/lib/utils/file-icons";
import { getToolDisplayName } from "@/lib/utils/tool-names";
import { FilePreviewPanel } from "@/components/file-preview-panel";
import type { KnowledgeFile } from "@/hooks/use-knowledge-files";
import type { LibraryMetaResponse } from "@/app/(chat)/api/library/meta/route";
import type { LibraryNoteItem } from "@/app/(chat)/api/library/notes/route";
import { Spinner } from "@/components/spinner";
import { uploadRagFile } from "@/lib/files/upload";
import { useGlobalInsightDrawerOptional } from "@/components/global-insight-drawer";
import { toast } from "@/components/toast";
import "../../../i18n";
import { getAuthToken } from "@/lib/auth/token-manager";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@alloomi/ui";
import {
  useDiskUsage,
  useSessions,
  invalidateDiskUsage,
  invalidateSessions,
} from "@/hooks/use-disk-usage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@alloomi/ui";

/** Library top-level tabs: My notes, My files, Chat Vault */
export type LibraryTab = "mynotes" | "myfiles" | "stuff";

/** File type filter categories (consistent with screenshots + tools) */
export type FileTypeFilter =
  | "all"
  | "slides"
  | "website"
  | "document"
  | "imageVideo"
  | "audio"
  | "spreadsheet"
  | "other"
  | "tools";

/** Remix icon name for each filter type (used when buttons show icons only) */
const FILTER_ICON_MAP: Record<FileTypeFilter, string> = {
  all: "filter",
  slides: "slideshow",
  website: "code",
  document: "file_text",
  imageVideo: "image",
  audio: "music_2",
  spreadsheet: "table_2",
  other: "more_2",
  tools: "layers",
};

/** Grouping mode (none is only used for My files) */
export type GroupByMode = "conversation" | "time" | "event" | "folder" | "none";

/** Pagination constants */
// Frontend pagination size must match backend

/** Workspace file item (returned from API, includes taskId) */
const PAGE_SIZE = 25;

/** Workspace file item (returned from API, includes taskId) */
interface WorkspaceFileItem {
  taskId: string;
  name: string;
  path: string;
  type?: string;
  size?: number;
  isDirectory?: boolean;
  modifiedTime?: string;
}

/** Tool execution item */
interface ToolExecution {
  id: string;
  name: string;
  status: "pending" | "running" | "completed" | "error";
  timestamp: Date;
}

/** Unified item type within library */
type LibraryItemKind = "workspace_file" | "knowledge_file" | "tool";

interface LibraryItem {
  id: string;
  kind: LibraryItemKind;
  title: string;
  subtitle?: string;
  date: Date;
  groupKey: string;
  workspaceFile?: { taskId: string; path: string; name: string; type?: string };
  toolExecution?: ToolExecution;
  knowledgeFile?: KnowledgeFile;
}

/** Paginated response type */
interface PaginatedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextCursor: string | null;
  total?: number;
}

/** Return file type category based on extension */
function getFileTypeCategory(
  ext: string,
): Exclude<FileTypeFilter, "all" | "tools"> {
  const e = ext.toLowerCase();
  if (["ppt", "pptx", "odp", "key"].includes(e)) return "slides";
  if (["html", "htm"].includes(e)) return "website";
  if (["pdf", "doc", "docx", "odt", "rtf", "txt", "md"].includes(e))
    return "document";
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "svg",
      "webp",
      "bmp",
      "ico",
      "mp4",
      "webm",
      "mov",
      "avi",
      "mkv",
      "flv",
    ].includes(e)
  )
    return "imageVideo";
  if (["mp3", "wav", "ogg", "m4a", "aac", "flac"].includes(e)) return "audio";
  if (["xls", "xlsx", "csv", "ods"].includes(e)) return "spreadsheet";
  return "other";
}

/** Get extension from filename or type */
function getExtFromItem(item: LibraryItem): string {
  if (item.workspaceFile?.type) return item.workspaceFile.type;
  if (item.kind === "workspace_file" && item.title.includes(".")) {
    return item.title.split(".").pop()?.toLowerCase() ?? "";
  }
  if (item.kind === "knowledge_file" && item.title.includes(".")) {
    return item.title.split(".").pop()?.toLowerCase() ?? "";
  }
  return "";
}

/**
 * Resolve preview priority kind for card mode.
 * html/htm/h5 -> website preview, md -> markdown preview, others -> generic.
 */
function getLibraryPreviewKind(
  ext: string,
): "website" | "markdown" | "generic" {
  const e = ext.toLowerCase();
  if (["html", "htm", "h5"].includes(e)) return "website";
  if (e === "md") return "markdown";
  return "generic";
}

/**
 * Build display lines for preview cards when file content is unavailable.
 */
function getLibraryPreviewLines(item: LibraryItem): {
  titleLine: string;
  bodyLine: string;
} {
  const titleLine = item.title;
  const bodyLine =
    item.subtitle ||
    item.workspaceFile?.name ||
    item.workspaceFile?.path ||
    item.knowledgeFile?.fileName ||
    "";
  return { titleLine, bodyLine };
}

/**
 * Turn raw text into a compact single-paragraph snapshot for cards.
 */
function toSnapshotText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/**
 * Build a markdown preview snapshot that only keeps rendered-readable text.
 * Removes frontmatter and common markdown syntax noise for concise card display.
 */
function toMarkdownSnapshotText(raw: string): string {
  const withoutFrontmatter = raw.replace(/^---[\s\S]*?---\s*/m, "");
  const withoutScripts = withoutFrontmatter.replace(
    /<script[\s\S]*?<\/script>/gi,
    " ",
  );
  const withoutStyles = withoutScripts.replace(
    /<style[\s\S]*?<\/style>/gi,
    " ",
  );
  const withoutHtmlTags = withoutStyles.replace(/<[^>]+>/g, " ");
  const withoutCodeBlock = withoutHtmlTags.replace(/```[\s\S]*?```/g, " ");
  const withoutInlineCode = withoutCodeBlock.replace(/`([^`]+)`/g, "$1");
  const withoutImages = withoutInlineCode.replace(
    /!\[([^\]]*)\]\([^)]+\)/g,
    "$1",
  );
  const withoutLinks = withoutImages.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  const withoutMdTokens = withoutLinks.replace(/[#>*_\-\[\]\(\)]/g, " ");
  return withoutMdTokens.replace(/\s+/g, " ").trim();
}

interface LibraryPreviewSnapshot {
  text: string;
  html?: string;
  updatedAt: number;
}

const LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY = "library_preview_snapshot_v1";
const previewSnapshotMemoryCache = new Map<string, LibraryPreviewSnapshot>();

/**
 * Convert HTML content to readable plain-text snapshot, avoid iframe runtime rendering.
 */
function toHtmlSnapshotText(raw: string): string {
  const withoutScripts = raw.replace(/<script[\s\S]*?<\/script>/gi, " ");
  const withoutStyles = withoutScripts.replace(
    /<style[\s\S]*?<\/style>/gi,
    " ",
  );
  const withoutTags = withoutStyles.replace(/<[^>]+>/g, " ");
  return withoutTags.replace(/\s+/g, " ").trim();
}

/**
 * Build safe html snapshot for iframe preview.
 * Remove script tags to prevent runtime script execution warnings.
 */
function toSafeHtmlSnapshot(raw: string): string {
  return raw.replace(/<script[\s\S]*?<\/script>/gi, " ");
}

/**
 * Build stable snapshot cache key for one library item.
 */
function getLibraryPreviewCacheKey(item: LibraryItem): string | null {
  if (item.kind === "workspace_file" && item.workspaceFile) {
    return `wf:${item.workspaceFile.taskId}:${item.workspaceFile.path}`;
  }
  if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
    return `kf:${item.knowledgeFile.id}`;
  }
  return null;
}

/**
 * Read snapshot from memory/local cache.
 */
function readLibraryPreviewSnapshot(
  key: string,
  updatedAt: number,
): LibraryPreviewSnapshot | null {
  const memory = previewSnapshotMemoryCache.get(key);
  if (
    memory &&
    memory.updatedAt === updatedAt &&
    typeof memory.text === "string"
  ) {
    return memory;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, LibraryPreviewSnapshot>;
    const snapshot = parsed[key];
    if (!snapshot || snapshot.updatedAt !== updatedAt) return null;
    if (typeof snapshot.text !== "string") {
      return null;
    }
    previewSnapshotMemoryCache.set(key, snapshot);
    return snapshot;
  } catch {
    return null;
  }
}

/**
 * Persist snapshot to memory/local cache.
 */
function writeLibraryPreviewSnapshot(
  key: string,
  snapshot: LibraryPreviewSnapshot,
): void {
  previewSnapshotMemoryCache.set(key, snapshot);
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(
      LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY,
    );
    const parsed = raw
      ? (JSON.parse(raw) as Record<string, LibraryPreviewSnapshot>)
      : {};
    parsed[key] = snapshot;
    window.localStorage.setItem(
      LIBRARY_PREVIEW_SNAPSHOT_STORAGE_KEY,
      JSON.stringify(parsed),
    );
  } catch {
    // Ignore storage write failures.
  }
}

/**
 * Extract tool execution records from message list
 */
function extractToolExecutions(messages: unknown[]): ToolExecution[] {
  if (!messages?.length) return [];
  const tools: ToolExecution[] = [];
  const seenIds = new Set<string>();

  messages.forEach((message: any) => {
    if (message.parts && Array.isArray(message.parts)) {
      message.parts.forEach((part: any) => {
        if (part.type === "tool-native") {
          const id = part.toolUseId || `tool-${tools.length}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            tools.push({
              id,
              name: part.toolName || "Unknown",
              status:
                part.status === "executing"
                  ? "running"
                  : part.status === "error"
                    ? "error"
                    : "completed",
              timestamp: message.createdAt
                ? new Date(message.createdAt)
                : new Date(),
            });
          }
        }
      });
    }
    if (message.type === "tool_use" || message.type === "tool_result") {
      const id = message.id || `tool-${tools.length}`;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        tools.push({
          id,
          name: message.name || "Unknown",
          status:
            message.type === "tool_use"
              ? "running"
              : message.isError
                ? "error"
                : "completed",
          timestamp: message.timestamp
            ? new Date(message.timestamp)
            : new Date(),
        });
      }
    }
  });
  return tools;
}

/**
 * Get group display label by date
 */
function getDateGroupLabel(date: Date, locale: string): string {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    month: "numeric",
    day: "numeric",
  });
  return formatter.format(date);
}

/**
 * Parse folder from path (directory part of relative path), return "" for root directory
 */
function getFolderFromPath(path: string): string {
  const idx = path.lastIndexOf("/");
  if (idx <= 0) return "";
  return path.slice(0, idx);
}

/**
 * Library page: merge workspace files, knowledge base files, tools; group by conversation/time/event/folder; filter by file type
 * Supports pagination and pull-to-refresh
 */
export default function LibraryPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get("chatId") ?? undefined;
  const tabParam = searchParams.get("tab");
  const activeTab: LibraryTab =
    tabParam === "mynotes" || tabParam === "myfiles" || tabParam === "stuff"
      ? tabParam
      : "stuff";

  const setLibraryTab = useCallback(
    (tab: LibraryTab) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", tab);
      router.push(`/workspace?${next.toString()}`);
    },
    [router, searchParams],
  );

  /** Open event: prioritize opening global drawer; fallback to navigating to event page if drawer unavailable or request fails */
  const globalDrawer = useGlobalInsightDrawerOptional();
  const handleOpenEvent = useCallback(
    (insightId: string) => {
      if (globalDrawer) {
        fetch(`/api/insights/${encodeURIComponent(insightId)}?fetch=true`)
          .then((res) => {
            if (!res.ok) throw new Error(res.statusText);
            return res.json();
          })
          .then((data) => {
            if (data?.insight) {
              globalDrawer.openDrawer(data.insight);
            } else {
              router.push(
                `/?page=events&insightId=${encodeURIComponent(insightId)}`,
              );
            }
          })
          .catch(() => {
            router.push(
              `/?page=events&insightId=${encodeURIComponent(insightId)}`,
            );
          });
      } else {
        router.push(`/?page=events&insightId=${encodeURIComponent(insightId)}`);
      }
    },
    [globalDrawer, router],
  );

  /** Fixed display rule: Chat Vault groups by conversation; My notes / My files group by event (keep GroupByMode for future switching capability) */
  const effectiveGroupBy = (
    activeTab === "myfiles"
      ? "event"
      : activeTab === "mynotes"
        ? "event"
        : activeTab === "stuff"
          ? "conversation"
          : "none"
  ) as GroupByMode;

  const [filterType, setFilterType] = useState<FileTypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Workspace file pagination state
  const [workspaceFiles, setWorkspaceFiles] = useState<WorkspaceFileItem[]>([]);
  const [workspaceCursor, setWorkspaceCursor] = useState<string | null>(null);
  const [workspaceHasMore, setWorkspaceHasMore] = useState(true);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);

  // Knowledge base file pagination state
  const [knowledgeFiles, setKnowledgeFiles] = useState<KnowledgeFile[]>([]);
  const [knowledgeCursor, setKnowledgeCursor] = useState<string | null>(null);
  const [knowledgeHasMore, setKnowledgeHasMore] = useState(true);
  const [loadingKnowledge, setLoadingKnowledge] = useState(true);

  // My notes: user notes from all events
  const [libraryNotes, setLibraryNotes] = useState<LibraryNoteItem[]>([]);
  const [loadingNotes, setLoadingNotes] = useState(true);

  // Message loading state (current conversation)
  const [messages, setMessages] = useState<any[]>([]);

  // Metadata
  const [chatMeta, setChatMeta] = useState<LibraryMetaResponse["chats"]>({});

  // Preview panel state
  const [isPreviewPanelOpen, setIsPreviewPanelOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{
    path: string;
    name: string;
    type: string;
    taskId?: string;
  } | null>(null);

  /** My files: knowledge base document preview (open side panel) */
  const [previewKnowledgeDocumentId, setPreviewKnowledgeDocumentId] = useState<
    string | null
  >(null);

  /** My notes: add note dialog */
  const [isAddNoteDialogOpen, setIsAddNoteDialogOpen] = useState(false);
  const [addNoteDraft, setAddNoteDraft] = useState("");

  // Infinite load trigger ref
  const loadMoreRef = useRef<HTMLDivElement>(null);
  /** My files upload: hidden file input */
  const myFilesInputRef = useRef<HTMLInputElement>(null);

  // Use ref to store loading function to avoid circular dependency
  const loadWorkspaceFilesRef = useRef<
    ((refresh?: boolean) => Promise<void>) | undefined
  >(undefined);
  const loadKnowledgeFilesRef = useRef<
    ((refresh?: boolean) => Promise<void>) | undefined
  >(undefined);

  /** My files upload status */
  const [isUploadingMyFiles, setIsUploadingMyFiles] = useState(false);

  /**
   * Load workspace files (supports refresh)
   */
  const loadWorkspaceFiles = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setLoadingWorkspace(true);
      }
      try {
        const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
        if (!refresh && workspaceCursor) {
          params.set("cursor", workspaceCursor);
        }
        const res = await fetch(`/api/workspace/files?${params.toString()}`);
        if (res.ok) {
          const data: PaginatedResponse<WorkspaceFileItem> & {
            files?: WorkspaceFileItem[];
          } = await res.json();
          const files = data.files || data.items || [];

          if (refresh) {
            setWorkspaceFiles(files);
            setWorkspaceCursor(data.nextCursor || null);
            setWorkspaceHasMore(!!data.hasMore);
          } else {
            // Use taskId + path as unique key for deduplication
            setWorkspaceFiles((prev) => {
              const existingKeys = new Set(
                prev.map((f) => `${f.taskId}:${f.path}`),
              );
              const newFiles = files.filter(
                (f) => !existingKeys.has(`${f.taskId}:${f.path}`),
              );
              return [...prev, ...newFiles];
            });
            setWorkspaceCursor(data.nextCursor || null);
            // If newly loaded files count is 0, loading is complete
            const noMoreFiles = files.length === 0;
            setWorkspaceHasMore(noMoreFiles ? false : !!data.hasMore);
          }
        } else {
          console.error(
            "[LibraryPage] loadWorkspaceFiles failed:",
            res.status,
            res.statusText,
          );
        }
      } catch (e) {
        console.error("[LibraryPage] loadWorkspaceFiles error:", e);
      } finally {
        setLoadingWorkspace(false);
      }
    },
    [workspaceCursor],
  );

  /**
   * Load knowledge base files (supports refresh)
   */
  const loadKnowledgeFiles = useCallback(
    async (refresh = false) => {
      if (refresh) {
        setLoadingKnowledge(true);
      }
      try {
        const params = new URLSearchParams({ pageSize: String(PAGE_SIZE) });
        if (!refresh && knowledgeCursor) {
          params.set("cursor", knowledgeCursor);
        }
        const res = await fetch(`/api/rag/documents?${params.toString()}`);
        if (res.ok) {
          const data: PaginatedResponse<KnowledgeFile> & {
            documents?: KnowledgeFile[];
          } = await res.json();
          const docs = data.documents || data.items || [];

          if (refresh) {
            setKnowledgeFiles(docs);
            setKnowledgeCursor(data.nextCursor || null);
            setKnowledgeHasMore(!!data.hasMore);
          } else {
            // Use id for deduplication
            setKnowledgeFiles((prev) => {
              const existingIds = new Set(prev.map((f) => f.id));
              const newDocs = docs.filter((f) => !existingIds.has(f.id));
              return [...prev, ...newDocs];
            });
            setKnowledgeCursor(data.nextCursor || null);
            // If newly loaded files count is 0, loading is complete
            const noMoreDocs = docs.length === 0;
            setKnowledgeHasMore(noMoreDocs ? false : !!data.hasMore);
          }
        } else {
          console.error(
            "[LibraryPage] loadKnowledgeFiles failed:",
            res.status,
            res.statusText,
          );
        }
      } catch (e) {
        console.error("[LibraryPage] loadKnowledgeFiles error:", e);
      } finally {
        setLoadingKnowledge(false);
      }
    },
    [knowledgeCursor],
  );

  // Save loading functions to ref
  useEffect(() => {
    loadWorkspaceFilesRef.current = loadWorkspaceFiles;
    loadKnowledgeFilesRef.current = loadKnowledgeFiles;
  }, [loadWorkspaceFiles, loadKnowledgeFiles]);

  /**
   * My files: upload files to RAG, refresh list after success
   */
  const handleMyFilesUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      e.target.value = "";
      if (!file) return;
      setIsUploadingMyFiles(true);
      try {
        let cloudAuthToken: string | undefined;
        try {
          cloudAuthToken = getAuthToken() || undefined;
        } catch {
          // ignore
        }
        const result = await uploadRagFile(file, { cloudAuthToken });
        if (result.success) {
          await loadKnowledgeFiles(true);
          toast({
            type: "success",
            description: "File uploaded successfully",
          });
        } else {
          toast({
            type: "error",
            description: result.error || "File upload failed",
          });
        }
      } catch (err) {
        console.error("[My files] upload error:", err);
        const message =
          err instanceof Error ? err.message : "File upload failed";
        toast({
          type: "error",
          description: message,
        });
      } finally {
        setIsUploadingMyFiles(false);
      }
    },
    [loadKnowledgeFiles],
  );

  /**
   * My notes: pull all user notes from events
   */
  const loadLibraryNotes = useCallback(async (refresh = false) => {
    if (refresh) setLoadingNotes(true);
    try {
      const res = await fetch("/api/library/notes");
      if (res.ok) {
        const data: { notes: LibraryNoteItem[] } = await res.json();
        setLibraryNotes(data.notes ?? []);
      }
    } catch (e) {
      console.error("[LibraryPage] loadLibraryNotes error:", e);
    } finally {
      setLoadingNotes(false);
    }
  }, []);

  /**
   * My notes: delete note, remove from local list after success
   */
  const handleDeleteNote = useCallback(async (noteId: string) => {
    try {
      const res = await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      setLibraryNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (err) {
      console.error("[My notes] delete error:", err);
    }
  }, []);

  /**
   * My notes: add note under "Public", refresh list after success
   */
  const handleAddNote = useCallback(
    async (content: string) => {
      try {
        const res = await fetch("/api/library/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: content.trim() }),
        });
        if (!res.ok) throw new Error("Create failed");
        await loadLibraryNotes(true);
      } catch (err) {
        console.error("[My notes] add note error:", err);
      }
    },
    [loadLibraryNotes],
  );

  /**
   * My files: delete knowledge base file, remove from local list after success
   */
  const handleDeleteKnowledgeFile = useCallback(async (documentId: string) => {
    try {
      const res = await fetch(`/api/rag/documents/${documentId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      setKnowledgeFiles((prev) => prev.filter((f) => f.id !== documentId));
    } catch (err) {
      console.error("[My files] delete error:", err);
    }
  }, []);

  /**
   * Chat vault: delete workspace file, and remove from local list after success.
   */
  const handleDeleteWorkspaceFile = useCallback(
    async (wf: { taskId: string; path: string }) => {
      try {
        const res = await fetch(
          `/api/workspace/file/${encodeURIComponent(wf.taskId)}/${encodeURIComponent(wf.path)}`,
          { method: "DELETE" },
        );
        if (!res.ok) throw new Error("Delete failed");
        setWorkspaceFiles((prev) =>
          prev.filter((f) => !(f.taskId === wf.taskId && f.path === wf.path)),
        );
      } catch (err) {
        console.error("[Chat vault] delete file error:", err);
      }
    },
    [],
  );

  /**
   * Load messages
   */
  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const res = await fetch(`/api/chat/${chatId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch (e) {
      console.error("[LibraryPage] loadMessages:", e);
    }
  }, [chatId]);

  /**
   * Load more (infinite scroll): My files only loads knowledge base, Chat Vault only loads workspace
   */
  const loadMore = useCallback(async () => {
    if (activeTab === "myfiles") {
      if (loadingKnowledge || !knowledgeHasMore) return;
      await loadKnowledgeFiles(false);
    } else {
      if (loadingWorkspace || !workspaceHasMore) return;
      await loadWorkspaceFiles(false);
    }
  }, [
    activeTab,
    loadingWorkspace,
    loadingKnowledge,
    workspaceHasMore,
    knowledgeHasMore,
    loadWorkspaceFiles,
    loadKnowledgeFiles,
  ]);

  // Pull-to-refresh configuration
  const loadLibraryNotesRef =
    useRef<(refresh?: boolean) => Promise<void>>(loadLibraryNotes);
  useEffect(() => {
    loadLibraryNotesRef.current = loadLibraryNotes;
  }, [loadLibraryNotes]);

  // Whether there are filter conditions (disable pull-to-refresh when filtering, as filtering is only frontend, no need to re-request API)
  const hasFilter = filterType !== "all" || searchQuery.trim().length > 0;

  const {
    triggerRef,
    setupRefCallback: setupPullToRefresh,
    isRefreshing,
  } = usePullToRefresh({
    threshold: 60,
    maxDistance: 120,
    onRefresh: async () => {
      if (activeTab === "mynotes" && loadLibraryNotesRef.current) {
        await loadLibraryNotesRef.current(true);
      } else if (activeTab === "myfiles" && loadKnowledgeFilesRef.current) {
        await loadKnowledgeFilesRef.current(true);
      } else if (activeTab === "stuff" && loadWorkspaceFilesRef.current) {
        await loadWorkspaceFilesRef.current(true);
      }
    },
    enabled:
      !hasFilter &&
      (activeTab === "stuff" ||
        activeTab === "myfiles" ||
        activeTab === "mynotes"),
  });

  // Reset to "all" when switching to My files if currently filtering by "tools"
  useEffect(() => {
    if (activeTab === "myfiles" && filterType === "tools") {
      setFilterType("all");
    }
  }, [activeTab, filterType]);

  // Initial load
  useEffect(() => {
    loadWorkspaceFiles(true);
    loadKnowledgeFiles(true);
    loadLibraryNotes(true);
  }, [loadLibraryNotes]);

  // Load messages for current conversation
  useEffect(() => {
    if (chatId) loadMessages();
    else setMessages([]);
  }, [chatId, loadMessages]);

  // Listen to ScrollArea scroll, trigger infinite load
  useEffect(() => {
    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) return;

    const handleScroll = () => {
      const viewport = document.querySelector(
        "[data-radix-scroll-area-viewport]",
      ) as HTMLElement;
      if (!viewport) return;

      const { scrollTop, scrollHeight, clientHeight } = viewport;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;

      if (isNearBottom && (workspaceHasMore || knowledgeHasMore)) {
        loadMore();
      }
    };

    const viewport = document.querySelector(
      "[data-radix-scroll-area-viewport]",
    ) as HTMLElement;
    viewport?.addEventListener("scroll", handleScroll);
    return () => {
      viewport?.removeEventListener("scroll", handleScroll);
    };
  }, [workspaceHasMore, knowledgeHasMore, loadMore]);

  const toolExecutions = useMemo(
    () => extractToolExecutions(messages),
    [messages],
  );

  /** For Chat Vault: workspace files + tools only */
  const vaultItems = useMemo((): LibraryItem[] => {
    const items: LibraryItem[] = [];
    let wsIndex = 0;
    workspaceFiles
      .filter((f) => !f.isDirectory)
      .forEach((f) => {
        items.push({
          id: `ws-${wsIndex++}-${f.taskId}-${f.path}`,
          kind: "workspace_file",
          title: f.name,
          subtitle: f.taskId,
          date: f.modifiedTime ? new Date(f.modifiedTime) : new Date(),
          groupKey: f.taskId,
          workspaceFile: {
            taskId: f.taskId,
            path: f.path,
            name: f.name,
            type: f.type,
          },
        });
      });
    if (chatId) {
      toolExecutions.forEach((tool) => {
        items.push({
          id: `tool-${tool.id}`,
          kind: "tool",
          title: getToolDisplayName(tool.name, t),
          subtitle: undefined,
          date: tool.timestamp,
          groupKey: "tools",
          toolExecution: tool,
        });
      });
    }
    return items;
  }, [workspaceFiles, toolExecutions, chatId, t]);

  /** For My files: user-uploaded knowledge base files only; groupKey uses associated event id to support grouping by event */
  const myFilesItems = useMemo((): LibraryItem[] => {
    const items = knowledgeFiles.map((f) => ({
      id: `kb-${f.id}`,
      kind: "knowledge_file" as const,
      title: f.fileName,
      subtitle: undefined,
      date: new Date(f.uploadedAt),
      groupKey: f.insightId ?? "knowledge",
      knowledgeFile: f,
    }));
    return items;
  }, [knowledgeFiles]);

  /** Current tab's item list (used for filtering and grouping) */
  const allItems = useMemo(
    () => (activeTab === "myfiles" ? myFilesItems : vaultItems),
    [activeTab, myFilesItems, vaultItems],
  );

  /** Collect workspace-related chatIds, request library metadata (for Chat Vault grouping) */
  const uniqueChatIds = useMemo(() => {
    const ids = new Set<string>();
    vaultItems.forEach((item) => {
      if (
        item.groupKey &&
        item.groupKey !== "knowledge" &&
        item.groupKey !== "tools"
      ) {
        ids.add(item.groupKey);
      }
    });
    return Array.from(ids);
  }, [vaultItems]);

  useEffect(() => {
    if (uniqueChatIds.length === 0) {
      setChatMeta({});
      return;
    }
    const q = new URLSearchParams({ chatIds: uniqueChatIds.join(",") });
    fetch(`/api/library/meta?${q}`)
      .then((res) => (res.ok ? res.json() : { chats: {} }))
      .then((data: LibraryMetaResponse) => setChatMeta(data.chats ?? {}))
      .catch(() => setChatMeta({}));
  }, [uniqueChatIds.join(",")]);

  /** Filter by file type + tool + search */
  const filteredItems = useMemo(() => {
    let list = allItems;
    if (filterType === "tools") {
      list = list.filter((i) => i.kind === "tool");
    } else if (filterType !== "all") {
      list = list.filter((item) => {
        if (item.kind === "tool") return false;
        const cat = getFileTypeCategory(getExtFromItem(item));
        return cat === filterType;
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subtitle?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [allItems, filterType, searchQuery]);

  /** Grouping (none / conversation / time / event / folder) */
  const grouped = useMemo(() => {
    const sortList = (arr: LibraryItem[]) =>
      [...arr].sort((a, b) => b.date.getTime() - a.date.getTime());

    if (effectiveGroupBy === "none") {
      return [
        {
          label: t("workspace.groupAll", "All"),
          items: sortList(filteredItems),
          key: "__all__",
        },
      ];
    }

    if (effectiveGroupBy === "conversation") {
      const map = new Map<string, LibraryItem[]>();
      filteredItems.forEach((item) => {
        const key = item.groupKey;
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(item);
      });
      return Array.from(map.entries()).map(([key, list]) => {
        let label: string;
        if (key === "knowledge") label = t("workspace.knowledgeGroup");
        else if (key === "tools") label = t("workspace.toolsGroup");
        else
          label =
            chatMeta[key]?.title?.trim() || key || t("workspace.untitledChat");
        return { label, items: sortList(list), key };
      });
    }

    if (effectiveGroupBy === "time") {
      const byDay = new Map<string, LibraryItem[]>();
      filteredItems.forEach((item) => {
        const dayKey = item.date.toISOString().slice(0, 10);
        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
        byDay.get(dayKey)?.push(item);
      });
      return Array.from(byDay.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dayKey, list]) => ({
          label: getDateGroupLabel(
            new Date(`${dayKey}T12:00:00`),
            i18n.language,
          ),
          items: sortList(list),
          key: dayKey,
        }));
    }

    if (effectiveGroupBy === "event") {
      const map = new Map<string, LibraryItem[]>();
      const fallbackKey = "__unchained__";
      filteredItems.forEach((item) => {
        let key: string;
        // My files: knowledge base files with associated events are grouped by event
        if (
          item.kind === "knowledge_file" &&
          item.knowledgeFile?.insightId &&
          item.knowledgeFile?.insightTitle
        ) {
          key = `insight:${item.knowledgeFile.insightId}:${item.knowledgeFile.insightTitle}`;
        } else if (item.groupKey === "knowledge" || item.groupKey === "tools") {
          key = fallbackKey;
        } else {
          const meta = chatMeta[item.groupKey];
          const first = meta?.insights?.[0];
          key = first ? `insight:${first.id}:${first.title}` : fallbackKey;
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(item);
      });
      return Array.from(map.entries()).map(([key, list]) => {
        const label =
          key === fallbackKey
            ? activeTab === "myfiles"
              ? t("workspace.publicGroup")
              : t("workspace.unchainedEvent")
            : key.startsWith("insight:")
              ? key.replace(/^insight:[^:]+:/, "")
              : key;
        return { label, items: sortList(list), key };
      });
    }

    if (effectiveGroupBy === "folder") {
      const map = new Map<string, LibraryItem[]>();
      const uncategorizedKey = "__uncategorized__";
      filteredItems.forEach((item) => {
        let key: string;
        if (item.kind === "workspace_file" && item.workspaceFile?.path) {
          const folder = getFolderFromPath(item.workspaceFile.path);
          key = folder === "" ? "__root__" : folder;
        } else {
          key = uncategorizedKey;
        }
        if (!map.has(key)) map.set(key, []);
        map.get(key)?.push(item);
      });
      const rootLabel = t("workspace.groupRoot");
      const uncatLabel = t("workspace.groupUncategorized");
      return Array.from(map.entries())
        .sort(([a], [b]) => {
          if (a === "__root__") return -1;
          if (b === "__root__") return 1;
          if (a === uncategorizedKey) return 1;
          if (b === uncategorizedKey) return -1;
          return a.localeCompare(b);
        })
        .map(([key, list]) => ({
          label:
            key === "__root__"
              ? rootLabel
              : key === uncategorizedKey
                ? uncatLabel
                : key,
          items: sortList(list),
          key,
        }));
    }

    return [];
  }, [filteredItems, effectiveGroupBy, chatMeta, activeTab, t, i18n.language]);

  /** My notes: by search + grouping */
  const filteredNotes = useMemo(() => {
    let list = libraryNotes;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (n) =>
          n.content.toLowerCase().includes(q) ||
          n.insightTitle.toLowerCase().includes(q),
      );
    }
    return list;
  }, [libraryNotes, searchQuery]);

  const groupedNotes = useMemo(() => {
    const sortByDate = (arr: LibraryNoteItem[]) =>
      [...arr].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    if (effectiveGroupBy === "none" || activeTab !== "mynotes") {
      return [
        {
          label: t("workspace.groupAll", "All"),
          items: sortByDate(filteredNotes),
          key: "__all__",
        },
      ];
    }
    if (effectiveGroupBy === "time") {
      const byDay = new Map<string, LibraryNoteItem[]>();
      filteredNotes.forEach((n) => {
        const dayKey = new Date(n.createdAt).toISOString().slice(0, 10);
        if (!byDay.has(dayKey)) byDay.set(dayKey, []);
        byDay.get(dayKey)?.push(n);
      });
      return Array.from(byDay.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dayKey, list]) => ({
          label: getDateGroupLabel(
            new Date(`${dayKey}T12:00:00`),
            i18n.language,
          ),
          items: sortByDate(list),
          key: dayKey,
        }));
    }
    if (effectiveGroupBy === "event") {
      const byEvent = new Map<string, LibraryNoteItem[]>();
      filteredNotes.forEach((n) => {
        const key = n.insightTitle.trim() || t("workspace.untitledChat");
        if (!byEvent.has(key)) byEvent.set(key, []);
        byEvent.get(key)?.push(n);
      });
      // Public groups use i18n display (backend common insight title is fixed as "Public")
      return Array.from(byEvent.entries()).map(([key, list]) => ({
        label: key === "Public" ? t("workspace.publicGroup") : key,
        items: sortByDate(list),
        key,
      }));
    }
    return [
      {
        label: t("workspace.groupAll", "All"),
        items: sortByDate(filteredNotes),
        key: "__all__",
      },
    ];
  }, [activeTab, effectiveGroupBy, filteredNotes, t, i18n.language]);

  const isLoading = isRefreshing
    ? false
    : activeTab === "mynotes"
      ? loadingNotes
      : activeTab === "myfiles"
        ? loadingKnowledge || isUploadingMyFiles
        : loadingWorkspace;
  // Disable infinite load when there are filter conditions (filtering is only frontend, no need to load more)
  const canLoadMore =
    hasFilter || activeTab === "mynotes"
      ? false
      : activeTab === "myfiles"
        ? knowledgeHasMore
        : workspaceHasMore;

  return (
    <>
      <div className="h-full flex-1 flex flex-col min-w-0">
        <header className="shrink-0 px-6 py-6 bg-card">
          {/* Desktop: same row, mobile: vertical (gap takes effect at sm and above) */}
          <div className="flex items-center gap-4 flex-wrap sm:flex-nowrap">
            <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground flex-1 min-w-0 leading-10">
              {t("agent.panels.workspacePanel.title", "Library")}
            </h1>
            {chatId && activeTab === "stuff" ? (
              <button
                type="button"
                onClick={() => {
                  router.push(
                    `/?page=chat&chatId=${encodeURIComponent(chatId)}`,
                  );
                }}
                className="text-sm text-primary hover:underline inline-flex items-center gap-1 w-fit bg-transparent border-0 p-0 cursor-pointer text-left shrink-0"
              >
                <RemixIcon name="chat" size="size-4" />
                <span className="hidden sm:inline">
                  {t("workspace.openChat", "Open in chat")}
                </span>
                <span className="sm:hidden">{t("common.chat", "Chat")}</span>
              </button>
            ) : null}
            {/* Desktop: tabs and title on same row, mobile: wrap */}
            <div className="flex gap-1 rounded-lg border border-border/60 p-1 bg-surface-muted/50 overflow-x-auto no-scrollbar w-full sm:w-auto sm:shrink-0">
              <button
                type="button"
                onClick={() => setLibraryTab("mynotes")}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  activeTab === "mynotes"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                )}
              >
                <RemixIcon
                  name="file_text"
                  size="size-4"
                  filled={activeTab === "mynotes"}
                />
                <span className="hidden xs:inline">
                  {t("library.tabMyNotes", "My notes")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLibraryTab("myfiles")}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  activeTab === "myfiles"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                )}
              >
                <RemixIcon
                  name="attachment"
                  size="size-4"
                  filled={activeTab === "myfiles"}
                />
                <span className="hidden xs:inline">
                  {t("library.tabMyFiles", "My files")}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setLibraryTab("stuff")}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 rounded-md text-sm font-medium transition-colors shrink-0",
                  activeTab === "stuff"
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover",
                )}
              >
                <RemixIcon
                  name="folder_4_line"
                  size="size-4"
                  filled={activeTab === "stuff"}
                />
                <span className="hidden xs:inline">
                  {t("library.tabChatVault", "Chat Vault")}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* One row: view switch on left, search/filter/upload on right (shared layout for My notes, My files, Chat Vault) */}
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 px-6 py-2">
          <div className="flex rounded-md border border-border/60 overflow-hidden shrink-0">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 rounded-none"
              onClick={() => setViewMode("list")}
              aria-label={t("workspace.viewList", "List")}
            >
              <RemixIcon name="list" size="size-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="sm"
              className="h-9 rounded-none"
              onClick={() => setViewMode("grid")}
              aria-label={t("workspace.viewGrid", "Grid")}
            >
              <RemixIcon name="layout_grid" size="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 shrink-0 min-w-0">
            <div className="relative w-full min-w-[120px] sm:w-48">
              <RemixIcon
                name="search"
                size="size-4"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              />
              <Input
                placeholder={
                  activeTab === "mynotes"
                    ? t("workspace.searchPlaceholderNotes", "Search notes")
                    : t("workspace.searchPlaceholder", "Search files")
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-9 text-sm bg-muted/50 border border-border/60 rounded-md"
              />
            </div>
            {activeTab !== "mynotes" && (
              <Select
                value={
                  activeTab === "myfiles" && filterType === "tools"
                    ? "all"
                    : filterType
                }
                onValueChange={(v: FileTypeFilter) => setFilterType(v)}
              >
                <SelectTrigger
                  hideIcon
                  className={cn(
                    "h-9 w-9 p-0 shrink-0 [&>span:first-child]:flex [&>span:first-child]:flex-1 [&>span:first-child]:justify-center [&>span:first-child]:min-w-0 [&>span:first-child>*:not(:first-child)]:hidden [&>span:first-child>*:not(:first-child)]:w-0 [&>span:first-child>*:not(:first-child)]:overflow-hidden",
                    (activeTab === "myfiles" ? filterType !== "tools" : true) &&
                      filterType !== "all" &&
                      "bg-secondary border-primary/50",
                  )}
                  aria-label={t("workspace.filterAll")}
                >
                  <RemixIcon
                    name={
                      FILTER_ICON_MAP[
                        activeTab === "myfiles" && filterType === "tools"
                          ? "all"
                          : filterType
                      ]
                    }
                    size="size-4"
                    className="shrink-0 text-muted-foreground"
                  />
                  <SelectValue placeholder="" />
                </SelectTrigger>
                <SelectContent className="[&>*]:justify-start">
                  <SelectItem value="all">
                    <RemixIcon
                      name="filter"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterAll")}
                  </SelectItem>
                  <SelectItem value="slides">
                    <RemixIcon
                      name="slideshow"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterSlides")}
                  </SelectItem>
                  <SelectItem value="website">
                    <RemixIcon
                      name="code"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterWebsite")}
                  </SelectItem>
                  <SelectItem value="document">
                    <RemixIcon
                      name="file_text"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterDocument")}
                  </SelectItem>
                  <SelectItem value="imageVideo">
                    <RemixIcon
                      name="image"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterImageVideo")}
                  </SelectItem>
                  <SelectItem value="audio">
                    <RemixIcon
                      name="music_2"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterAudio")}
                  </SelectItem>
                  <SelectItem value="spreadsheet">
                    <RemixIcon
                      name="table_2"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterSpreadsheet")}
                  </SelectItem>
                  <SelectItem value="other">
                    <RemixIcon
                      name="more_2"
                      size="size-4"
                      className="shrink-0 text-muted-foreground"
                    />
                    {t("workspace.filterOther")}
                  </SelectItem>
                  {activeTab !== "myfiles" && (
                    <SelectItem value="tools">
                      <RemixIcon
                        name="layers"
                        size="size-4"
                        className="shrink-0 text-muted-foreground"
                      />
                      {t("workspace.filterTools")}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {activeTab === "mynotes" && (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="h-9 gap-1.5 shrink-0"
                onClick={() => setIsAddNoteDialogOpen(true)}
                aria-label={t("workspace.addNote", "Add note")}
              >
                <RemixIcon name="edit" size="size-4" />
                <span className="hidden xs:inline">
                  {t("workspace.addShort", "Add")}
                </span>
              </Button>
            )}
            {activeTab === "myfiles" && (
              <>
                <input
                  ref={myFilesInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.txt,.md,.html,.htm,.xls,.xlsx,.csv,.ppt,.pptx"
                  onChange={handleMyFilesUpload}
                />
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-9 gap-1.5 shrink-0"
                  disabled={isUploadingMyFiles}
                  onClick={() => myFilesInputRef.current?.click()}
                  aria-label={t("workspace.uploadFile", "Upload file")}
                >
                  {isUploadingMyFiles ? (
                    <Spinner size={16} />
                  ) : (
                    <RemixIcon name="upload_2" size="size-4" />
                  )}
                  <span className="hidden xs:inline">
                    {t("workspace.uploadShort", "Upload")}
                  </span>
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea ref={setupPullToRefresh} className="flex-1 min-h-0">
          {/* Pull-to-refresh trigger */}
          <div
            ref={triggerRef as LegacyRef<HTMLDivElement>}
            className="w-full h-1"
          />

          {isLoading ? (
            <div className="flex flex-row items-center p-2 text-muted-foreground justify-center">
              <Spinner size={20} />
              <div>{t("common.loading")}</div>
            </div>
          ) : activeTab === "mynotes" ? (
            groupedNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground text-sm">
                <RemixIcon
                  name="file_text"
                  size="size-10"
                  className="mb-2 opacity-50"
                />
                <p>{t("workspace.emptyStateMyNotes", "No notes yet")}</p>
              </div>
            ) : (
              <div key={effectiveGroupBy} className="px-6 py-3 space-y-6">
                {groupedNotes.map(({ label, items, key }) => (
                  <div key={key}>
                    <h2 className="text-sm font-medium text-muted-foreground mb-2">
                      {label}
                    </h2>
                    <ul
                      className={cn(
                        viewMode === "grid"
                          ? "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 min-w-0"
                          : "space-y-1 min-w-0",
                      )}
                    >
                      {items.map((note) => (
                        <LibraryNoteRow
                          key={note.id}
                          note={note}
                          viewMode={viewMode}
                          t={t as (key: string, fallback?: string) => string}
                          onOpenEvent={handleOpenEvent}
                          onDeleteNote={handleDeleteNote}
                        />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )
          ) : grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground text-sm">
              <RemixIcon
                name={activeTab === "myfiles" ? "file_input" : "folder_open"}
                size="size-10"
                className="mb-2 opacity-50"
              />
              <p>
                {activeTab === "myfiles"
                  ? t("workspace.emptyStateMyFiles", "No uploaded files")
                  : t("workspace.emptyState")}
              </p>
            </div>
          ) : (
            <div key={effectiveGroupBy} className="px-6 py-3 space-y-6">
              {grouped.map(({ label, items, key }) => (
                <div key={key}>
                  <h2 className="text-sm font-medium text-muted-foreground mb-2">
                    {label}
                  </h2>
                  <ul
                    className={cn(
                      viewMode === "grid"
                        ? "grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 min-w-0"
                        : "space-y-1 min-w-0",
                    )}
                  >
                    {items.map((item) => (
                      <LibraryItemRow
                        key={item.id}
                        item={item}
                        viewMode={viewMode}
                        t={t as (key: string, fallback?: string) => string}
                        onOpenFile={(wf) => {
                          setSelectedFile({
                            path: wf.path,
                            name: wf.name,
                            type: wf.type || "",
                            taskId: wf.taskId,
                          });
                          setIsPreviewPanelOpen(true);
                        }}
                        onLocateToChat={(chatId) =>
                          router.push(
                            `/?page=chat&chatId=${encodeURIComponent(chatId)}`,
                          )
                        }
                        onOpenEvent={
                          activeTab === "myfiles" ? handleOpenEvent : undefined
                        }
                        onPreviewKnowledgeFile={
                          activeTab === "myfiles"
                            ? setPreviewKnowledgeDocumentId
                            : undefined
                        }
                        onDeleteKnowledgeFile={
                          activeTab === "myfiles"
                            ? handleDeleteKnowledgeFile
                            : undefined
                        }
                        onDeleteWorkspaceFile={
                          activeTab === "stuff"
                            ? handleDeleteWorkspaceFile
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Infinite load trigger */}
          {canLoadMore && !isLoading && (
            <div ref={loadMoreRef} className="h-10 w-full">
              <div className="flex flex-row items-center p-2 text-muted-foreground justify-center">
                <Spinner size={20} />
                <div>{t("common.loading")}</div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Storage space info display */}
        <StorageFooter />
      </div>

      {isPreviewPanelOpen && selectedFile && (
        <>
          <div
            role="button"
            tabIndex={0}
            className="fixed inset-0 z-[1000] bg-slate-950/30 transition-opacity duration-300 ease-out pointer-events-none md:pointer-events-auto"
            onClick={() => setIsPreviewPanelOpen(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setIsPreviewPanelOpen(false);
              }
            }}
            style={{ opacity: isPreviewPanelOpen ? 1 : 0 }}
          />
          <div
            className={cn(
              "fixed top-0 right-0 z-[1001] h-full max-h-screen min-w-0 flex-col border-l border-border/60 bg-background shadow-2xl transition-transform duration-300 ease-out md:w-[800px] lg:w-[900px] w-full",
              isPreviewPanelOpen ? "translate-x-0" : "translate-x-full",
            )}
          >
            <FilePreviewPanel
              file={{
                path: selectedFile.path,
                name: selectedFile.name,
                type: selectedFile.type,
              }}
              taskId={selectedFile.taskId}
              onClose={() => setIsPreviewPanelOpen(false)}
            />
          </div>
        </>
      )}

      {/* My files: knowledge base document preview sidebar */}
      {previewKnowledgeDocumentId && (
        <KnowledgeDocumentPreviewPanel
          documentId={previewKnowledgeDocumentId}
          onClose={() => setPreviewKnowledgeDocumentId(null)}
          t={t as (key: string, fallback?: string) => string}
        />
      )}

      {/* My notes: add note dialog (belongs to public) */}
      <Dialog open={isAddNoteDialogOpen} onOpenChange={setIsAddNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("workspace.addNote", "Add note")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t(
              "workspace.addNoteBelongCommon",
              "Notes will belong to 'Public'",
            )}
          </p>
          <Textarea
            placeholder={t(
              "workspace.addNotePlaceholder",
              "Enter note content...",
            )}
            value={addNoteDraft}
            onChange={(e) => setAddNoteDraft(e.target.value)}
            className="min-h-[120px] resize-y"
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddNoteDialogOpen(false);
                setAddNoteDraft("");
              }}
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={!addNoteDraft.trim()}
              onClick={async () => {
                const content = addNoteDraft.trim();
                if (!content) return;
                await handleAddNote(content);
                setIsAddNoteDialogOpen(false);
                setAddNoteDraft("");
              }}
            >
              {t("common.confirm", "Confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Format bytes */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Storage space footer display component */
function StorageFooter() {
  const { t } = useTranslation();
  const {
    data: overview,
    isLoading: loadingOverview,
    refresh: refreshOverview,
  } = useDiskUsage();
  const { data: sessions, isLoading: loadingSessions } = useSessions();

  const [confirmClean, setConfirmClean] = useState<string | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const handleClean = async (category: string) => {
    setCleaning(true);
    try {
      const res = await fetch("/api/storage/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      if (res.ok) {
        refreshOverview();
        invalidateSessions();
        toast({
          type: "success",
          description: t("workspace.storageDeleted", "Deleted successfully"),
        });
      } else {
        throw new Error("Cleanup failed");
      }
    } catch {
      toast({
        type: "error",
        description: t("workspace.storageCleanupFailed", "Cleanup failed"),
      });
    } finally {
      setCleaning(false);
      setConfirmClean(null);
    }
  };

  const handleDeleteAllSessions = async () => {
    setCleaning(true);
    try {
      const res = await fetch("/api/storage/sessions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deleteAll: true }),
      });
      if (res.ok) {
        invalidateSessions();
        invalidateDiskUsage();
        toast({
          type: "success",
          description: t("workspace.storageDeleted", "Deleted successfully"),
        });
      } else {
        throw new Error("Delete failed");
      }
    } catch {
      toast({
        type: "error",
        description: t("workspace.storageCleanupFailed", "Cleanup failed"),
      });
    } finally {
      setCleaning(false);
      setConfirmClean(null);
    }
  };

  const isLoading = !overview;
  const totalBytes = overview?.totalBytes ?? 0;
  const categories = overview?.categories ?? [];

  const catLabel = (key: string) => {
    const labels: Record<string, string> = {
      sessions: t("workspace.storageCategory.sessions", "Sessions"),
      logs: t("workspace.storageCategory.logs", "Logs"),
      cache: t("workspace.storageCategory.cache", "Cache"),
      storage: t("workspace.storageCategory.storage", "Storage"),
      database: t("workspace.storageCategory.database", "Database"),
      skills: t("workspace.storageCategory.skills", "Skills"),
      "agent-browser": t(
        "workspace.storageCategory.agent-browser",
        "Agent browser",
      ),
    };
    return labels[key] ?? key;
  };

  return (
    <>
      <div className="shrink-0 px-6 py-2 border-t border-border/60 bg-muted/20">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <RemixIcon name="hard_drive_2_line" size="size-3.5" />
            <span>
              {t("workspace.storage", "Storage")}:{" "}
              {isLoading ? "..." : formatBytes(totalBytes)}
            </span>
          </div>
          {categories
            .filter((cat) => cat.key !== "agent-browser")
            .map((cat) => {
              if (cat.sizeBytes === 0) return null;
              return (
                <div
                  key={cat.key}
                  className="flex items-center gap-1 text-xs text-muted-foreground"
                >
                  <span className="font-medium">{catLabel(cat.key)}</span>
                  <span>{formatBytes(cat.sizeBytes)}</span>
                  {["sessions", "logs", "cache"].includes(cat.key) && (
                    <button
                      type="button"
                      className="ml-0.5 text-xs text-primary/60 hover:text-primary underline"
                      onClick={() => setConfirmClean(cat.key)}
                      disabled={cleaning}
                    >
                      {t("workspace.storageCleanup", "Cleanup")}
                    </button>
                  )}
                </div>
              );
            })}
          {sessions.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span>{sessions.length}</span>
              <span>{t("workspace.storageCategory.sessions", "Sessions")}</span>
              <button
                type="button"
                className="ml-0.5 text-xs text-primary/60 hover:text-primary underline"
                onClick={() => setConfirmClean("browser-temp")}
                disabled={cleaning}
              >
                {t("workspace.storageCleanBrowserTemp", "Clear browser cache")}
              </button>
              <span className="text-muted-foreground/40">|</span>
              <button
                type="button"
                className="text-xs text-destructive/60 hover:text-destructive underline"
                onClick={() => setConfirmClean("sessions")}
                disabled={cleaning}
              >
                {t("workspace.storageDeleteAllSessions", "Delete all")}
              </button>
            </div>
          )}
        </div>
      </div>

      <AlertDialog
        open={confirmClean !== null}
        onOpenChange={(o) => !o && setConfirmClean(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workspace.storageCleanup", "Cleanup")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmClean === "sessions"
                ? t(
                    "workspace.storageConfirmDeleteAll",
                    "Are you sure you want to delete all sessions? This action cannot be undone.",
                  )
                : confirmClean === "browser-temp"
                  ? t(
                      "workspace.storageConfirmBrowserTemp",
                      "Are you sure you want to clear browser temp files from all sessions? This action cannot be undone.",
                    )
                  : t(
                      "workspace.storageConfirmClean",
                      "Are you sure you want to cleanup? This action cannot be undone.",
                    )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmClean === "sessions") {
                  handleDeleteAllSessions();
                } else if (confirmClean) {
                  handleClean(confirmClean);
                }
              }}
              disabled={cleaning}
            >
              {cleaning ? (
                <Spinner size={16} />
              ) : (
                t("workspace.storageCleanup", "Cleanup")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * Knowledge base document preview side panel: fetch document details and display filename and chunked content
 */
function KnowledgeDocumentPreviewPanel({
  documentId,
  onClose,
  t,
}: {
  documentId: string;
  onClose: () => void;
  t: (key: string, fallback?: string) => string;
}) {
  const [doc, setDoc] = useState<{
    fileName: string;
    chunks: Array<{ content: string; chunkIndex: number }>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/rag/documents/${documentId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch");
        return res.json();
      })
      .then(
        (data: {
          document?: {
            fileName: string;
            chunks?: Array<{ content: string; chunkIndex: number }>;
          };
        }) => {
          if (cancelled) return;
          const d = data.document;
          if (d) {
            setDoc({
              fileName: d.fileName,
              chunks: (d.chunks ?? []).sort(
                (a, b) => a.chunkIndex - b.chunkIndex,
              ),
            });
          }
        },
      )
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [documentId]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        className="fixed inset-0 z-40 bg-slate-950/30 transition-opacity duration-300 ease-out"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      <div className="fixed top-0 right-0 z-50 h-full max-h-screen w-full min-w-0 flex flex-col border-l border-border/60 bg-background shadow-2xl md:w-[800px] lg:w-[900px]">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
          <h2 className="truncate text-sm font-medium">
            {doc?.fileName ?? documentId}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={onClose}
            aria-label={t("common.close", "Close")}
          >
            <RemixIcon name="close" size="size-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0 px-4 py-3">
          {loading ? (
            <div className="flex flex-row items-center p-2 text-muted-foreground justify-center">
              <Spinner size={20} />
              <div>{t("common.loading")}</div>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : doc ? (
            <div className="space-y-4 text-sm text-foreground whitespace-pre-wrap break-words">
              {doc.chunks.length === 0 ? (
                <p className="text-muted-foreground">
                  {t("workspace.previewNoContent", "No content")}
                </p>
              ) : (
                doc.chunks.map((chunk, i) => (
                  <div
                    key={`chunk-${i}-${String(chunk.content).slice(0, 40)}`}
                    className="rounded-md bg-muted/50 p-3"
                  >
                    {chunk.content}
                  </div>
                ))
              )}
            </div>
          ) : null}
        </ScrollArea>
      </div>
    </>
  );
}

function LibraryItemRow({
  item,
  viewMode,
  t,
  onOpenFile,
  onLocateToChat,
  onOpenEvent,
  onPreviewKnowledgeFile,
  onDeleteKnowledgeFile,
  onDeleteWorkspaceFile,
}: {
  item: LibraryItem;
  viewMode: "list" | "grid";
  t: (key: string, fallback?: string) => string;
  onOpenFile: (wf: {
    taskId: string;
    path: string;
    name: string;
    type?: string;
  }) => void;
  /** Locate to source conversation (show "Open in chat" when taskId exists) */
  onLocateToChat?: (chatId: string) => void;
  /** Open associated event in My files */
  onOpenEvent?: (insightId: string) => void;
  /** Preview knowledge base file in My files */
  onPreviewKnowledgeFile?: (documentId: string) => void;
  /** Delete knowledge base file in My files */
  onDeleteKnowledgeFile?: (documentId: string) => void;
  /** Delete workspace file in Chat vault */
  onDeleteWorkspaceFile?: (wf: { taskId: string; path: string }) => void;
}) {
  const iconName = item.kind === "tool" ? "layers" : "file_text";
  const ext = getExtFromItem(item);
  const previewKind = getLibraryPreviewKind(ext);
  const { titleLine, bodyLine } = getLibraryPreviewLines(item);
  const [snapshotText, setSnapshotText] = useState<string>("");
  const [snapshotHtml, setSnapshotHtml] = useState<string>("");
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const color =
    item.kind === "workspace_file"
      ? getFileColor(item.title)
      : item.kind === "knowledge_file"
        ? "text-blue-500"
        : "text-amber-500";

  const handleClick = () => {
    if (item.workspaceFile) {
      onOpenFile(item.workspaceFile);
      return;
    }
    if (
      item.kind === "knowledge_file" &&
      item.knowledgeFile?.id &&
      onPreviewKnowledgeFile
    ) {
      onPreviewKnowledgeFile(item.knowledgeFile.id);
    }
  };

  /** Unified time format and style (consistent with notes, file cards) */
  const dateLabel = item.date.toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  useEffect(() => {
    let cancelled = false;
    if (viewMode !== "grid") return;
    if (!["website", "markdown"].includes(previewKind)) return;
    const updatedAt = item.date.getTime();
    const cacheKey = getLibraryPreviewCacheKey(item);
    if (cacheKey) {
      const cached = readLibraryPreviewSnapshot(cacheKey, updatedAt);
      if (cached) {
        setSnapshotText(cached.text);
        setSnapshotHtml(cached.html ?? "");
        setSnapshotLoading(false);
        return;
      }
    }

    const loadSnapshot = async () => {
      setSnapshotLoading(true);
      try {
        let content = "";
        if (item.kind === "workspace_file" && item.workspaceFile) {
          const { taskId, path } = item.workspaceFile;
          const res = await fetch(
            `/api/workspace/file/${encodeURIComponent(taskId)}/${encodeURIComponent(path)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as { content?: string };
            content = data.content ?? "";
          }
        } else if (item.kind === "knowledge_file" && item.knowledgeFile?.id) {
          const res = await fetch(
            `/api/rag/documents/${encodeURIComponent(item.knowledgeFile.id)}`,
          );
          if (res.ok) {
            const data = (await res.json()) as {
              document?: {
                chunks?: Array<{ content: string; chunkIndex: number }>;
              };
            };
            const chunks = (data.document?.chunks ?? []).sort(
              (a, b) => a.chunkIndex - b.chunkIndex,
            );
            content = chunks.map((c) => c.content).join("\n");
          }
        }

        if (!cancelled) {
          const textSnapshot =
            previewKind === "website"
              ? toHtmlSnapshotText(content)
              : toMarkdownSnapshotText(content);
          const htmlSnapshot =
            previewKind === "website" ? toSafeHtmlSnapshot(content) : "";
          setSnapshotText(textSnapshot);
          setSnapshotHtml(htmlSnapshot);
          if (cacheKey) {
            writeLibraryPreviewSnapshot(cacheKey, {
              text: textSnapshot,
              html: htmlSnapshot,
              updatedAt,
            });
          }
        }
      } catch {
        if (!cancelled) {
          setSnapshotText("");
          setSnapshotHtml("");
        }
      } finally {
        if (!cancelled) setSnapshotLoading(false);
      }
    };

    void loadSnapshot();
    return () => {
      cancelled = true;
    };
  }, [item, previewKind, viewMode]);

  /** Grid card menu: only show destructive actions (e.g., delete) in title-right menu */
  const titleMenu = (
    <>
      {item.workspaceFile && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={(e) => e.stopPropagation()}
              aria-label={t("common.more", "More")}
            >
              <RemixIcon name="more_2" size="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {item.workspaceFile.taskId && onLocateToChat && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  const taskId = item.workspaceFile?.taskId;
                  if (!taskId) return;
                  onLocateToChat(taskId);
                }}
              >
                <RemixIcon name="external_link" size="size-4" />
                <span>{t("library.openChat", "Open chat")}</span>
              </DropdownMenuItem>
            )}
            {onDeleteWorkspaceFile && (
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  const wf = item.workspaceFile;
                  if (!wf) return;
                  onDeleteWorkspaceFile({ taskId: wf.taskId, path: wf.path });
                }}
              >
                <RemixIcon name="delete_bin" size="size-4" />
                <span>{t("common.delete", "Delete")}</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {item.kind === "knowledge_file" &&
        item.knowledgeFile &&
        onDeleteKnowledgeFile && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("common.more", "More")}
              >
                <RemixIcon name="more_2" size="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  const id = item.knowledgeFile?.id;
                  if (id) onDeleteKnowledgeFile(id);
                }}
              >
                <RemixIcon name="delete_bin" size="size-4" />
                <span>{t("common.delete", "Delete")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
    </>
  );

  /** Non-preview actions only; preview is handled by clicking card */
  const actionButtons = (
    <div className="shrink-0 flex items-center gap-1">
      {item.workspaceFile?.taskId && onLocateToChat && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          onClick={(e) => {
            e.stopPropagation();
            const taskId = item.workspaceFile?.taskId;
            if (taskId) onLocateToChat(taskId);
          }}
          aria-label={t("library.openChat", "Open chat")}
        >
          <RemixIcon name="external_link" size="size-4" />
        </Button>
      )}
      {item.kind === "knowledge_file" &&
        item.knowledgeFile?.insightId &&
        onOpenEvent && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              const insightId = item.knowledgeFile?.insightId;
              if (insightId) onOpenEvent(insightId);
            }}
            aria-label={t("library.openEvent", "Open event")}
          >
            <RemixIcon name="external_link" size="size-4" />
          </Button>
        )}
    </div>
  );

  if (viewMode === "grid") {
    return (
      <li className="w-full min-w-0">
        <div
          className="w-full min-w-0 flex flex-col items-stretch gap-1.5 p-0 rounded-lg border border-border/60 bg-card text-left overflow-hidden cursor-pointer"
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              handleClick();
            }
          }}
        >
          <div className="relative w-full h-24 rounded-none border-0 overflow-hidden bg-muted/35">
            {previewKind === "website" ? (
              <div className="absolute inset-0 overflow-hidden bg-background">
                {snapshotHtml ? (
                  <iframe
                    title={`${item.title}-snapshot`}
                    sandbox=""
                    scrolling="no"
                    className="h-full w-full scale-[0.62] origin-top-left pointer-events-none [scrollbar-width:none]"
                    style={{ width: "161%", height: "161%" }}
                    srcDoc={snapshotHtml}
                  />
                ) : (
                  <div className="absolute inset-0 p-0">
                    <div className="h-full w-full rounded p-2">
                      <p className="text-[10px] leading-snug text-foreground line-clamp-5 whitespace-pre-wrap">
                        {snapshotLoading
                          ? t("common.loading", "Loading")
                          : snapshotText || titleLine}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : previewKind === "markdown" ? (
              <div className="absolute inset-0 p-0">
                <div className="h-full w-full rounded p-2 overflow-hidden">
                  {snapshotLoading ? (
                    <p className="text-[10px] leading-snug text-foreground line-clamp-5 whitespace-pre-wrap">
                      {t("common.loading", "Loading")}
                    </p>
                  ) : (
                    <div className="h-full overflow-hidden text-[10px] leading-snug text-foreground">
                      <div className="h-full overflow-hidden">
                        <ReactMarkdown
                          className="h-full"
                          remarkPlugins={[remarkGfm]}
                          skipHtml
                          components={{
                            h1: ({ children }) => (
                              <p className="font-semibold mb-1 line-clamp-1">
                                {children}
                              </p>
                            ),
                            h2: ({ children }) => (
                              <p className="font-semibold mb-1 line-clamp-1">
                                {children}
                              </p>
                            ),
                            h3: ({ children }) => (
                              <p className="font-semibold mb-1 line-clamp-1">
                                {children}
                              </p>
                            ),
                            p: ({ children }) => (
                              <p className="mb-1 line-clamp-2">{children}</p>
                            ),
                            li: ({ children }) => (
                              <li className="line-clamp-1">{children}</li>
                            ),
                            ul: ({ children }) => (
                              <ul className="list-disc ml-3 mb-1">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="list-decimal ml-3 mb-1">
                                {children}
                              </ol>
                            ),
                            a: ({ children }) => <span>{children}</span>,
                            code: ({ children }) => <span>{children}</span>,
                            pre: ({ children }) => (
                              <div className="line-clamp-2">{children}</div>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="pl-2 border-l border-border/60 line-clamp-2">
                                {children}
                              </blockquote>
                            ),
                          }}
                        >
                          {snapshotText || titleLine}
                        </ReactMarkdown>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 p-2 flex items-center justify-center bg-gradient-to-br from-muted/50 to-muted/20">
                <div
                  className={cn(
                    "rounded-md flex items-center justify-center size-10 shrink-0",
                    color,
                  )}
                >
                  <RemixIcon name={iconName} size="size-6" />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-2 px-2">
            <p className="text-sm font-medium truncate min-w-0 text-left">
              {item.title}
            </p>
            {titleMenu}
          </div>
          <p className="text-xs text-muted-foreground shrink-0">{dateLabel}</p>
          <div className="flex items-center gap-2 w-full flex-wrap shrink-0">
            {actionButtons}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="w-full min-w-0">
      <div className="w-full min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg border border-border/60 bg-card text-left overflow-hidden">
        <div
          className={cn(
            "shrink-0 rounded-md flex items-center justify-center size-9",
            color,
          )}
        >
          <RemixIcon name={iconName} size="size-5" />
        </div>
        <div className="min-w-0 flex-1 text-left overflow-hidden space-y-0.5">
          <p className="text-sm font-medium truncate">{item.title}</p>
          <p className="text-xs text-muted-foreground truncate">{dateLabel}</p>
        </div>
        {actionButtons}
      </div>
    </li>
  );
}

/**
 * My notes card row: display note content preview, time, support opening event, deletion (don't show source event)
 */
function LibraryNoteRow({
  note,
  viewMode,
  t,
  onOpenEvent,
  onDeleteNote,
}: {
  note: LibraryNoteItem;
  viewMode: "list" | "grid";
  t: (key: string, fallback?: string) => string;
  onOpenEvent: (insightId: string) => void;
  onDeleteNote?: (noteId: string) => void;
}) {
  const contentPreview =
    note.content.length > 80
      ? `${note.content.slice(0, 80).trim()}…`
      : note.content;
  /** Unified time format and style (consistent with files, conversation space cards) */
  const dateLabel = new Date(note.createdAt).toLocaleString(undefined, {
    dateStyle: "short",
    timeStyle: "short",
  });

  /** All are icon buttons, open event uses external_link; delete button placed on the far right */
  const actionButtons = (
    <div className="shrink-0 flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        onClick={(e) => {
          e.stopPropagation();
          onOpenEvent(note.insightId);
        }}
        aria-label={t("library.openEvent", "Open event")}
      >
        <RemixIcon name="external_link" size="size-4" />
      </Button>
      {onDeleteNote && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDeleteNote(note.id);
          }}
          aria-label={t("common.delete", "Delete")}
        >
          <RemixIcon name="delete_bin" size="size-4" />
        </Button>
      )}
    </div>
  );

  if (viewMode === "grid") {
    return (
      <li className="w-full min-w-0">
        <div className="w-full min-w-0 flex flex-col items-stretch gap-1.5 p-3 rounded-lg border border-border/60 bg-card text-left overflow-hidden">
          <div className="shrink-0 rounded-md flex items-center justify-center size-10 text-amber-500">
            <RemixIcon name="file_text" size="size-6" />
          </div>
          <p className="text-sm font-medium line-clamp-2 break-words min-w-0 overflow-hidden">
            {contentPreview}
          </p>
          <p className="text-xs text-muted-foreground shrink-0">{dateLabel}</p>
          <div className="flex items-center gap-2 w-full flex-wrap shrink-0">
            {actionButtons}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="w-full min-w-0">
      <div className="w-full min-w-0 flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 rounded-lg border border-border/60 bg-card text-left overflow-hidden">
        <div className="shrink-0 rounded-md flex items-center justify-center size-9 text-amber-500">
          <RemixIcon name="file_text" size="size-5" />
        </div>
        <div className="min-w-0 flex-1 text-left space-y-0.5 overflow-hidden">
          <p className="text-sm line-clamp-2 break-words">{contentPreview}</p>
          <p className="text-xs text-muted-foreground truncate">{dateLabel}</p>
        </div>
        {actionButtons}
      </div>
    </li>
  );
}
