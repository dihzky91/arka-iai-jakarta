"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function MailTemplatesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[mail-templates] Error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive/60" />
      <h2 className="mt-4 text-lg font-medium">Terjadi Kesalahan</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md">
        {error.message || "Gagal memuat halaman Mail Templates. Silakan coba lagi."}
      </p>
      <Button onClick={reset} className="mt-4">
        Coba Lagi
      </Button>
    </div>
  );
}
