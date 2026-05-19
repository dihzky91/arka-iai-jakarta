"use server";

import { and, count, desc, eq, lt, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  users,
  account,
  divisi,
  roles,
  userInvitations,
  auditLog,
} from "@/server/db/schema";
import { auth } from "@/server/auth";
import { env } from "@/lib/env";
import {
  inviteUserSchema,
  resendInviteSchema,
  cancelInviteSchema,
  toggleUserStatusSchema,
  type InviteUserInput,
  type ResendInviteInput,
  type CancelInviteInput,
  type ToggleUserStatusInput,
} from "@/lib/validators/invitation.schema";
import { requireCapability, requirePermission } from "./auth";

// â”€â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const INVITE_EXPIRY_HOURS = 24;
const PENDING_INVITE_PASSWORD = "PENDING_INVITE";

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export type InvitationRow = {
  id: string;
  email: string;
  namaLengkap: string;
  role: "admin" | "staff" | "pejabat" | "viewer";
  roleId: number | null;
  roleName: string | null;
  divisiId: number | null;
  divisiNama: string | null;
  jabatan: string | null;
  status: "pending" | "accepted" | "expired" | "cancelled";
  expiredAt: Date;
  usedAt: Date | null;
  invitedByName: string;
  createdAt: Date;
};

export type UserRow = {
  id: string;
  namaLengkap: string;
  email: string;
  role: "admin" | "staff" | "pejabat" | "viewer" | null;
  roleId: number | null;
  roleName: string | null;
  isSuperAdmin: boolean;
  divisiId: number | null;
  divisiNama: string | null;
  jabatan: string | null;
  isActive: boolean | null;
  createdAt: Date | null;
};

// â”€â”€â”€ Queries â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function listInvitations(): Promise<InvitationRow[]> {
  await requirePermission("manajemenUser", "view");

  const inviter = db
    .select({ id: users.id, namaLengkap: users.namaLengkap })
    .from(users)
    .as("inviter");

  const rows = await db
    .select({
      id: userInvitations.id,
      email: userInvitations.email,
      namaLengkap: userInvitations.namaLengkap,
      role: userInvitations.role,
      roleId: userInvitations.roleId,
      roleName: roles.nama,
      divisiId: userInvitations.divisiId,
      divisiNama: divisi.nama,
      jabatan: userInvitations.jabatan,
      status: userInvitations.status,
      expiredAt: userInvitations.expiredAt,
      usedAt: userInvitations.usedAt,
      invitedByName: inviter.namaLengkap,
      createdAt: userInvitations.createdAt,
    })
    .from(userInvitations)
    .leftJoin(roles, eq(userInvitations.roleId, roles.id))
    .leftJoin(divisi, eq(userInvitations.divisiId, divisi.id))
    .leftJoin(inviter, eq(userInvitations.invitedBy, inviter.id))
    .orderBy(desc(userInvitations.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r,
    roleName: r.roleName ?? null,
    divisiNama: r.divisiNama ?? null,
    invitedByName: r.invitedByName ?? "Sistem",
  }));
}

export async function listUsersForManagement(options?: {
  cursor?: string;
  limit?: number;
}): Promise<{ rows: UserRow[]; nextCursor: string | null; total: number }> {
  await requirePermission("manajemenUser", "view");

  const limit = options?.limit ?? 200;
  const cursorDate = options?.cursor ? new Date(options.cursor) : undefined;

  const totalRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users);
  const total = Number(totalRows[0]?.count ?? 0);

  const rows = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      role: users.role,
      roleId: users.roleId,
      roleName: roles.nama,
      isSuperAdmin: users.isSuperAdmin,
      divisiId: users.divisiId,
      divisiNama: divisi.nama,
      jabatan: users.jabatan,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(roles, eq(users.roleId, roles.id))
    .leftJoin(divisi, eq(users.divisiId, divisi.id))
    .where(cursorDate ? lt(users.createdAt, cursorDate) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, -1) : rows;
  const nextCursor = hasMore
    ? (data[data.length - 1]!.createdAt?.toISOString() ?? null)
    : null;

  return { rows: data, nextCursor, total };
}

