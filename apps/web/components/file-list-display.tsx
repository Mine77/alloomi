"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "./ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export interface FileInfo {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface FileListDisplayProps {
  files: FileInfo[];
  onFileClick?: (file: FileInfo) => void;
  className?: string;
}

/** Return Remix icon name based on file name/type */
function getFileIconName(fileName: string, type?: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (type === "html" || type === "website") return "globe";
  switch (ext) {
    case "html":
    case "htm":
      return "globe";
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
      return "code";
    case "json":
      return "file_json";
    case "md":
    case "markdown":
      return "file_type";
    case "csv":
      return "file_spreadsheet";
    case "pptx":
    case "ppt":
      return "presentation";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return "file_image";
    case "mp3":
    case "wav":
    case "ogg":
      return "music_2";
    case "mp4":
    case "webm":
    case "mov":
      return "video";
    case "ttf":
    case "otf":
    case "woff":
    case "woff2":
      return "type";
    case "txt":
    default:
      return "file_text";
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${units[i]}`;
}

export function FileListDisplay({
  files,
  onFileClick,
  className,
}: FileListDisplayProps) {
  // Group files by type
  const groupedFiles = useMemo(() => {
    const groups: Record<string, FileInfo[]> = {
      website: [],
      code: [],
      document: [],
      image: [],
      other: [],
    };

    files.forEach((file) => {
      const ext = file.path.split(".").pop()?.toLowerCase();

      if (ext === "html" || ext === "htm" || file.type === "website") {
        groups.website.push(file);
      } else if (
        ["js", "jsx", "ts", "tsx", "json", "css", "scss"].includes(ext || "")
      ) {
        groups.code.push(file);
      } else if (
        ["md", "txt", "pdf", "odt", "rtf", "doc", "docx"].includes(ext || "")
      ) {
        groups.document.push(file);
      } else if (
        ["png", "jpg", "jpeg", "gif", "svg", "webp", "bmp"].includes(ext || "")
      ) {
        groups.image.push(file);
      } else {
        groups.other.push(file);
      }
    });

    return groups;
  }, [files]);

  const totalFiles = files.length;
  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  if (totalFiles === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "mt-4 rounded-lg border border-border/50 bg-muted/30 p-3",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RemixIcon
            name="folder"
            size="size-4"
            className="text-muted-foreground"
          />
          <span className="text-sm font-medium">Generated Files</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {totalFiles} {totalFiles === 1 ? "file" : "files"} ·{" "}
          {formatFileSize(totalSize)}
        </span>
      </div>

      {/* File Grid */}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {/* Website Files */}
        {groupedFiles.website.map((file) => (
          <FileCard
            key={file.path}
            file={file}
            iconName="globe"
            color="text-blue-500"
            onFileClick={onFileClick}
          />
        ))}

        {/* Code Files */}
        {groupedFiles.code.map((file) => (
          <FileCard
            key={file.path}
            file={file}
            iconName="code"
            color="text-emerald-500"
            onFileClick={onFileClick}
          />
        ))}

        {/* Document Files */}
        {groupedFiles.document.map((file) => (
          <FileCard
            key={file.path}
            file={file}
            iconName="file_text"
            color="text-purple-500"
            onFileClick={onFileClick}
          />
        ))}

        {/* Image Files */}
        {groupedFiles.image.map((file) => (
          <FileCard
            key={file.path}
            file={file}
            iconName="file_image"
            color="text-pink-500"
            onFileClick={onFileClick}
          />
        ))}

        {/* Other Files */}
        {groupedFiles.other.map((file) => (
          <FileCard
            key={file.path}
            file={file}
            iconName="file_type"
            color="text-muted-foreground"
            onFileClick={onFileClick}
          />
        ))}
      </div>
    </div>
  );
}

// File Card Component
interface FileCardProps {
  file: FileInfo;
  iconName: string;
  color: string;
  onFileClick?: (file: FileInfo) => void;
}

function FileCard({ file, iconName, color, onFileClick }: FileCardProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          className="h-auto p-2 justify-start hover:bg-accent/50"
          onClick={() => onFileClick?.(file)}
        >
          <RemixIcon
            name={iconName}
            size="size-4"
            className={cn("shrink-0", color)}
          />
          <div className="flex-1 min-w-0 ml-2 text-left">
            <div className="text-sm font-medium truncate">{file.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {formatFileSize(file.size)}
            </div>
          </div>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>{file.path}</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Compact File List (for inline display)
interface CompactFileListProps {
  files: FileInfo[];
  maxFiles?: number;
  onFileClick?: (file: FileInfo) => void;
  className?: string;
}

export function CompactFileList({
  files,
  maxFiles = 5,
  onFileClick,
  className,
}: CompactFileListProps) {
  const displayFiles = files.slice(0, maxFiles);
  const remainingCount = Math.max(0, files.length - maxFiles);

  if (files.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 mt-2", className)}>
      {displayFiles.map((file) => {
        const iconName = getFileIconName(file.name, file.type);
        return (
          <button
            key={file.path}
            type="button"
            onClick={() => onFileClick?.(file)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-muted hover:bg-accent transition-colors"
          >
            <RemixIcon name={iconName} size="size-3" />
            <span className="max-w-20 truncate">{file.name}</span>
          </button>
        );
      })}

      {remainingCount > 0 && (
        <span className="inline-flex items-center px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground">
          +{remainingCount} more
        </span>
      )}
    </div>
  );
}
