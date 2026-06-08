"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  KeyRound,
  MailPlus,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { formatTanggal } from "@/lib/utils";
import { inviteUserSchema, type InviteUserInput } from "@/lib/validators/invitation.schema";
import {
  inviteUser,
  resendInvite,
  cancelInvite,
  toggleUserStatus,
  adminResetPassword,
  type InvitationRow,
  type UserRow,
} from "@/server/actions/invitations";
import { updateUserAccess, type RoleOption } from "@/server/actions/roles";

// ─── Props ────────────────────────────────────────────────────────────────────

interface ManajemenUserCardProps {
  invitations: InvitationRow[];
  users: UserRow[];
  divisiOptions: Array<{ id: number; nama: string }>;
  roleOptions: RoleOption[];
}

// ─── Status Badge helpers ─────────────────────────────────────────────────────

function InviteStatusBadge({ status, expiredAt }: { status: string; expiredAt: Date }) {
  const isExpired = status === "pending" && new Date(expiredAt) < new Date();
  const label = isExpired ? "Kedaluwarsa" : status;
  const variant =
    label === "accepted"
      ? "default"
      : label === "pending"
        ? "secondary"
        : label === "Kedaluwarsa"
          ? "outline"
          : "outline";

  const labelMap: Record<string, string> = {
    pending: "Menunggu",
    accepted: "Diterima",
    expired: "Kedaluwarsa",
    Kedaluwarsa: "Kedaluwarsa",
    cancelled: "Dibatalkan",
  };

  return <Badge variant={variant}>{labelMap[label] ?? label}</Badge>;
}

