"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { HonorariumPaymentProofRow } from "@/server/actions/jadwal-otomatis/honorarium";
import { formatTanggalWaktuJakarta } from "@/lib/utils";

function formatFileSize(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function BatchPaymentProofs({
  proofs,
  canUpload,
  isPending,
  onUpload,
}: {
  proofs: HonorariumPaymentProofRow[];
  canUpload: boolean;
  isPending: boolean;
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onUpload(file);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bukti Pembayaran</CardTitle>
        <CardDescription>Unggah dan lihat bukti bayar batch.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            if (!canUpload || isPending) return;
            handleFiles(event.dataTransfer.files);
          }}
          className={`rounded-lg border border-dashed p-6 text-center text-sm transition-colors ${
            dragActive
              ? "border-primary bg-primary/5"
              : "border-border/60 bg-muted/25"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept="image/*,.pdf"
            disabled={!canUpload || isPending}
            onChange={(event) => handleFiles(event.target.files)}
          />
          <UploadCloud className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium text-foreground">
            Drop bukti bayar di sini
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            PDF atau gambar, maksimal mengikuti konfigurasi storage.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-4"
            disabled={!canUpload || isPending}
            onClick={() => inputRef.current?.click()}
          >
            Pilih File
          </Button>
        </div>

        {proofs.length === 0 ? (
          <EmptyState
            icon={UploadCloud}
            title="Belum ada bukti pembayaran"
            description="Bukti pembayaran yang diunggah akan tampil di daftar ini."
            className="min-h-36"
          />
        ) : (
          <div className="space-y-3">
            {proofs.map((proof) => (
              <a
                key={proof.id}
                href={proof.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-border/60 p-4 transition-all hover:border-primary/20 hover:bg-muted/35 hover:shadow-sm"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium">{proof.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {proof.uploaderName ?? "-"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatFileSize(proof.fileSize)}</span>
                    <Badge variant="outline">{proof.mimeType}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Diunggah: {formatTanggalWaktuJakarta(proof.uploadedAt)}
                </p>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
