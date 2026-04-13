"use client";

import { FilesPanel } from "./files-panel";
import { FilesPanelHeader } from "./files-panel-header";
import {
  FilesPanelProvider,
  useFilesPanelContext,
} from "./files-panel-context";
import type { ReactNode } from "react";

/**
 * File panel Header component (internal component, uses Context)
 */
function FilesPanelHeaderInner({ children }: { children?: ReactNode }) {
  const { isLoading, isUploading, uploadProgress, fetchFiles, uploadFile } =
    useFilesPanelContext();

  return (
    <FilesPanelHeader
      isLoading={isLoading}
      isUploading={isUploading}
      uploadProgress={uploadProgress || undefined}
      onRefresh={fetchFiles}
      onUpload={uploadFile}
    >
      {children}
    </FilesPanelHeader>
  );
}

/**
 * File panel Header component (external component, provides Context)
 * Note: This component and FilesPanelContent need to be under the same FilesPanelProvider to share state
 * Therefore, in agent-page-client.tsx, use FilesPanelWrapper to wrap them
 */
export function FilesPanelHeaderWrapper({
  children,
}: {
  children?: ReactNode;
}) {
  return (
    <FilesPanelProvider>
      <FilesPanelHeaderInner>{children}</FilesPanelHeaderInner>
    </FilesPanelProvider>
  );
}

/**
 * File panel Content component (internal component, uses Context)
 */
function FilesPanelContentInner() {
  // FilesPanel internally uses useKnowledgeFiles, we need to modify it to use Context
  // Keep as-is for now since FilesPanel needs modification to use Context
  return <FilesPanel />;
}

/**
 * File panel Content component (external component, provides Context)
 * Note: This component and FilesPanelHeaderWrapper need to be under the same FilesPanelProvider to share state
 * Therefore, in agent-page-client.tsx, use FilesPanelWrapper to wrap them
 */
export function FilesPanelContent() {
  return (
    <FilesPanelProvider>
      <FilesPanelContentInner />
    </FilesPanelProvider>
  );
}

/**
 * File panel wrapper component
 * Provides shared Context to ensure header and content use the same state
 */
export function FilesPanelWrapper({
  header,
  content,
}: {
  header: ReactNode;
  content: ReactNode;
}) {
  return (
    <FilesPanelProvider>
      {header}
      {content}
    </FilesPanelProvider>
  );
}