function UserStatusBadge({ isActive }: { isActive: boolean | null }) {
  return (
    <Badge variant={isActive === false ? "outline" : "secondary"}>
      {isActive === false ? "Nonaktif" : "Aktif"}
    </Badge>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ManajemenUserCard({
  invitations,
  users: userRows,
  divisiOptions,
  roleOptions,
}: ManajemenUserCardProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("users");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [accessTarget, setAccessTarget] = useState<UserRow | null>(null);
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // ─── Filtered data ──────────────────────────────────────────────────────

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return userRows;
    return userRows.filter((u) =>
      [
        u.namaLengkap,
        u.email,
        u.divisiNama ?? "",
        u.roleName ?? u.role ?? "",
        u.jabatan ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [userRows, query]);

  const filteredInvitations = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return invitations;
    return invitations.filter((inv) =>
      [inv.namaLengkap, inv.email, inv.roleName ?? inv.role, inv.divisiNama ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [invitations, query]);

  // ─── Handlers ───────────────────────────────────────────────────────────

  function handleToggleStatus(userId: string, currentActive: boolean | null) {
    startTransition(async () => {
      const result = await toggleUserStatus({
        userId,
        isActive: !(currentActive ?? true),
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        currentActive ? "User dinonaktifkan." : "User diaktifkan kembali.",
      );
      router.refresh();
    });
  }

  function handleResendInvite(invitationId: string) {
    startTransition(async () => {
      const result = await resendInvite({ invitationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.inviteSent) {
        toast.success("Email undangan berhasil dikirim ulang.");
      } else {
        toast.warning("Undangan diperbarui, tetapi email gagal terkirim.");
      }
      router.refresh();
    });
  }

  function handleCancelInvite(invitationId: string) {
    startTransition(async () => {
      const result = await cancelInvite({ invitationId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Undangan dibatalkan.");
      router.refresh();
    });
  }

  function handleResetPassword(userId: string) {
    startTransition(async () => {
      const result = await adminResetPassword(userId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.emailSent) {
        toast.success("Email reset password berhasil dikirim.");
      } else {
        toast.warning("Permintaan reset dibuat, tetapi email gagal terkirim.");
      }
      router.refresh();
    });
  }

  // ─── Summary counts ────────────────────────────────────────────────────

  const totalUsers = userRows.length;
  const activeUsers = userRows.filter((u) => u.isActive !== false).length;
  const pendingInvites = invitations.filter(
    (inv) => inv.status === "pending" && new Date(inv.expiredAt) >= new Date(),
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Total User" value={String(totalUsers)} />
        <SummaryCard label="User Aktif" value={String(activeUsers)} />
        <SummaryCard label="Undangan Pending" value={String(pendingInvites)} />
      </div>

      {/* Main card */}
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Manajemen User</CardTitle>
              <CardDescription>
                Kelola akun user dan undangan aktivasi untuk anggota baru.
              </CardDescription>
            </div>
            <Button onClick={() => setInviteOpen(true)}>
              <Plus className="h-4 w-4" />
              Undang User
            </Button>
          </div>
          <div className="relative mt-2 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama, email, role..."
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="border-b border-border/60 px-6">
              <TabsList variant="line" className="h-auto w-max gap-4 rounded-none p-0">
                <TabsTrigger value="users" className="rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary">
                  User ({filteredUsers.length})
                </TabsTrigger>
                <TabsTrigger value="invitations" className="rounded-none border-b-2 border-transparent px-1 py-3 data-[state=active]:border-primary">
                  Undangan ({filteredInvitations.length})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Users tab */}
            <TabsContent value="users" className="m-0">
              <div className="divide-y divide-border/60">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/35"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-semibold text-primary">
                        {getInitials(user.namaLengkap)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-medium text-foreground">
                            {user.namaLengkap}
                          </p>
                          <UserStatusBadge isActive={user.isActive} />
                          <Badge variant="outline">
                            {user.isSuperAdmin
                              ? "Super Admin"
                              : user.roleName ?? user.role ?? "staff"}
                          </Badge>
                        </div>
                        <p className="mt-0.5 truncate text-sm text-muted-foreground">
                          {user.email}
                          {user.divisiNama ? ` · ${user.divisiNama}` : ""}
                          {user.jabatan ? ` · ${user.jabatan}` : ""}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" disabled={isPending}>
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Aksi</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setAccessTarget(user)}>
                            <Edit3 className="mr-2 h-4 w-4" />
                            Ubah Akses
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() =>
                              handleToggleStatus(user.id, user.isActive)
                            }
                          >
                            {user.isActive !== false ? (
                              <>
                                <ToggleLeft className="mr-2 h-4 w-4" />
                                Nonaktifkan
                              </>
                            ) : (
                              <>
                                <ToggleRight className="mr-2 h-4 w-4" />
                                Aktifkan
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleResetPassword(user.id)}
                          >
                            <KeyRound className="mr-2 h-4 w-4" />
                            Reset Password
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))
                ) : (
                  <div className="px-6 py-8">
                    <EmptyState
                      icon={Search}
                      title="Tidak ada user yang cocok"
                      description="Coba ubah kata kunci pencarian atau undang user baru jika datanya belum tersedia."
                    />
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Invitations tab */}
            <TabsContent value="invitations" className="m-0">
              <div className="divide-y divide-border/60">
                {filteredInvitations.length > 0 ? (
                  filteredInvitations.map((inv) => {
                    const isExpired =
                      inv.status === "pending" &&
                      new Date(inv.expiredAt) < new Date();
                    const canResend =
                      inv.status === "pending" || isExpired;
                    const canCancel = inv.status === "pending" && !isExpired;

                    return (
                      <div
                        key={inv.id}
                        className="flex items-center gap-4 px-6 py-4 transition-colors hover:bg-muted/35"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-sm font-semibold text-muted-foreground">
                          <MailPlus className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium text-foreground">
                              {inv.namaLengkap}
                            </p>
                            <InviteStatusBadge
                              status={inv.status}
                              expiredAt={inv.expiredAt}
                            />
                            <Badge variant="outline">
                              {inv.roleName ?? inv.role}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {inv.email}
                            {inv.divisiNama ? ` · ${inv.divisiNama}` : ""}
                            {" · "}
                            Oleh {inv.invitedByName}
                            {" · "}
                            {formatTanggal(inv.createdAt)}
                          </p>
                        </div>
                        {(canResend || canCancel) && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                disabled={isPending}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Aksi</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canResend && (
                                <DropdownMenuItem
                                  onClick={() => handleResendInvite(inv.id)}
                                >
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  Kirim Ulang
                                </DropdownMenuItem>
                              )}
                              {canCancel && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() => handleCancelInvite(inv.id)}
                                  >
                                    <XCircle className="mr-2 h-4 w-4" />
                                    Batalkan
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-6 py-8">
                    <EmptyState
                      icon={MailPlus}
                      title="Belum ada undangan"
                      description="Undangan aktivasi user akan tampil setelah dikirim."
                    />
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        divisiOptions={divisiOptions}
        roleOptions={roleOptions}
      />
      <AccessDialog
        user={accessTarget}
        onOpenChange={(open) => {
          if (!open) setAccessTarget(null);
        }}
        divisiOptions={divisiOptions}
        roleOptions={roleOptions}
      />
    </div>
  );
}

// ─── Invite Dialog ────────────────────────────────────────────────────────────

function InviteDialog({
  open,
  onOpenChange,
  divisiOptions,
  roleOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  divisiOptions: Array<{ id: number; nama: string }>;
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema) as never,
    defaultValues: {
      namaLengkap: "",
      email: "",
      roleId: roleOptions[0]?.id ?? 0,
      divisiId: undefined,
      jabatan: "",
    },
  });

  function onSubmit(values: InviteUserInput) {
    startTransition(async () => {
      const payload = {
        ...values,
        jabatan: values.jabatan || undefined,
        divisiId: values.divisiId || undefined,
      };

      const result = await inviteUser(payload);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      if (result.inviteSent) {
        toast.success("Undangan berhasil dikirim ke " + values.email);
      } else {
        toast.warning(
          "User dibuat, namun email undangan gagal terkirim. Gunakan 'Kirim Ulang' dari daftar undangan.",
        );
      }

      if (result.pendingExists) {
        toast.info("Email ini sudah memiliki undangan sebelumnya.");
      }

      form.reset();
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Undang User Baru</DialogTitle>
          <DialogDescription>
            User akan menerima email aktivasi untuk membuat kata sandi. Link berlaku 24 jam.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            id="invite-user-form"
            className="grid gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
          >
            <FormField
              control={form.control}
              name="namaLengkap"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nama Lengkap</FormLabel>
                  <FormControl>
                    <Input autoFocus placeholder="Nama lengkap" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="nama@email.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(Number(value))}
                      value={field.value ? String(field.value) : ""}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roleOptions.map((role) => (
                          <SelectItem key={role.id} value={String(role.id)}>
                            {role.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="divisiId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Divisi</FormLabel>
                    <Select
                      onValueChange={(v) =>
                        field.onChange(v === "0" ? undefined : Number(v))
                      }
                      value={field.value ? String(field.value) : "0"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Pilih divisi" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Tanpa divisi</SelectItem>
                        {divisiOptions.map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.nama}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="jabatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Jabatan (opsional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Mis. Staf Administrasi"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </form>
        </Form>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button type="submit" form="invite-user-form" disabled={isPending}>
            {isPending ? "Mengirim..." : "Kirim Undangan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function AccessDialog({
  user,
  onOpenChange,
  divisiOptions,
  roleOptions,
}: {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
  divisiOptions: Array<{ id: number; nama: string }>;
  roleOptions: RoleOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [roleId, setRoleId] = useState<number | null>(null);
  const [divisiId, setDivisiId] = useState<number | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    setRoleId(user.roleId);
    setDivisiId(user.divisiId);
    setIsSuperAdmin(user.isSuperAdmin);
  }, [user]);

  function handleSubmit() {
    if (!user) return;

    startTransition(async () => {
      const result = await updateUserAccess({
        userId: user.id,
        roleId: isSuperAdmin ? null : roleId,
        divisiId,
        isSuperAdmin,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Akses user diperbarui.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={!!user} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Ubah Akses User</DialogTitle>
          <DialogDescription>{user?.namaLengkap ?? ""}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <label className="flex items-center gap-3 rounded-lg border border-border px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={isSuperAdmin}
              onChange={(event) => setIsSuperAdmin(event.target.checked)}
              className="h-4 w-4"
            />
            <span>Super admin</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                disabled={isSuperAdmin}
                value={roleId ? String(roleId) : ""}
                onValueChange={(value) => setRoleId(Number(value))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih role" />
                </SelectTrigger>
                <SelectContent>
                  {roleOptions.map((role) => (
                    <SelectItem key={role.id} value={String(role.id)}>
                      {role.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Divisi</Label>
              <Select
                value={divisiId ? String(divisiId) : "0"}
                onValueChange={(value) =>
                  setDivisiId(value === "0" ? null : Number(value))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih divisi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Tanpa divisi</SelectItem>
                  {divisiOptions.map((divisi) => (
                    <SelectItem key={divisi.id} value={String(divisi.id)}>
                      {divisi.nama}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSubmit}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-[24px] py-5">
      <CardContent className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {label}
        </p>
        <p className="text-3xl font-semibold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
