"use client";

import { useState, useTransition } from "react";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  UserPlus,
  Users,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { APP_TIME_ZONE } from "@/lib/utils";
import {
  updateDingtalkConfig,
  testDingtalkConnection,
  getDingtalkSyncStatus,
  getDingtalkUserMappings,
  updateDingtalkUserMapping,
  autoMatchDingtalkUsers,
  getDingtalkUnimportedUsers,
  importDingtalkUsersToArka,
} from "@/server/actions/dingtalk/config";
import type { DingtalkUser } from "@/lib/dingtalk/contact";

interface Props {
  initialConfig: {
    appKey: string;
    appSecret: string;
    syncIntervalMenit: number;
  } | null;
  initialSyncStatus: {
    lastSyncAt: Date | null;
    lastSyncStatus: string | null;
    syncIntervalMenit: number;
  } | null;
  initialMappings: Array<{
    id: string;
    namaLengkap: string | null;
    email: string | null;
    dingtalkUserId: string | null;
  }>;
}

export function DingtalkConfigCard({
  initialConfig,
  initialSyncStatus,
  initialMappings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [appKey, setAppKey] = useState(initialConfig?.appKey ?? "");
  const [appSecret, setAppSecret] = useState(initialConfig?.appSecret ?? "");
  const [syncInterval, setSyncInterval] = useState(
    initialConfig?.syncIntervalMenit ?? 60,
  );

  const [mappings, setMappings] = useState(initialMappings);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const [testResult, setTestResult] = useState<{
    status: "idle" | "ok" | "error";
    message?: string;
  }>({ status: "idle" });

  const [autoMatchResult, setAutoMatchResult] = useState<{
    status: "idle" | "ok" | "error";
    matched?: number;
    totalDingtalk?: number;
    totalArka?: number;
    error?: string;
  }>({ status: "idle" });

  const [unimported, setUnimported] = useState<DingtalkUser[]>([]);
  const [unimportedLoading, setUnimportedLoading] = useState(false);
  const [unimportedError, setUnimportedError] = useState<string | null>(null);
  const [selectedImport, setSelectedImport] = useState<Set<string>>(new Set());
  const [importRoles, setImportRoles] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{
    status: "idle" | "ok" | "error";
    imported?: number;
    skipped?: number;
    error?: string;
  }>({ status: "idle" });

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await updateDingtalkConfig({
        appKey,
        appSecret,
        syncIntervalMenit: syncInterval,
      });
      if (res.ok) {
        toast.success("Konfigurasi DingTalk disimpan.");
      } else {
        toast.error(res.error);
      }
    });
  }

  function handleTest() {
    startTransition(async () => {
      const res = await testDingtalkConnection();
      if (res.ok) {
        setTestResult({ status: "ok", message: res.message });
        toast.success(res.message);
      } else {
        setTestResult({ status: "error", message: res.error });
        toast.error(res.error);
      }
    });
  }

  function handleStartEdit(id: string, current: string | null) {
    setEditingId(id);
    setEditValue(current ?? "");
  }

  function handleAutoMatch() {
    startTransition(async () => {
      setAutoMatchResult({ status: "idle" });
      const res = await autoMatchDingtalkUsers();
      if (res.ok) {
        setAutoMatchResult({
          status: "ok",
          matched: res.data.matched,
          totalDingtalk: res.data.totalDingtalk,
          totalArka: res.data.totalArka,
        });
        toast.success(`${res.data.matched} user berhasil di-match.`);
        router.refresh();
      } else {
        setAutoMatchResult({ status: "error", error: res.error });
        toast.error(res.error);
      }
    });
  }

  async function handleLoadUnimported() {
    setUnimportedLoading(true);
    setUnimportedError(null);
    const res = await getDingtalkUnimportedUsers();
    setUnimportedLoading(false);
    if (res.ok) {
      setUnimported(res.data);
      setSelectedImport(new Set());
      setImportRoles({});
    } else {
      setUnimportedError(res.error);
    }
  }

  function toggleSelectImport(userId: string) {
    setSelectedImport((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedImport.size === unimported.length) {
      setSelectedImport(new Set());
    } else {
      setSelectedImport(new Set(unimported.map((u) => u.userId)));
    }
  }

  function handleImport() {
    startTransition(async () => {
      const toImport = unimported
        .filter((u) => selectedImport.has(u.userId) && u.email)
        .map((u) => ({
          userId: u.userId,
          name: u.name,
          email: u.email!,
          mobile: u.mobile,
          role: (importRoles[u.userId] ?? "staff") as "admin" | "staff" | "pejabat" | "viewer",
        }));

      if (!toImport.length) {
        toast.error("Pilih user dengan email valid terlebih dahulu.");
        return;
      }

      const res = await importDingtalkUsersToArka(toImport);
      if (res.ok) {
        setImportResult({ status: "ok", imported: res.data.imported, skipped: res.data.skipped });
        toast.success(`${res.data.imported} user berhasil diimport.`);
        setUnimported((prev) => prev.filter((u) => !selectedImport.has(u.userId)));
        setSelectedImport(new Set());
        router.refresh();
      } else {
        setImportResult({ status: "error", error: res.error });
        toast.error(res.error);
      }
    });
  }

  function handleSaveMapping(userId: string) {
    startTransition(async () => {
      const res = await updateDingtalkUserMapping({
        userId,
        dingtalkUserId: editValue,
      });
      if (res.ok) {
        toast.success("Mapping berhasil disimpan.");
        setMappings((prev) =>
          prev.map((m) =>
            m.id === userId ? { ...m, dingtalkUserId: editValue } : m,
          ),
        );
        setEditingId(null);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Kredensial DingTalk</CardTitle>
              <CardDescription>
                Konfigurasi AppKey dan AppSecret dari DingTalk Open Platform.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="appKey">App Key</Label>
              <Input
                id="appKey"
                value={appKey}
                onChange={(e) => setAppKey(e.target.value)}
                placeholder="Masukkan AppKey dari DingTalk"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="appSecret">App Secret</Label>
              <Input
                id="appSecret"
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="Masukkan AppSecret dari DingTalk"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="syncInterval">
                Interval Sinkronisasi (menit)
              </Label>
              <Input
                id="syncInterval"
                type="number"
                min={15}
                max={1440}
                value={syncInterval}
                onChange={(e) => setSyncInterval(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Minimal 15 menit, maksimal 1440 menit (24 jam).
              </p>
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleTest}
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Test Koneksi
              </Button>
            </div>

            {testResult.status !== "idle" && (
              <div
                className={`flex items-start gap-2 rounded-xl p-3 text-sm ${
                  testResult.status === "ok"
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-red-50 text-red-700"
                }`}
              >
                {testResult.status === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <RefreshCw className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Status Sinkronisasi</CardTitle>
              <CardDescription>
                Informasi sinkronisasi terakhir dengan DingTalk.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {initialSyncStatus ? (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Sync Terakhir</span>
                <span>
                  {initialSyncStatus.lastSyncAt
                    ? new Date(initialSyncStatus.lastSyncAt).toLocaleString("id-ID", {
                        timeZone: APP_TIME_ZONE,
                      })
                    : "Belum pernah"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge
                  className={
                    initialSyncStatus.lastSyncStatus === "success"
                      ? "bg-green-100 text-green-800"
                      : initialSyncStatus.lastSyncStatus === "failed"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                  }
                >
                  {initialSyncStatus.lastSyncStatus ?? "N/A"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Interval Sync</span>
                <span>{initialSyncStatus.syncIntervalMenit} menit</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Belum ada konfigurasi disimpan.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Mapping Pegawai</CardTitle>
              <CardDescription>
                Hubungkan akun ARKA dengan DingTalk User ID.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {mappings.filter((m) => m.dingtalkUserId).length} / {mappings.length} user telah di-mapping
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAutoMatch}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Users className="mr-2 h-4 w-4" />
              )}
              Auto Match by Email
            </Button>
          </div>

          {autoMatchResult.status === "ok" && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                {autoMatchResult.matched} user ARKA di-match dengan {autoMatchResult.totalDingtalk} kontak DingTalk.
              </span>
            </div>
          )}

          {autoMatchResult.status === "error" && (
            <div className="mb-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{autoMatchResult.error}</span>
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nama</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>DingTalk User ID</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Tidak ada pegawai.
                  </TableCell>
                </TableRow>
              ) : (
                mappings.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>{user.namaLengkap ?? "-"}</TableCell>
                    <TableCell>{user.email ?? "-"}</TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <Input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="h-8"
                          placeholder="DingTalk User ID"
                        />
                      ) : (
                        <code className="rounded bg-muted px-2 py-0.5 text-xs">
                          {user.dingtalkUserId ?? (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </code>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === user.id ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleSaveMapping(user.id)}
                            disabled={isPending}
                          >
                            Simpan
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingId(null)}
                          >
                            Batal
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleStartEdit(user.id, user.dingtalkUserId)
                          }
                        >
                          Edit
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="rounded-[24px]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <UserPlus className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Import User dari DingTalk</CardTitle>
              <CardDescription>
                Buat akun ARKA untuk user DingTalk yang belum terdaftar.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadUnimported}
            disabled={unimportedLoading}
          >
            {unimportedLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Cek User Belum Ter-import
          </Button>

          {unimportedError && (
            <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{unimportedError}</span>
            </div>
          )}

          {importResult.status === "ok" && (
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{importResult.imported} user diimport, {importResult.skipped} sudah ada.</span>
            </div>
          )}

          {unimported.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {unimported.length} user DingTalk belum punya akun ARKA.
                  {" "}{selectedImport.size} dipilih.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={toggleSelectAll}>
                    {selectedImport.size === unimported.length ? "Batal Semua" : "Pilih Semua"}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleImport}
                    disabled={isPending || selectedImport.size === 0}
                  >
                    {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <UserPlus className="mr-2 h-4 w-4" />
                    Import Terpilih ({selectedImport.size})
                  </Button>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">
                      <input
                        type="checkbox"
                        checked={selectedImport.size === unimported.length && unimported.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4"
                      />
                    </TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>No. HP</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unimported.map((u) => (
                    <TableRow key={u.userId} className={!u.email ? "opacity-50" : ""}>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={selectedImport.has(u.userId)}
                          onChange={() => toggleSelectImport(u.userId)}
                          disabled={!u.email}
                          className="h-4 w-4"
                        />
                      </TableCell>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>
                        {u.email ?? (
                          <span className="text-xs text-muted-foreground italic">Tidak ada email</span>
                        )}
                      </TableCell>
                      <TableCell>{u.mobile ?? "-"}</TableCell>
                      <TableCell>
                        <select
                          value={importRoles[u.userId] ?? "staff"}
                          onChange={(e) =>
                            setImportRoles((prev) => ({ ...prev, [u.userId]: e.target.value }))
                          }
                          disabled={!u.email}
                          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                        >
                          <option value="staff">Staff</option>
                          <option value="pejabat">Pejabat</option>
                          <option value="admin">Admin</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <p className="text-xs text-muted-foreground">
                Akun dibuat dengan status <strong>tidak aktif</strong>. User perlu set password via reset password sebelum bisa login.
              </p>
            </div>
          )}

          {unimported.length === 0 && !unimportedLoading && !unimportedError && importResult.status === "idle" && (
            <p className="text-sm text-muted-foreground">
              Klik tombol di atas untuk cek user DingTalk yang belum punya akun ARKA.
            </p>
          )}

          {unimported.length === 0 && !unimportedLoading && importResult.status === "ok" && (
            <p className="text-sm text-muted-foreground">
              Semua user DingTalk sudah punya akun ARKA.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
