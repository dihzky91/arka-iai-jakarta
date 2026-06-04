"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Capability } from "@/lib/rbac/capabilities";
import {
  createRole,
  deleteRole,
  updateRole,
  type RoleManagementRow,
} from "@/server/actions/roles";

const KODE_REGEX = /^[a-z0-9_-]+$/;

interface RoleManagementCardProps {
  roles: RoleManagementRow[];
  capabilityGroups: Array<{ label: string; capabilities: Capability[] }>;
  capabilityLabels: Record<Capability, string>;
}

type Draft = {
  id?: number;
  nama: string;
  kode: string;
  isSystem?: boolean;
  capabilities: Capability[];
};

type FieldErrors = {
  nama?: string;
  kode?: string;
};

const EMPTY_DRAFT: Draft = {
  nama: "",
  kode: "",
  capabilities: [],
};

export function RoleManagementCard({
  roles,
  capabilityGroups,
  capabilityLabels,
}: RoleManagementCardProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isPending, startTransition] = useTransition();

  const selectedSet = useMemo(
    () => new Set<Capability>(draft.capabilities),
    [draft.capabilities],
  );

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setFieldErrors({});
    setDialogOpen(true);
  }

  function openEdit(role: RoleManagementRow) {
    setDraft({
      id: role.id,
      nama: role.nama,
      kode: role.kode,
      isSystem: role.isSystem,
      capabilities: role.capabilities,
    });
    setFieldErrors({});
    setDialogOpen(true);
  }

  function toggleCapability(capability: Capability, checked: boolean) {
    setDraft((current) => ({
      ...current,
      capabilities: checked
        ? Array.from(new Set([...current.capabilities, capability]))
        : current.capabilities.filter((item) => item !== capability),
    }));
  }

  function handleSubmit() {
    const errors: FieldErrors = {};
    const trimmedNama = draft.nama.trim();
    const trimmedKode = draft.kode.trim();

    if (trimmedNama.length < 2) {
      errors.nama = "Nama role minimal 2 karakter.";
    }
    if (trimmedKode.length < 2) {
      errors.kode = "Kode role minimal 2 karakter.";
    } else if (!KODE_REGEX.test(trimmedKode)) {
      errors.kode = "Kode hanya boleh huruf kecil, angka, underscore, atau dash.";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});
    startTransition(async () => {
      const payload = {
        nama: trimmedNama,
        kode: trimmedKode,
        capabilities: draft.capabilities,
      };
      const result = draft.id
        ? await updateRole({ ...payload, id: draft.id })
        : await createRole(payload);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(draft.id ? "Role berhasil diperbarui." : "Role berhasil dibuat.");
      setDialogOpen(false);
      router.refresh();
    });
  }

  function handleDelete(role: RoleManagementRow) {
    startTransition(async () => {
      const result = await deleteRole({ id: role.id });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Role dihapus.");
      router.refresh();
    });
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Role & Capability</CardTitle>
            <CardDescription>
              Kelola role dinamis dan akses modul untuk user non-super-admin.
            </CardDescription>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Tambah Role
          </Button>
        </div>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {roles.map((role) => (
          <div key={role.id} className="flex gap-4 px-6 py-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium text-foreground">{role.nama}</p>
                <Badge variant="outline">{role.kode}</Badge>
                {role.isSystem ? <Badge variant="secondary">Sistem</Badge> : null}
                <Badge variant="outline">{role.userCount} user</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {role.capabilities.length} capability aktif
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => openEdit(role)}>
                <Pencil className="h-4 w-4" />
                Ubah
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={role.isSystem || role.userCount > 0 || isPending}
                onClick={() => handleDelete(role)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="sr-only">Hapus role</span>
              </Button>
            </div>
          </div>
        ))}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Ubah Role" : "Tambah Role"}</DialogTitle>
            <DialogDescription>
              Pilih capability yang boleh digunakan role ini.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="role-name">Nama Role</Label>
              <Input
                id="role-name"
                value={draft.nama}
                aria-invalid={!!fieldErrors.nama}
                onChange={(event) => {
                  setDraft((current) => ({ ...current, nama: event.target.value }));
                  if (fieldErrors.nama) setFieldErrors((e) => ({ ...e, nama: undefined }));
                }}
              />
              {fieldErrors.nama && (
                <p className="text-xs text-destructive">{fieldErrors.nama}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-code">Kode</Label>
              <Input
                id="role-code"
                value={draft.kode}
                disabled={draft.isSystem}
                aria-invalid={!!fieldErrors.kode}
                placeholder="contoh: staff-kursus"
                onChange={(event) => {
                  setDraft((current) => ({ ...current, kode: event.target.value.toLowerCase().replace(/\s+/g, "-") }));
                  if (fieldErrors.kode) setFieldErrors((e) => ({ ...e, kode: undefined }));
                }}
              />
              {fieldErrors.kode ? (
                <p className="text-xs text-destructive">{fieldErrors.kode}</p>
              ) : (
                <p className="text-xs text-muted-foreground">Huruf kecil, angka, underscore, atau dash.</p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {capabilityGroups.map((group) => (
              <section key={group.label} className="space-y-3">
                <p className="text-sm font-semibold text-foreground">{group.label}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {group.capabilities.map((capability) => (
                    <label
                      key={capability}
                      className="flex items-start gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={selectedSet.has(capability)}
                        onCheckedChange={(checked) =>
                          toggleCapability(capability, checked === true)
                        }
                      />
                      <span className="leading-5">
                        {capabilityLabels[capability] ?? capability}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => setDialogOpen(false)}
            >
              Batal
            </Button>
            <Button type="button" disabled={isPending} onClick={handleSubmit}>
              <Save className="h-4 w-4" />
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
