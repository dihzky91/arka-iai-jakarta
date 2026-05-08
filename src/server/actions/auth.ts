"use server";

import { cache } from "react";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth, type AuthSession } from "@/server/auth";
import { db } from "@/server/db";
import { roleCapabilities, users } from "@/server/db/schema";
import {
  DEFAULT_ROLE_CAPABILITIES,
  type Capability,
} from "@/lib/rbac/capabilities";

export type Role = "admin" | "staff" | "pejabat" | "viewer";

export type PermissionModule =
  | "announcement"
  | "suratKeluar"
  | "suratMasuk"
  | "disposisi"
  | "pegawai"
  | "divisi"
  | "pejabat"
  | "nomor"
  | "suratKeputusan"
  | "suratMou"
  | "sertifikat"
  | "jadwalUjian"
  | "jadwalPelatihan"
  | "pengaturan"
  | "auditLog"
  | "notification"
  | "calendar"
  | "search"
  | "profile"
  | "manajemenUser"
  | "absensi"
  | "cuti"
  | "invoice"
  | "kuitansi";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "manage"
  | "approve"
  | "configure"
  | "generate"
  | "assign"
  | "export"
  | "sync";


const PERMISSION_TO_CAPABILITY: Record<
  PermissionModule,
  Partial<Record<PermissionAction, Capability>>
> = {
  announcement: {
    view: "announcement:view",
    create: "announcement:create",
    update: "announcement:manage",
    delete: "announcement:manage",
    manage: "announcement:manage",
  },
  suratKeluar: {
    view: "surat_keluar:view",
    create: "surat_keluar:create",
    update: "surat_keluar:edit",
    delete: "surat_keluar:delete",
    approve: "surat_keluar:approve",
    generate: "surat_keluar:generate",
    assign: "surat_keluar:assign",
    manage: "surat_keluar:edit",
  },
  suratMasuk: {
    view: "surat_masuk:view",
    create: "surat_masuk:create",
    update: "surat_masuk:edit",
    delete: "surat_masuk:delete",
    manage: "surat_masuk:edit",
  },
  disposisi: {
    view: "disposisi:view",
    create: "disposisi:create",
    update: "disposisi:edit",
    manage: "disposisi:manage",
  },
  pegawai: {
    view: "pegawai:view",
    create: "pegawai:manage",
    update: "pegawai:manage",
    delete: "pegawai:manage",
    manage: "pegawai:manage",
  },
  divisi: {
    view: "divisi:view",
    create: "divisi:manage",
    update: "divisi:manage",
    delete: "divisi:manage",
    manage: "divisi:manage",
  },
  pejabat: {
    view: "pejabat:view",
    create: "pejabat:manage",
    update: "pejabat:manage",
    delete: "pejabat:manage",
    manage: "pejabat:manage",
  },
  nomor: {
    view: "nomor_surat:view",
    generate: "nomor_surat:generate",
    update: "nomor_surat:manage",
    manage: "nomor_surat:manage",
  },
  suratKeputusan: {
    view: "surat_keputusan:view",
    create: "surat_keputusan:create",
    update: "surat_keputusan:edit",
    delete: "surat_keputusan:delete",
    generate: "surat_keputusan:generate",
    manage: "surat_keputusan:edit",
  },
  suratMou: {
    view: "surat_mou:view",
    create: "surat_mou:create",
    update: "surat_mou:edit",
    delete: "surat_mou:delete",
    generate: "surat_mou:generate",
    manage: "surat_mou:edit",
  },
  sertifikat: {
    view: "sertifikat:view",
    create: "sertifikat:manage",
    update: "sertifikat:manage",
    delete: "sertifikat:manage",
    generate: "sertifikat:manage",
    export: "sertifikat:export",
    configure: "sertifikat:configure",
    manage: "sertifikat:manage",
  },
  jadwalUjian: {
    view: "jadwal_ujian:view",
    create: "jadwal_ujian:manage",
    update: "jadwal_ujian:manage",
    delete: "jadwal_ujian:manage",
    configure: "jadwal_ujian:configure",
    export: "jadwal_ujian:export",
    manage: "jadwal_ujian:manage",
  },
  jadwalPelatihan: {
    view: "jadwal_pelatihan:view",
    create: "jadwal_pelatihan:manage",
    update: "jadwal_pelatihan:manage",
    delete: "jadwal_pelatihan:manage",
    configure: "jadwal_pelatihan:configure",
    export: "jadwal_pelatihan:export",
    manage: "jadwal_pelatihan:manage",
  },
  pengaturan: {
    view: "pengaturan:view",
    update: "pengaturan:manage",
    configure: "pengaturan:manage",
    manage: "pengaturan:manage",
  },
  auditLog: {
    view: "audit_log:view",
    export: "audit_log:manage",
    manage: "audit_log:manage",
  },
  notification: {
    view: "notification:view",
    update: "notification:manage",
    manage: "notification:manage",
  },
  calendar: {
    view: "calendar:view",
    manage: "calendar:manage",
  },
  search: {
    view: "search:view",
    manage: "search:view",
  },
  profile: {
    view: "profile:view",
    update: "profile:edit",
    manage: "profile:edit",
  },
  manajemenUser: {
    view: "users:manage",
    create: "users:invite",
    update: "users:manage",
    delete: "users:manage",
    manage: "users:manage",
  },
  absensi: {
    view: "absensi:view",
    sync: "absensi:sync",
    manage: "absensi:sync",
  },
  cuti: {
    view: "cuti:view",
    create: "cuti:create",
    update: "cuti:update",
    approve: "cuti:approve",
    manage: "cuti:approve",
  },
  invoice: {
    view: "invoice:view",
    create: "invoice:create",
    update: "invoice:edit",
    delete: "invoice:delete",
    assign: "invoice:assign",
    manage: "invoice:manage",
  },
  kuitansi: {
    view: "kuitansi:view",
    create: "kuitansi:create",
    update: "kuitansi:edit",
    delete: "kuitansi:delete",
    assign: "kuitansi:assign",
    manage: "kuitansi:manage",
  },
};

