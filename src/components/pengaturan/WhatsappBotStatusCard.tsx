"use client";

import { CheckCircle2, ExternalLink, MessageSquareText, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function WhatsappBotStatusCard({ enabled, fonnteConfigured }: {
  enabled: boolean;
  fonnteConfigured: boolean;
}) {
  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>WhatsApp Bot (Fonnte)</CardTitle>
            <CardDescription>
              Kirim pesan WA otomatis dari server via Fonnte API.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!enabled ? (
          <p className="text-sm text-muted-foreground">
            WhatsApp Bot dinonaktifkan. Aktifkan di <strong>Konfigurasi Aplikasi</strong> untuk menggunakan fitur kirim langsung.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status token:</span>
              {fonnteConfigured ? (
                <Badge className="gap-1.5 rounded-full border-emerald-200 bg-emerald-50 text-emerald-700" variant="outline">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  FONNTE_TOKEN terkonfigurasi
                </Badge>
              ) : (
                <Badge className="gap-1.5 rounded-full border-amber-200 bg-amber-50 text-amber-700" variant="outline">
                  <TriangleAlert className="h-3.5 w-3.5" />
                  FONNTE_TOKEN belum diset
                </Badge>
              )}
            </div>

            {fonnteConfigured ? (
              <p className="text-sm text-muted-foreground">
                Tombol <strong>Kirim Langsung</strong> tersedia di halaman detail kelas.
                Pastikan nomor device sudah terhubung di dashboard Fonnte.
              </p>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                <p className="text-sm text-amber-800">
                  Tambahkan token Fonnte ke file <code className="rounded bg-amber-100 px-1 text-xs">.env.local</code>:
                </p>
                <code className="block rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-900">
                  FONNTE_TOKEN=token_dari_dashboard_fonnte
                </code>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://fonnte.com" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Buka Fonnte.com
                  </a>
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
