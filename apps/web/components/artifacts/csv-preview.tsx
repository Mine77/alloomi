"use client";

import { useMemo } from "react";
import Papa from "papaparse";
import { RemixIcon } from "@/components/remix-icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export interface CsvPreviewProps {
  /** Raw CSV text (UTF-8) */
  content: string;
  filename?: string;
  className?: string;
  maxHeight?: string;
  /**
   * When true, does not render the top file name bar (to avoid duplication when drawer header already has {@link FilePreviewDrawerHeader}).
   */
  hideFileTitleBar?: boolean;
}

/**
 * Infer column names from Papa Parse results (prefer meta.fields, otherwise use keys from the first row)
 */
function resolveColumnKeys(
  fields: string[] | undefined,
  rows: Record<string, string>[],
): string[] {
  const fromMeta = fields?.filter((f) => f !== "__parsed_extra");
  if (fromMeta && fromMeta.length > 0) {
    return fromMeta;
  }
  if (rows.length > 0) {
    return Object.keys(rows[0]);
  }
  return [];
}

/**
 * Filter out data rows that are "completely empty" to prevent the table from being stretched by many empty rows
 */
function filterNonEmptyRows(
  rows: Record<string, string>[],
): Record<string, string>[] {
  return rows.filter((row) =>
    Object.values(row).some((v) => v != null && String(v).trim().length > 0),
  );
}

/**
 * CSV table preview: parsed using papaparse (header: true), displayed as a table
 *
 * Suitable for CSV content rendering in scenarios like workspace sidebar, Artifact, etc.
 */
export function CsvPreview({
  content,
  filename,
  className,
  maxHeight = "100%",
  hideFileTitleBar = false,
}: CsvPreviewProps) {
  const { t } = useTranslation();
  const { columns, rows, parseErrors, fatalMessage } = useMemo(() => {
    if (!content.trim()) {
      return {
        columns: [] as string[],
        rows: [] as Record<string, string>[],
        parseErrors: [] as Papa.ParseError[],
        fatalMessage: null as string | null,
      };
    }

    const result = Papa.parse<Record<string, string>>(content, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) => String(h).trim(),
      dynamicTyping: false,
    });

    const serious = result.errors.filter(
      (e) => e.type === "Quotes" || e.type === "FieldMismatch",
    );

    const dataRows = filterNonEmptyRows(result.data);
    const columns = resolveColumnKeys(result.meta.fields, dataRows);

    const fatalMessage =
      columns.length === 0 && dataRows.length === 0 && content.trim().length > 0
        ? (result.errors[0]?.message ?? t("common.csvPreview.parsingFailed"))
        : null;

    return {
      columns,
      rows: dataRows,
      parseErrors: serious,
      fatalMessage,
    };
  }, [content]);

  if (fatalMessage) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-8 text-center text-destructive",
          className,
        )}
      >
        <RemixIcon name="error_warning" size="size-8" />
        <p className="text-sm font-medium">
          {t("common.csvPreview.parsingFailed")}
        </p>
        <p className="text-xs text-muted-foreground">{fatalMessage}</p>
      </div>
    );
  }

  if (columns.length === 0 && rows.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 p-8 text-muted-foreground",
          className,
        )}
      >
        <RemixIcon name="file_spreadsheet" size="size-8" />
        <p className="text-sm">{t("common.csvPreview.emptyFile")}</p>
        {filename ? (
          <p className="text-xs opacity-80 truncate max-w-full">{filename}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-muted/30", className)}>
      {filename && !hideFileTitleBar ? (
        <div className="border-border bg-background shrink-0 border-b px-3 py-2">
          <span className="text-sm font-medium truncate block">{filename}</span>
        </div>
      ) : null}

      {parseErrors.length > 0 ? (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200">
          {t("common.csvPreview.parseWarning", { count: parseErrors.length })}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted/80 sticky top-0 z-10">
            <tr>
              {columns.map((col) => (
                <th
                  key={col}
                  className="border border-border px-3 py-2 text-left font-medium whitespace-nowrap max-w-[280px] truncate"
                  title={col}
                >
                  {col || " "}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: CSV rows have no stable id
                key={`csv-row-${rowIndex}`}
                className="border-b border-border hover:bg-muted/40"
              >
                {columns.map((col) => {
                  const raw = row[col];
                  const cell =
                    raw !== undefined && raw !== null ? String(raw) : "";
                  return (
                    <td
                      key={`${rowIndex}-${col}`}
                      className="border-r border-border px-3 py-1.5 align-top max-w-[320px]"
                    >
                      <span className="line-clamp-4 break-words" title={cell}>
                        {cell}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="border-border bg-background shrink-0 border-t px-3 py-1.5 text-xs text-muted-foreground">
        {t("common.csvPreview.rowsColumns", {
          rows: rows.length,
          columns: columns.length,
        })}
      </div>
    </div>
  );
}