function getSessionRoleValue(session: AuthSession): Role | null {
  const role = (session.user as { role?: string }).role as Role | undefined;
  return role ?? null;
}

function permissionToCapability(
  module: PermissionModule,
  action: PermissionAction,
): Capability | null {
  return PERMISSION_TO_CAPABILITY[module]?.[action] ?? null;
}

function permissionToLegacyCapability(
  module: PermissionModule,
  action: PermissionAction,
): Capability | null {
  if (module !== "jadwalPelatihan") return null;
  return PERMISSION_TO_CAPABILITY.jadwalUjian[action] ?? null;
}

// Guard helper: pastikan user sudah login.
// Throw "Unauthorized" jika tidak ada session.
export async function requireSession(): Promise<AuthSession> {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  if (!session) throw new Error("Unauthorized");
  return session;
}

type AccessRow = {
  role: Role | null;
  roleId: number | null;
  isSuperAdmin: boolean;
};

async function getUserAccess(userId: string): Promise<AccessRow | null> {
  const [row] = await db
    .select({
      role: users.role,
      roleId: users.roleId,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return row
    ? {
        role: row.role as Role | null,
        roleId: row.roleId ?? null,
        isSuperAdmin: row.isSuperAdmin === true,
      }
    : null;
}

async function userHasCapability(
  access: AccessRow,
  capability: Capability,
): Promise<boolean> {
  if (access.isSuperAdmin || access.role === "admin") return true;

  if (access.roleId) {
    const rows = await db
      .select({ roleId: roleCapabilities.roleId })
      .from(roleCapabilities)
      .where(
        and(
          eq(roleCapabilities.roleId, access.roleId),
          eq(roleCapabilities.capability, capability),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  if (access.role && access.role in DEFAULT_ROLE_CAPABILITIES) {
    return DEFAULT_ROLE_CAPABILITIES[
      access.role as keyof typeof DEFAULT_ROLE_CAPABILITIES
    ].includes(capability);
  }

  return false;
}

// Guard helper transisi: role lama tetap tersedia untuk modul yang belum
// selesai migrasi total, tetapi admin DB baru melewati check via super admin.
export async function requireRole(allowed: Role[]): Promise<AuthSession> {
  const session = await requireSession();
  const access = await getUserAccess(session.user.id);
  const role = access?.role ?? getSessionRoleValue(session);
  if (access?.isSuperAdmin) return session;
  if (!role || !allowed.includes(role)) {
    throw new Error("Forbidden");
  }
  return session;
}

export async function requireCapability(
  capability: Capability,
): Promise<AuthSession> {
  const session = await requireSession();
  const access = await getUserAccess(session.user.id);

  if (!access || !(await userHasCapability(access, capability))) {
    throw new Error("Forbidden");
  }

  return session;
}

export async function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
  _scope?: string,
): Promise<AuthSession> {
  const session = await requireSession();
  const access = await getUserAccess(session.user.id);
  const capability = permissionToCapability(module, action);
  const legacyCapability = permissionToLegacyCapability(module, action);

  if (access?.isSuperAdmin) return session;

  if (access && capability && (await userHasCapability(access, capability))) {
    return session;
  }

  if (
    access &&
    legacyCapability &&
    (await userHasCapability(access, legacyCapability))
  ) {
    return session;
  }

  throw new Error("Forbidden");
}

export const getCurrentUserAccess = cache(async (): Promise<{
  role: Role | null;
  roleId: number | null;
  isSuperAdmin: boolean;
  capabilities: Capability[];
} | null> => {
  const session = await getSession();
  if (!session) return null;

  const access = await getUserAccess(session.user.id);
  if (!access) return null;

  if (access.isSuperAdmin || access.role === "admin") {
    return {
      ...access,
      isSuperAdmin: true,
      capabilities: [],
    };
  }

  if (access.roleId) {
    const rows = await db
      .select({ capability: roleCapabilities.capability })
      .from(roleCapabilities)
      .where(eq(roleCapabilities.roleId, access.roleId));

    return {
      ...access,
      capabilities: rows.map((row) => row.capability as Capability),
    };
  }

  return {
    ...access,
    capabilities:
      access.role && access.role in DEFAULT_ROLE_CAPABILITIES
        ? DEFAULT_ROLE_CAPABILITIES[
            access.role as keyof typeof DEFAULT_ROLE_CAPABILITIES
          ]
        : [],
  };
});

// Ambil session tanpa throw - dipakai di layout/middleware untuk cek login state.
export const getSession = cache(async (): Promise<AuthSession | null> => {
  const headersList = await headers();
  const session = await auth.api.getSession({
    headers: headersList,
  });
  return session ?? null;
});
