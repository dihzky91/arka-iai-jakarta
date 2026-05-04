"use server";

import { and, count, eq, inArray, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  auditLog,
  roleCapabilities,
  roles,
  users,
  userInvitations,
} from "@/server/db/schema";
import {
  roleCreateSchema,
  roleDeleteSchema,
  roleUpdateSchema,
  updateRoleCapabilitiesSchema,
  updateUserAccessSchema,
  type RoleCreateInput,
  type RoleDeleteInput,
  type RoleUpdateInput,
  type UpdateRoleCapabilitiesInput,
  type UpdateUserAccessInput,
} from "@/lib/validators/role.schema";
import {
  CAPABILITY_GROUPS,
  CAPABILITY_LABELS,
  DEFAULT_ROLE_CAPABILITIES,
  type Capability,
} from "@/lib/rbac/capabilities";
import { requireCapability, requireSession } from "./auth";

export type RoleManagementRow = {
  id: number;
  nama: string;
  kode: string;
  isSystem: boolean;
  userCount: number;
  capabilities: Capability[];
};

export type RoleOption = {
  id: number;
  nama: string;
  kode: string;
  isSystem: boolean;
};

export async function listRoleManagementRows(): Promise<RoleManagementRow[]> {
  await requireCapability("roles:manage");

  const rows = await db
    .select({
      id: roles.id,
      nama: roles.nama,
      kode: roles.kode,
      isSystem: roles.isSystem,
      userCount: count(users.id),
    })
    .from(roles)
    .leftJoin(users, eq(users.roleId, roles.id))
    .groupBy(roles.id)
    .orderBy(roles.isSystem, roles.nama);

  const caps = await db
    .select({
      roleId: roleCapabilities.roleId,
      capability: roleCapabilities.capability,
    })
    .from(roleCapabilities);

  const capsByRole = new Map<number, Capability[]>();
  for (const cap of caps) {
    const list = capsByRole.get(cap.roleId) ?? [];
    list.push(cap.capability as Capability);
    capsByRole.set(cap.roleId, list);
  }

  return rows.map((row) => ({
    ...row,
    userCount: Number(row.userCount),
    capabilities: capsByRole.get(row.id) ?? [],
  }));
}

export async function listRoleOptions(): Promise<RoleOption[]> {
  await requireCapability("users:manage");

  return db
    .select({
      id: roles.id,
      nama: roles.nama,
      kode: roles.kode,
      isSystem: roles.isSystem,
    })
    .from(roles)
    .orderBy(roles.isSystem, roles.nama);
}

export async function listCapabilityMetadata() {
  await requireCapability("roles:manage");
  return {
    groups: CAPABILITY_GROUPS,
    labels: CAPABILITY_LABELS,
  };
}

async function replaceCapabilities(roleId: number, capabilities: Capability[]) {
  await db.delete(roleCapabilities).where(eq(roleCapabilities.roleId, roleId));

  if (capabilities.length > 0) {
    await db.insert(roleCapabilities).values(
      capabilities.map((capability) => ({
        roleId,
        capability,
      })),
    );
  }
}

export async function createRole(data: RoleCreateInput) {
  const parsed = roleCreateSchema.parse(data);
  const session = await requireCapability("roles:manage");

  const [existing] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.kode, parsed.kode))
    .limit(1);
  if (existing) {
    return { ok: false as const, error: "Kode role sudah digunakan." };
  }

  const [row] = await db
    .insert(roles)
    .values({
      nama: parsed.nama,
      kode: parsed.kode,
      isSystem: false,
      createdBy: session.user.id,
    })
    .returning();

  if (!row) return { ok: false as const, error: "Gagal membuat role." };

  await replaceCapabilities(row.id, parsed.capabilities);
  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_ROLE",
    entitasType: "roles",
    entitasId: String(row.id),
    detail: { nama: parsed.nama, kode: parsed.kode, capabilities: parsed.capabilities },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

export async function updateRole(data: RoleUpdateInput) {
  const parsed = roleUpdateSchema.parse(data);
  const session = await requireCapability("roles:manage");

  const [role] = await db
    .select({ id: roles.id, isSystem: roles.isSystem, kode: roles.kode })
    .from(roles)
    .where(eq(roles.id, parsed.id))
    .limit(1);
  if (!role) return { ok: false as const, error: "Role tidak ditemukan." };

  const [duplicate] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.kode, parsed.kode), ne(roles.id, parsed.id)))
    .limit(1);
  if (duplicate) {
    return { ok: false as const, error: "Kode role sudah digunakan." };
  }

  await db
    .update(roles)
    .set({
      nama: parsed.nama,
      kode: role.isSystem ? role.kode : parsed.kode,
      updatedAt: new Date(),
    })
    .where(eq(roles.id, parsed.id));
  await replaceCapabilities(parsed.id, parsed.capabilities);

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_ROLE",
    entitasType: "roles",
    entitasId: String(parsed.id),
    detail: { nama: parsed.nama, kode: parsed.kode, capabilities: parsed.capabilities },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

export async function updateRoleCapabilities(data: UpdateRoleCapabilitiesInput) {
  const parsed = updateRoleCapabilitiesSchema.parse(data);
  const session = await requireCapability("roles:manage");

  const [role] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.id, parsed.roleId))
    .limit(1);
  if (!role) return { ok: false as const, error: "Role tidak ditemukan." };

  await replaceCapabilities(parsed.roleId, parsed.capabilities);
  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_ROLE_CAPABILITIES",
    entitasType: "roles",
    entitasId: String(parsed.roleId),
    detail: { capabilities: parsed.capabilities },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

