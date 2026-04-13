"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { RemixIcon } from "@/components/remix-icon";
import { Button } from "./ui/button";
import { ScrollArea } from "./ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import "../i18n";

export interface WorkspaceFile {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedTime: Date;
  children?: WorkspaceFile[];
  type?: string; // File extension (e.g., "html", "js", "css")
}

interface VirtualComputerProps {
  taskId: string;
  files: WorkspaceFile[];
  onFileSelect?: (file: WorkspaceFile) => void;
  onFileDelete?: (file: WorkspaceFile) => void;
  onRefresh?: () => void;
  className?: string;
  selectedFilePath?: string; // Currently selected file path, used for highlighting
}

/** Get file icon name (RemixIcon) */
function getFileIconName(fileName: string, isDirectory: boolean): string {
  if (isDirectory) {
    return "folder";
  }

  const ext = fileName.split(".").pop()?.toLowerCase();

  switch (ext) {
    case "html":
    case "htm":
      return "globe";
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "json":
      return "code";
    case "md":
    case "markdown":
      return "type";
    case "csv":
      return "file_spreadsheet";
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return "file_image";
    default:
      return "file_text";
  }
}

// Format file size
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

// File tree node component
interface FileTreeNodeProps {
  file: WorkspaceFile;
  level: number;
  onFileSelect?: (file: WorkspaceFile) => void;
  onFileDelete?: (file: WorkspaceFile) => void;
  selectedFilePath?: string; // Currently selected file path
}

// Check if file tree contains the selected file
function treeContainsSelectedFile(
  file: WorkspaceFile,
  selectedFilePath?: string,
): boolean {
  if (!selectedFilePath) return false;
  if (file.path === selectedFilePath) return true;
  if (file.isDirectory && file.children) {
    return file.children.some((child) =>
      treeContainsSelectedFile(child, selectedFilePath),
    );
  }
  return false;
}