// â”€â”€â”€ Invite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function inviteUser(data: InviteUserInput) {
  const parsed = inviteUserSchema.parse(data);
  const session = await requireCapability("users:invite");

  // Privilege escalation guard â€” cegah invite role lebih tinggi dari diri sendiri
  const [targetRole] = await db
    .select({ id: roles.id, nama: roles.nama, kode: roles.kode })
    .from(roles)
    .where(eq(roles.id, parsed.roleId))
    .limit(1);
  if (!targetRole) {
    return { ok: false as const, error: "Role tidak ditemukan." };
  }

  const legacyRole =
    targetRole.kode === "pejabat"
      ? "pejabat"
      : targetRole.kode === "viewer"
        ? "viewer"
        : "staff";

  // Cek email duplikat di tabel users
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.email))
    .limit(1);

  if (existingUser.length > 0) {
    return { ok: false as const, error: "Email tersebut sudah terdaftar sebagai user." };
  }

  // Cek undangan pending yang masih aktif dengan email sama
  const existingInvite = await db
    .select({ id: userInvitations.id })
    .from(userInvitations)
    .where(eq(userInvitations.email, parsed.email))
    .limit(1);

  const pendingExists = existingInvite.length > 0;
  // Jika ada invite pending, kita tetap izinkan tetapi beri info
  // Admin bisa pilih resend atau cancel invite lama

  // Buat token + expiry
  const token = crypto.randomUUID();
  const expiredAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  // DB writes dalam satu transaction — atomic: invitation + user + account
  const { invitation, newUserId } = await db.transaction(async (tx) => {
    // 1. Simpan invitation record
    const [inv] = await tx
      .insert(userInvitations)
      .values({
        email: parsed.email,
        namaLengkap: parsed.namaLengkap,
        role: legacyRole,
        roleId: parsed.roleId,
        divisiId: parsed.divisiId,
        jabatan: parsed.jabatan,
        token,
        expiredAt,
        invitedBy: session.user.id,
      })
      .returning();

    // 2. Buat user row
    const userId = crypto.randomUUID();
    await tx.insert(users).values({
      id: userId,
      namaLengkap: parsed.namaLengkap,
      email: parsed.email,
      role: legacyRole,
      roleId: parsed.roleId,
      divisiId: parsed.divisiId,
      jabatan: parsed.jabatan,
      isActive: false,
    });

    // 3. Buat account row dengan password placeholder
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: PENDING_INVITE_PASSWORD,
    });

    return { invitation: inv!, newUserId: userId };
  });

  // 4. Side effects di luar transaction (email, audit log)
  let inviteSent = true;
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.email,
        redirectTo: `${env.BETTER_AUTH_URL}/reset-password?invite=1`,
      },
    });
  } catch (err) {
    inviteSent = false;
    console.error("[inviteUser] Gagal kirim invite email:", err);
  }

  // 5. Audit log
  await writeAuditLog({
    userId: session.user.id,
    aksi: "INVITE_USER",
    entitasType: "user_invitations",
    entitasId: invitation.id,
    detail: {
      email: parsed.email,
      namaLengkap: parsed.namaLengkap,
      roleId: parsed.roleId,
      roleName: targetRole.nama,
      inviteSent,
    },
  });

  revalidatePath("/pengaturan");
  return {
    ok: true as const,
    data: invitation,
    inviteSent,
    pendingExists,
  };
}

// â”€â”€â”€ Resend Invite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function resendInvite(data: ResendInviteInput) {
  const parsed = resendInviteSchema.parse(data);
  const session = await requirePermission("manajemenUser", "manage");

  const [invitation] = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.id, parsed.invitationId))
    .limit(1);

  if (!invitation) {
    return { ok: false as const, error: "Undangan tidak ditemukan." };
  }

  if (invitation.status === "accepted") {
    return { ok: false as const, error: "Undangan sudah digunakan." };
  }

  if (invitation.status === "cancelled") {
    return { ok: false as const, error: "Undangan sudah dibatalkan." };
  }

  // Update token + expiry baru
  const newToken = crypto.randomUUID();
  const newExpiredAt = new Date(Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000);

  await db
    .update(userInvitations)
    .set({
      token: newToken,
      expiredAt: newExpiredAt,
      status: "pending",
    })
    .where(eq(userInvitations.id, parsed.invitationId));

  // Kirim ulang email
  let inviteSent = true;
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: invitation.email,
        redirectTo: `${env.BETTER_AUTH_URL}/reset-password?invite=1`,
      },
    });
  } catch (err) {
    inviteSent = false;
    console.error("[resendInvite] Gagal kirim ulang invite email:", err);
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "RESEND_INVITE",
    entitasType: "user_invitations",
    entitasId: invitation.id,
    detail: { email: invitation.email, inviteSent },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const, inviteSent };
}