export async function deleteRole(data: RoleDeleteInput) {
  const parsed = roleDeleteSchema.parse(data);
  const session = await requireCapability("roles:manage");

  const [role] = await db
    .select({ id: roles.id, isSystem: roles.isSystem, nama: roles.nama })
    .from(roles)
    .where(eq(roles.id, parsed.id))
    .limit(1);
  if (!role) return { ok: false as const, error: "Role tidak ditemukan." };
  if (role.isSystem) {
    return { ok: false as const, error: "Role sistem tidak bisa dihapus." };
  }

  const [usage] = await db
    .select({ total: count() })
    .from(users)
    .where(eq(users.roleId, parsed.id));
  if (Number(usage?.total ?? 0) > 0) {
    return { ok: false as const, error: "Role masih digunakan user." };
  }

  await db.delete(roles).where(eq(roles.id, parsed.id));
  await writeAuditLog({
    userId: session.user.id,
    aksi: "DELETE_ROLE",
    entitasType: "roles",
    entitasId: String(parsed.id),
    detail: { nama: role.nama },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

function legacyRoleFromKode(kode: string): "staff" | "pejabat" | "viewer" {
  if (kode === "pejabat") return "pejabat";
  if (kode === "viewer") return "viewer";
  return "staff";
}

export async function updateUserAccess(data: UpdateUserAccessInput) {
  const parsed = updateUserAccessSchema.parse(data);
  const session = await requireCapability("users:manage");
  const actor = await requireSession();

  const [target] = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      isSuperAdmin: users.isSuperAdmin,
    })
    .from(users)
    .where(eq(users.id, parsed.userId))
    .limit(1);
  if (!target) return { ok: false as const, error: "User tidak ditemukan." };

  const actorRow = await db
    .select({ isSuperAdmin: users.isSuperAdmin })
    .from(users)
    .where(eq(users.id, actor.user.id))
    .limit(1);
  const actorIsSuperAdmin = actorRow[0]?.isSuperAdmin === true;

  if (!actorIsSuperAdmin && parsed.isSuperAdmin !== target.isSuperAdmin) {
    return { ok: false as const, error: "Hanya super admin yang bisa mengubah status super admin." };
  }

  if (target.id === actor.user.id && target.isSuperAdmin && !parsed.isSuperAdmin) {
    return { ok: false as const, error: "Super admin tidak bisa mencabut akses super admin sendiri." };
  }

  if (target.isSuperAdmin && !parsed.isSuperAdmin) {
    const [remaining] = await db
      .select({ total: count() })
      .from(users)
      .where(and(eq(users.isSuperAdmin, true), ne(users.id, parsed.userId)));
    if (Number(remaining?.total ?? 0) === 0) {
      return { ok: false as const, error: "Tidak bisa mencabut super admin terakhir." };
    }
  }

  let roleKode: string | null = null;
  if (!parsed.isSuperAdmin) {
    if (!parsed.roleId) {
      return { ok: false as const, error: "Role wajib dipilih untuk user non-super-admin." };
    }
    const [role] = await db
      .select({ kode: roles.kode })
      .from(roles)
      .where(eq(roles.id, parsed.roleId))
      .limit(1);
    if (!role) return { ok: false as const, error: "Role tidak ditemukan." };
    roleKode = role.kode;
  }

  await db
    .update(users)
    .set({
      isSuperAdmin: parsed.isSuperAdmin,
      roleId: parsed.isSuperAdmin ? null : parsed.roleId,
      role: parsed.isSuperAdmin ? "admin" : legacyRoleFromKode(roleKode ?? "staff"),
      divisiId: parsed.divisiId,
      updatedAt: new Date(),
    })
    .where(eq(users.id, parsed.userId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_USER_ACCESS",
    entitasType: "users",
    entitasId: parsed.userId,
    detail: {
      namaLengkap: target.namaLengkap,
      roleId: parsed.roleId,
      divisiId: parsed.divisiId,
      isSuperAdmin: parsed.isSuperAdmin,
    },
  });

  revalidatePath("/pengaturan");
  revalidatePath("/pegawai");
  return { ok: true as const };
}

export async function seedMissingSystemRoles() {
  const session = await requireCapability("roles:manage");

  const existing = await db
    .select({ kode: roles.kode })
    .from(roles)
    .where(inArray(roles.kode, ["staff", "pejabat", "viewer"]));
  const existingCodes = new Set(existing.map((row) => row.kode));

  for (const [kode, capabilities] of Object.entries(DEFAULT_ROLE_CAPABILITIES)) {
    if (existingCodes.has(kode)) continue;
    const [role] = await db
      .insert(roles)
      .values({
        nama: kode === "staff" ? "Staff" : kode === "pejabat" ? "Pejabat" : "Viewer",
        kode,
        isSystem: true,
        createdBy: session.user.id,
      })
      .returning({ id: roles.id });
    if (role) await replaceCapabilities(role.id, capabilities);
  }

  const systemRoles = await db
    .select({ id: roles.id, kode: roles.kode })
    .from(roles)
    .where(inArray(roles.kode, ["staff", "pejabat", "viewer"]));

  for (const role of systemRoles) {
    const capabilities =
      DEFAULT_ROLE_CAPABILITIES[
        role.kode as keyof typeof DEFAULT_ROLE_CAPABILITIES
      ];
    if (!capabilities) continue;

    await db
      .insert(roleCapabilities)
      .values(
        capabilities.map((capability) => ({
          roleId: role.id,
          capability,
        })),
      )
      .onConflictDoNothing();
  }

  await db.execute(sql`
    UPDATE users
    SET role_id = roles.id
    FROM roles
    WHERE users.role_id IS NULL
      AND users.is_super_admin = false
      AND users.role::text = roles.kode
  `);

  revalidatePath("/pengaturan");
  return { ok: true as const };
}
