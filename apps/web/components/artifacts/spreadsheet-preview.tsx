"use client";

import { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import { Button } from "@alloomi/ui";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { revealItemInDir } from "@/lib/tauri";

interface SheetData {
  name: string;
  data: string[][];
  rowCount: number;
  columnCount: number;
}

interface SpreadsheetPreviewProps {
  file: File | string;
  path?: string;
  className?: string;
  maxHeight?: string;
}

/**
 * Excel/Spreadsheet preview component
 *
 * Supports .xlsx, .xls, .csv, .ods and other spreadsheet file previews
 */
export function SpreadsheetPreview({
  file,
  path,
  className,
  maxHeight = "600px",
}: SpreadsheetPreviewProps) {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [currentSheetIndex, setCurrentSheetIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load workbook
  useEffect(() => {
    let cancelled = false;

    async function loadWorkbook() {
      setLoading(true);
      setError(null);

      try {
        let arrayBuffer: ArrayBuffer;

        if (typeof file === "string") {
          // Load from URL
          const response = await fetch(file);
          if (!response.ok) {
            throw new Error(`Failed to load file: ${response.statusText}`);
          }

          const contentLength = response.headers.get("content-length");
          if (
            contentLength &&
            Number.parseInt(contentLength) > 100 * 1024 * 1024
          ) {
            throw new Error("File too large (max 100MB)");
          }

          arrayBuffer = await response.arrayBuffer();
        } else {
          // Load from File object
          if (file.size > 100 * 1024 * 1024) {
            throw new Error("File too large (max 100MB)");
          }
          arrayBuffer = await file.arrayBuffer();
        }

        if (cancelled) return;

        // Parse workbook
        const wb = XLSX.read(arrayBuffer, { type: "array" });

        if (cancelled) return;

        setWorkbook(wb);

        // Extract all worksheet data
        const sheetData: SheetData[] = [];
        wb.SheetNames.forEach((sheetName) => {
          const worksheet = wb.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, {
            header: 1,
            defval: "",
          });

          if (jsonData && jsonData.length > 0) {
            const rowCount = jsonData.length;
            const columnCount = Math.max(...jsonData.map((row) => row.length));

            sheetData.push({
              name: sheetName,
              data: jsonData as string[][],
              rowCount,
              columnCount,
            });
          }
        });

        setSheets(sheetData);
        setCurrentSheetIndex(0);
      } catch (err) {
        console.error("[SpreadsheetPreview] Failed to load workbook:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load spreadsheet file",
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWorkbook();

    return () => {
      cancelled = true;
    };
  }, [file]);

  const handlePreviousSheet = useCallback(() => {
    setCurrentSheetIndex((i) => Math.max(0, i - 1));
  }, []);

  const handleNextSheet = useCallback(() => {
    setCurrentSheetIndex((i) => Math.min(sheets.length - 1, i + 1));
  }, [sheets.length]);

  const handleExportCSV = useCallback(() => {
    if (!workbook || sheets.length === 0) return;

    const currentSheet = sheets[currentSheetIndex];
    const worksheet = workbook.Sheets[currentSheet.name];
    const csv = XLSX.utils.sheet_to_csv(worksheet);

    // Create download link
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${currentSheet.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [workbook, sheets, currentSheetIndex]);

  if (loading) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ maxHeight }}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            Loading spreadsheet...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ maxHeight }}
      >
        <div className="text-center text-destructive">
          <p className="font-medium mb-2">Failed to load spreadsheet</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center p-8", className)}
        style={{ maxHeight }}
      >
        <p className="text-muted-foreground">No sheets found</p>
      </div>
    );
  }

  const currentSheet = sheets[currentSheetIndex];

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            onClick={handlePreviousSheet}
            disabled={currentSheetIndex === 0}
          >
            <RemixIcon name="chevron_left" size="size-4" />
          </Button>
          <span className="text-sm font-medium">{currentSheet.name}</span>
          <Button
            variant="secondary"
            size="icon"
            onClick={handleNextSheet}
            disabled={currentSheetIndex === sheets.length - 1}
          >
            <RemixIcon name="chevron_right" size="size-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            ({currentSheetIndex + 1} / {sheets.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {path && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => revealItemInDir(path)}
              title="Show in Folder"
            >
              <RemixIcon name="folder_open" size="size-4" />
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <RemixIcon name="download" size="size-4" className="mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table content */}
      <div className="overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          <thead className="bg-muted sticky top-0">
            <tr>
              {Array.from({ length: currentSheet.columnCount }).map(
                (_, colIndex) => {
                  const cellValue =
                    currentSheet.data[0]?.[colIndex] || `col-${colIndex}`;
                  return (
                    <th
                      key={cellValue}
                      className="border border-border px-4 py-2 text-left text-sm font-medium min-w-[120px]"
                    >
                      {currentSheet.data[0]?.[colIndex] ||
                        `Column ${colIndex + 1}`}
                    </th>
                  );
                },
              )}
            </tr>
          </thead>
          <tbody>
            {currentSheet.data.slice(1).map((row, rowIndex) => {
              const rowKey = `row-${rowIndex}-${row.slice(0, 3).join("|")}`;
              return (
                <tr key={rowKey} className="hover:bg-muted/50">
                  {Array.from({ length: currentSheet.columnCount }).map(
                    (_, colIndex) => {
                      const cellKey = `${rowKey}-col${colIndex}-${row[colIndex] || ""}`;
                      return (
                        <td
                          key={cellKey}
                          className="border border-border px-4 py-2 text-sm"
                        >
                          {row[colIndex] || ""}
                        </td>
                      );
                    },
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Statistics */}
      <div className="px-4 py-2 bg-muted border-t text-xs text-muted-foreground">
        {currentSheet.rowCount} rows × {currentSheet.columnCount} columns
      </div>
    </div>
  );
}
