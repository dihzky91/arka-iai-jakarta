"use client";

import { useState, useTransition } from "react";
import { ExternalLink, FileText, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getInvoicesByProject,
  type InvoiceKuitansiSummary,
} from "@/server/actions/projects";


function rupiah(value: string | null | undefined) {
  return `Rp ${Number(value ?? 0).toLocaleString("id-ID")}`;
}

export function InvoiceKuitansiSection({
  projectId,
  initialSummary,
}: {
  projectId: string;
  initialSummary?: InvoiceKuitansiSummary;
}) {
  const [summary, setSummary] = useState<InvoiceKuitansiSummary>(
    initialSummary ?? { invoices: [], kuitansi: [] },
  );
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await getInvoicesByProject(projectId);
      setSummary(result);
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Invoice & Kuitansi</h3>
        <div className="flex gap-1">
          {summary.invoices.length > 0 ? (
            <Badge variant="outline" className="text-xs">
              Invoice {summary.invoices.length}
            </Badge>
          ) : null}
          {summary.kuitansi.length > 0 ? (
            <Badge variant="outline" className="text-xs">
              Kuitansi {summary.kuitansi.length}
            </Badge>
          ) : null}
        </div>
      </div>

      {summary.invoices.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
            Invoice Terbaru
          </p>
          <div className="space-y-1.5">
            {summary.invoices.slice(0, 5).map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {inv.nomorSurat ?? "(draft)"}
                  </p>
                  <p className="truncate text-muted-foreground">
                    {inv.perihal}
                  </p>
                </div>
                <div className="ml-2 text-right">
                  <p className="font-medium">{rupiah(inv.total)}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      inv.status === "terbit"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {inv.status === "terbit" ? "Lunas" : inv.status ?? "Draft"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary.kuitansi.length > 0 ? (
        <div className="mt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Receipt className="h-3.5 w-3.5" />
            Kuitansi Terbaru
          </p>
          <div className="space-y-1.5">
            {summary.kuitansi.slice(0, 5).map((kt) => (
              <div
                key={kt.id}
                className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {kt.nomorKuitansi ?? "(draft)"}
                  </p>
                  <p className="truncate text-muted-foreground">{kt.uraian}</p>
                </div>
                <div className="ml-2 text-right">
                  <p className="font-medium">{rupiah(kt.jumlah)}</p>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      kt.status === "terbit"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 bg-gray-50 text-gray-600"
                    }`}
                  >
                    {kt.status === "terbit"
                      ? "Lunas"
                      : kt.status ?? "Draft"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary.invoices.length === 0 && summary.kuitansi.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Belum ada invoice atau kuitansi.
        </p>
      ) : null}

      <div className="mt-3 flex gap-2">
        <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
          <a
            href="/keuangan/invoice"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-3 w-3" />
            Invoice
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="flex-1 text-xs">
          <a
            href="/keuangan/kuitansi"
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-3 w-3" />
            Kuitansi
          </a>
        </Button>
      </div>
    </div>
  );
}
