"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h2 className="mt-5 text-xl font-medium text-foreground">
          Terjadi Kesalahan
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Kami tidak dapat memuat halaman ini. Silakan coba lagi.
          {process.env.NODE_ENV === "development" && (
            <span className="mt-1 block font-mono text-xs text-destructive">
              {error.message}
            </span>
          )}
        </p>
        <Button onClick={reset} className="mt-6 gap-2">
          <RefreshCw className="h-4 w-4" />
          Coba Lagi
        </Button>
      </div>
    </div>
  );
}
