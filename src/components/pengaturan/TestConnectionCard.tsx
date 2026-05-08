"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Database,
  HardDrive,
  Loader2,
  Mail,
  PlugZap,
  Webhook,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  testDatabaseConnection,
  testDingtalkConnection,
  testEmailConnection,
  testStorageConnection,
} from "@/server/actions/systemConfig";

interface Props {
  isAdmin: boolean;
  emailProvider: "mailjet" | "brevo";
}

type TestResult =
  | { status: "idle" }
  | { status: "ok"; message: string }
  | { status: "error"; message: string };

export function TestConnectionCard({ isAdmin, emailProvider }: Props) {
  const emailLabel = emailProvider === "brevo" ? "Brevo" : "Mailjet";
  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <PlugZap className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Test Koneksi</CardTitle>
            <CardDescription>
              Verifikasi bahwa integrasi eksternal berjalan normal.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!isAdmin ? (
          <div className="rounded-2xl border border-border bg-muted/35 p-4 text-sm text-muted-foreground">
            Hanya admin yang dapat menjalankan test koneksi.
          </div>
        ) : (
          <>
            <TestRow
              icon={Mail}
              label={`Email (${emailLabel})`}
              description="Kirim email test ke alamat email login Anda."
              action={testEmailConnection}
              actionLabel="Kirim Email Test"
            />
            <TestRow
              icon={HardDrive}
              label="Storage Provider"
              description="Upload file kecil ke folder system-tests."
              action={testStorageConnection}
              actionLabel="Upload Test"
            />
            <TestRow
              icon={Database}
              label="Database"
              description="Ping database dengan SELECT 1."
              action={testDatabaseConnection}
              actionLabel="Ping Database"
            />
            <TestRow
              icon={Webhook}
              label="DingTalk"
              description="Test koneksi ke DingTalk API menggunakan kredensial yang dikonfigurasi."
              action={testDingtalkConnection}
              actionLabel="Test DingTalk"
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function TestRow({
  icon: Icon,
  label,
  description,
  action,
  actionLabel,
}: {
  icon: typeof Mail;
  label: string;
  description: string;
  action: () => Promise<{ ok: true; message: string } | { ok: false; error: string }>;
  actionLabel: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<TestResult>({ status: "idle" });

  function handleClick() {
    startTransition(async () => {
      const res = await action();
      if (res.ok) {
        setResult({ status: "ok", message: res.message });
        toast.success(`${label}: ${res.message}`);
      } else {
        setResult({ status: "error", message: res.error });
        toast.error(`${label}: ${res.error}`);
      }
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/25 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={isPending}
          className="w-full sm:w-auto"
        >
          {isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
          {actionLabel}
        </Button>
      </div>
      {result.status !== "idle" && (
        <div
          className={`mt-3 flex items-start gap-2 rounded-xl p-3 text-xs ${
            result.status === "ok"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {result.status === "ok" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
          )}
          <span className="break-all">{result.message}</span>
        </div>
      )}
    </div>
  );
}