// â”€â”€â”€ Cancel Invite â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function cancelInvite(data: CancelInviteInput) {
  const parsed = cancelInviteSchema.parse(data);
  const session = await requirePermission("manajemenUser", "manage");

  const [invitation] = await db
    .select()
    .from(userInvitations)
    .where(eq(userInvitations.id, parsed.invitationId))
    .limit(1);

  if (!invitation) {
    return { ok: false as const, error: "Undangan tidak ditemukan." };
  }

  if (invitation.status !== "pending") {
    return { ok: false as const, error: "Hanya undangan pending yang bisa dibatalkan." };
  }

  await db
    .update(userInvitations)
    .set({ status: "cancelled" })
    .where(eq(userInvitations.id, parsed.invitationId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CANCEL_INVITE",
    entitasType: "user_invitations",
    entitasId: invitation.id,
    detail: { email: invitation.email },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

// â”€â”€â”€ Toggle User Active Status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function toggleUserStatus(data: ToggleUserStatusInput) {
  const parsed = toggleUserStatusSchema.parse(data);
  const session = await requirePermission("manajemenUser", "update");

  // Cegah admin menonaktifkan diri sendiri
  if (session.user.id === parsed.userId && !parsed.isActive) {
    return { ok: false as const, error: "Anda tidak dapat menonaktifkan akun sendiri." };
  }

  const [target] = await db
    .select({ id: users.id, namaLengkap: users.namaLengkap, role: users.role })
    .from(users)
    .where(eq(users.id, parsed.userId));

  if (!target) {
    return { ok: false as const, error: "User tidak ditemukan." };
  }

  // Cegah non-admin mengubah status admin
  const sessionRole = (session.user as { role?: string }).role;
  if (target.role === "admin" && sessionRole !== "admin") {
    return { ok: false as const, error: "Tidak bisa mengubah status admin." };
  }

  // Proteksi admin terakhir â€” cegah nonaktifkan satu-satunya admin aktif
  if (!parsed.isActive && target.role === "admin") {
    const [activeAdminCount] = await db
      .select({ total: count() })
      .from(users)
      .where(
        and(
          eq(users.role, "admin"),
          eq(users.isActive, true),
          ne(users.id, parsed.userId),
        ),
      );
    if (!activeAdminCount || activeAdminCount.total === 0) {
      return {
        ok: false as const,
        error: "Tidak dapat menonaktifkan admin terakhir. Sistem membutuhkan minimal satu admin aktif.",
      };
    }
  }

  await db
    .update(users)
    .set({ isActive: parsed.isActive, updatedAt: new Date() })
    .where(eq(users.id, parsed.userId));

  const aksi = parsed.isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER";
  await writeAuditLog({
    userId: session.user.id,
    aksi,
    entitasType: "users",
    entitasId: parsed.userId,
    detail: { namaLengkap: target.namaLengkap, isActive: parsed.isActive },
  });

  revalidatePath("/pengaturan");
  revalidatePath("/pegawai");
  return { ok: true as const };
}

// â”€â”€â”€ Activate Invited Account (dipanggil setelah user set password) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Tidak memerlukan session â€” dipanggil dari halaman reset-password.
// Keamanan: validasi bahwa account password sudah bukan PENDING_INVITE lagi.

export async function activateInvitedAccount(email: string) {
  if (!email) return { ok: false as const, error: "Email tidak valid." };

  // Cari user berdasarkan email
  const [user] = await db
    .select({ id: users.id, isActive: users.isActive })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) return { ok: false as const, error: "User tidak ditemukan." };

  // Validasi: pastikan account password sudah bukan placeholder
  const [acc] = await db
    .select({ password: account.password })
    .from(account)
    .where(
      and(
        eq(account.userId, user.id),
        eq(account.providerId, "credential"),
      ),
    )
    .limit(1);

  if (!acc || acc.password === PENDING_INVITE_PASSWORD) {
    return { ok: false as const, error: "Akun belum diaktivasi â€” password belum diset." };
  }

  // Aktivasi user
  const now = new Date();
  await db
    .update(users)
    .set({ isActive: true, activatedAt: now, emailVerified: true, updatedAt: now })
    .where(eq(users.id, user.id));

  // Mark invitation(s) sebagai accepted
  const pendingInvites = await db
    .select({ id: userInvitations.id })
    .from(userInvitations)
    .where(
      and(
        eq(userInvitations.email, email),
        eq(userInvitations.status, "pending"),
      ),
    );

  for (const inv of pendingInvites) {
    await db
      .update(userInvitations)
      .set({ status: "accepted", usedAt: now })
      .where(eq(userInvitations.id, inv.id));
  }

  // Audit log (system-initiated)
  await writeAuditLog({
    userId: user.id,
    aksi: "ACCOUNT_ACTIVATED",
    entitasType: "users",
    entitasId: user.id,
    detail: { email, activatedAt: now.toISOString() },
  });

  return { ok: true as const };
}

// â”€â”€â”€ Admin Reset Password (kirim email reset untuk user existing) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function adminResetPassword(userId: string) {
  const session = await requirePermission("manajemenUser", "manage");

  const [target] = await db
    .select({ id: users.id, email: users.email, namaLengkap: users.namaLengkap })
    .from(users)
    .where(eq(users.id, userId));

  if (!target) {
    return { ok: false as const, error: "User tidak ditemukan." };
  }

  let emailSent = true;
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: target.email,
        redirectTo: `${env.BETTER_AUTH_URL}/reset-password`,
      },
    });
  } catch (err) {
    emailSent = false;
    console.error("[adminResetPassword] Gagal kirim email reset:", err);
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "ADMIN_RESET_PASSWORD",
    entitasType: "users",
    entitasId: target.id,
    detail: { email: target.email, namaLengkap: target.namaLengkap, emailSent },
  });

  revalidatePath("/pengaturan");
  return { ok: true as const, emailSent };
}
