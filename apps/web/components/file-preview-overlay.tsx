"use client";

import {
  WebsitePreviewDrawer,
  FilePreviewPanel,
} from "@/components/agent/dynamic-panels";

export interface FilePreviewData {
  path: string;
  name: string;
  type: string;
  taskId?: string;
}

export function FilePreviewOverlay({
  file,
  onClose,
}: {
  file: FilePreviewData;
  onClose: () => void;
}) {
  return (
    <>
      {/* Overlay */}
      <div
        role="button"
        tabIndex={0}
        className="fixed inset-0 z-[1000] bg-slate-950/30 transition-opacity duration-300 ease-out pointer-events-none md:pointer-events-auto"
        onClick={onClose}
        onKeyDown={(e) => {
          if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClose();
          }
        }}
      />
      {/* Drawer */}
      <div className="fixed top-0 right-0 z-[1001] h-full max-h-screen min-w-0 flex flex-col border-l border-border/60 bg-white shadow-2xl transition-transform duration-300 ease-out md:w-[600px] lg:w-[800px] w-full">
        {file.type === "html" || file.type === "htm" ? (
          <WebsitePreviewDrawer file={file} onClose={onClose} />
        ) : (
          <FilePreviewPanel
            file={file}
            taskId={file.taskId}
            onClose={onClose}
          />
        )}
      </div>
    </>
  );
}
