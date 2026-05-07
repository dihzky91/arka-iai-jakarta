"use client";

import { useMemo } from "react";
import { ClipboardPaste, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { buildImportPreview } from "./utils";
import type { ImportPesertaRow, DuplicateStrategy, Peserta, ImportPreviewRow } from "./types";

interface PesertaImportDialogProps {
  importRows: ImportPesertaRow[];
  pesertaList: Peserta[];
  duplicateStrategy: DuplicateStrategy;
  isPending: boolean;
  importableRows: ImportPesertaRow[];
  onDuplicateStrategyChange: (strategy: DuplicateStrategy) => void;
  onPasteTextChange: (text: string) => void;
  onPastePreview: () => void;
  onBulkImport: () => void;
  pasteText: string;
}

export function PesertaImportDialog({
  importRows,
  pesertaList,
  duplicateStrategy,
  isPending,
  pasteText,
  onDuplicateStrategyChange,
  onPasteTextChange,
  onPastePreview,
  onBulkImport,
}: PesertaImportDialogProps) {
  const importPreview = useMemo(
    () => buildImportPreview(importRows, pesertaList, duplicateStrategy),
    [duplicateStrategy, importRows, pesertaList],
  );
  const importSummary = useMemo(() => ({
    total: importPreview.length,
    valid: importPreview.filter((row) => row.status === "valid").length,
    update: importPreview.filter((row) => row.status === "update").length,
    duplicate: importPreview.filter((row) => row.status === "duplicate").length,
    error: importPreview.filter((row) => row.status === "error").length,
  }), [importPreview]);
  const importableRows = useMemo(
    () => importPreview
      .filter((row) => row.status === "valid" || row.status === "update")
      .map(({ rowNumber, status, issues, ...row }) => row),
    [importPreview],
  );

  return (
    <div className="space-y-4 border-b p-4">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <textarea
          className="min-h-28 rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="Paste dari Excel: nama, nomor peserta, email, telepon, catatan"
          value={pasteText}
          onChange={(event) => onPasteTextChange(event.target.value)}
        />
        <div className="space-y-2">
          <Select value={duplicateStrategy} onValueChange={(value) => onDuplicateStrategyChange(value as DuplicateStrategy)}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="skip">Skip duplikat</SelectItem>
              <SelectItem value="update">Update data lama</SelectItem>
              <SelectItem value="allow">Tetap import</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="w-full" onClick={onPastePreview}>
            <ClipboardPaste className="h-4 w-4" /> Preview Paste
          </Button>
          <Button size="sm" className="w-full" onClick={onBulkImport} disabled={isPending || importableRows.length === 0}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Import Valid
          </Button>
        </div>
      </div>
      {importPreview.length > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="secondary">Total {importSummary.total}</Badge>
            <Badge variant="default" className="bg-green-600">Valid {importSummary.valid}</Badge>
            <Badge variant="secondary">Update {importSummary.update}</Badge>
            <Badge variant="outline">Duplikat {importSummary.duplicate}</Badge>
            <Badge variant="destructive">Error {importSummary.error}</Badge>
          </div>
          <div className="max-h-72 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Baris</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Nama</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">No Peserta</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Kontak</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.slice(0, 100).map((row) => (
                  <tr key={`${row.rowNumber}-${row.nama}`} className="border-t">
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{row.rowNumber}</td>
                    <td className="px-3 py-2 font-medium">{row.nama || "-"}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.nomorPeserta || "-"}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {[row.email, row.telepon].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-3 py-2">
                      <Badge
                        variant={row.status === "error" ? "destructive" : row.status === "duplicate" ? "outline" : "secondary"}
                        className={row.status === "valid" ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {row.status === "valid" ? "Valid" : row.status === "update" ? "Update" : row.status === "duplicate" ? "Skip" : "Error"}
                      </Badge>
                      {row.issues.length > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">{row.issues.join(" ")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