function FileTreeNode({
  file,
  level,
  onFileSelect,
  onFileDelete,
  selectedFilePath,
}: FileTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const iconName = getFileIconName(file.name, file.isDirectory);
  const isSelected = !file.isDirectory && file.path === selectedFilePath;

  // If file tree contains selected file, auto-expand
  useEffect(() => {
    if (treeContainsSelectedFile(file, selectedFilePath)) {
      setIsExpanded(true);
    }
  }, [file, selectedFilePath]);

  const handleClick = () => {
    if (file.isDirectory) {
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect?.(file);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete ${file.name}?`)) {
      onFileDelete?.(file);
    }
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        className={cn(
          "flex items-center gap-1.5 py-1 pr-2 text-sm cursor-pointer transition-colors hover:bg-accent/50 rounded",
          file.isDirectory && "font-medium",
          isSelected && "bg-primary/10 text-primary font-medium",
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {file.isDirectory ? (
          <button
            type="button"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <RemixIcon
                name="chevron_down"
                size="size-3.5"
                className="text-muted-foreground"
              />
            ) : (
              <RemixIcon
                name="chevron_right"
                size="size-3.5"
                className="text-muted-foreground"
              />
            )}
          </button>
        ) : (
          <div className="size-3.5 shrink-0" />
        )}

        <RemixIcon
          name={iconName}
          size="size-4"
          className={cn(
            "size-4 shrink-0",
            file.isDirectory
              ? isExpanded
                ? "text-blue-500"
                : "text-blue-400"
              : "text-muted-foreground",
          )}
        />

        <span className="flex-1 truncate">{file.name}</span>

        {!file.isDirectory && (
          <span className="text-xs text-muted-foreground shrink-0">
            {formatFileSize(file.size)}
          </span>
        )}

        {onFileDelete && !file.isDirectory && (
          <button
            type="button"
            className="shrink-0 opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"
            onClick={handleDelete}
          >
            <RemixIcon name="delete_bin" size="size-3" />
          </button>
        )}
      </div>

      {file.isDirectory &&
        isExpanded &&
        file.children &&
        file.children.length > 0 && (
          <div>
            {file.children.map((child) => (
              <FileTreeNode
                key={child.path}
                file={child}
                level={level + 1}
                onFileSelect={onFileSelect}
                onFileDelete={onFileDelete}
                selectedFilePath={selectedFilePath}
              />
            ))}
          </div>
        )}
    </div>
  );
}

// Convert flat file list to tree structure
function buildFileTree(files: WorkspaceFile[]): WorkspaceFile[] {
  const map = new Map<string, WorkspaceFile>();
  const root: WorkspaceFile[] = [];

  // Create mapping
  files.forEach((file) => {
    map.set(file.path, { ...file, children: [] });
  });

  // Build tree
  files.forEach((file) => {
    const node = map.get(file.path);
    if (!node) return;

    const parts = file.path.split("/");
    const parentPath = parts.slice(0, -1).join("/");

    if (parentPath && map.has(parentPath)) {
      const parent = map.get(parentPath);
      if (parent?.children) {
        parent.children.push(node);
      }
    } else {
      root.push(node);
    }
  });

  return root;
}

export function VirtualComputer({
  taskId,
  files,
  onFileSelect,
  onFileDelete,
  onRefresh,
  className,
  selectedFilePath,
}: VirtualComputerProps) {
  const { t } = useTranslation();
  const [selectedSort, setSelectedSort] = useState<"name" | "size" | "time">(
    "name",
  );
  const [sortedFiles, setSortedFiles] = useState<WorkspaceFile[]>(files);

  useEffect(() => {
    const sorted = [...files];

    switch (selectedSort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "size":
        sorted.sort((a, b) => b.size - a.size);
        break;
      case "time":
        sorted.sort((a, b) => {
          const aTime =
            a.modifiedTime instanceof Date
              ? a.modifiedTime.getTime()
              : new Date(a.modifiedTime).getTime();
          const bTime =
            b.modifiedTime instanceof Date
              ? b.modifiedTime.getTime()
              : new Date(b.modifiedTime).getTime();
          return bTime - aTime;
        });
        break;
    }

    setSortedFiles(sorted);
  }, [files, selectedSort]);

  const fileTree = buildFileTree(sortedFiles);
  const fileCount = files.filter((f) => !f.isDirectory).length;
  const dirCount = files.filter((f) => f.isDirectory).length;

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-2">
          <RemixIcon
            name="folder"
            size="size-4"
            className="text-muted-foreground"
          />
          <span className="text-sm font-medium">
            {t("agent.panels.workspacePanel.title", "Workspace")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("agent.panels.workspacePanel.fileCount", {
              fileCount,
              dirCount,
              defaultValue: `${fileCount} files, ${dirCount} dirs`,
            })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {/* Sort */}
          <Select
            value={selectedSort}
            onValueChange={(value: any) => setSelectedSort(value)}
          >
            <SelectTrigger className="h-7 w-auto text-xs border-dashed">
              <SelectValue
                placeholder={t("agent.panels.workspacePanel.sort", "Sort")}
              />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="name">
                {t("agent.panels.workspacePanel.byName", "By Name")}
              </SelectItem>
              <SelectItem value="size">
                {t("agent.panels.workspacePanel.bySize", "By Size")}
              </SelectItem>
              <SelectItem value="time">
                {t("agent.panels.workspacePanel.byTime", "By Time")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Refresh */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onRefresh}
              >
                <RemixIcon name="refresh" size="size-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t("agent.panels.workspacePanel.refresh", "Refresh")}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* File Tree */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {fileTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RemixIcon
                name="folder"
                size="size-8"
                className="text-muted-foreground/50 mb-2"
              />
              <p className="text-sm text-muted-foreground">
                {t("agent.panels.workspacePanel.emptyFiles", "No files yet")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t(
                  "agent.panels.workspacePanel.emptyFilesHint",
                  "Ask AI to generate some files",
                )}
              </p>
            </div>
          ) : (
            <div className="group">
              {fileTree.map((file) => (
                <FileTreeNode
                  key={file.path}
                  file={file}
                  level={0}
                  onFileSelect={onFileSelect}
                  onFileDelete={onFileDelete}
                  selectedFilePath={selectedFilePath}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
