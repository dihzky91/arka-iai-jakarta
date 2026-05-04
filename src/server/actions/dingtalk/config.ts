"use server";

import { eq, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { dingtalkConfig, users, account } from "@/server/db/schema";
import { requirePermission, requireSession } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import {
  dingtalkConfigSchema,
  dingtalkUserMappingSchema,
} from "@/lib/validators/dingtalk.schema";
import { env } from "@/lib/env";
import { listDingtalkUsers, type DingtalkUser } from "@/lib/dingtalk/contact";

const PENDING_INVITE_PASSWORD = "PENDING_INVITE";

export async function getDingtalkConfig() {
  await requirePermission("pengaturan", "view");

  const [config] = await db
    .select()
    .from(dingtalkConfig)
    .where(eq(dingtalkConfig.isActive, true))
    .limit(1);

  return { ok: true as const, data: config ?? null };
}

export async function updateDingtalkConfig(input: unknown) {
  const session = await requirePermission("pengaturan", "update");

  const parsed = dingtalkConfigSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const [existing] = await db
    .select({ id: dingtalkConfig.id })
    .from(dingtalkConfig)
    .limit(1);

  if (!existing) {
    await db.insert(dingtalkConfig).values({
      appKey: parsed.data.appKey,
      appSecret: parsed.data.appSecret,
      syncIntervalMenit: parsed.data.syncIntervalMenit,
    });
  } else {
    await db
      .update(dingtalkConfig)
      .set({
        appKey: parsed.data.appKey,
        appSecret: parsed.data.appSecret,
        syncIntervalMenit: parsed.data.syncIntervalMenit,
        updatedAt: new Date(),
      })
      .where(eq(dingtalkConfig.id, existing.id));
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_DINGTALK_CONFIG",
    entitasType: "dingtalk_config",
    entitasId: String(existing?.id ?? "new"),
    detail: { appKey: parsed.data.appKey },
  });

  return { ok: true as const };
}

export async function testDingtalkConnection() {
  await requireSession();

  if (!env.DINGTALK_APP_KEY || !env.DINGTALK_APP_SECRET) {
    return {
      ok: false as const,
      error: "DINGTALK_APP_KEY atau DINGTALK_APP_SECRET belum di-set.",
    };
  }

  try {
    const start = Date.now();
    const res = await fetch(`${env.DINGTALK_BASE_URL}/v1.0/oauth2/accessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appKey: env.DINGTALK_APP_KEY,
        appSecret: env.DINGTALK_APP_SECRET,
      }),
    });
    const elapsed = Date.now() - start;

    if (!res.ok) {
      const text = await res.text();
      return { ok: false as const, error: `HTTP ${res.status}: ${text}` };
    }

    const data = (await res.json()) as { accessToken?: string; message?: string };
    if (!data.accessToken) {
      return { ok: false as const, error: data.message ?? "Token tidak diterima." };
    }

    return {
      ok: true as const,
      message: `DingTalk OK (${elapsed}ms). Token diterima.`,
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal koneksi DingTalk.",
    };
  }
}

export async function getDingtalkSyncStatus() {
  await requirePermission("pengaturan", "view");

  const [config] = await db
    .select({
      lastSyncAt: dingtalkConfig.lastSyncAt,
      lastSyncStatus: dingtalkConfig.lastSyncStatus,
      syncIntervalMenit: dingtalkConfig.syncIntervalMenit,
    })
    .from(dingtalkConfig)
    .where(eq(dingtalkConfig.isActive, true))
    .limit(1);

  return { ok: true as const, data: config ?? null };
}

export async function getDingtalkUserMappings() {
  await requirePermission("pengaturan", "view");

  const rows = await db
    .select({
      id: users.id,
      namaLengkap: users.namaLengkap,
      email: users.email,
      dingtalkUserId: users.dingtalkUserId,
    })
    .from(users)
    .orderBy(users.namaLengkap);

  return { ok: true as const, data: rows };
}

export async function updateDingtalkUserMapping(input: unknown) {
  const session = await requirePermission("pengaturan", "update");

  const parsed = dingtalkUserMappingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  await db
    .update(users)
    .set({ dingtalkUserId: parsed.data.dingtalkUserId })
    .where(eq(users.id, parsed.data.userId));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "UPDATE_DINGTALK_USER_MAPPING",
    entitasType: "users",
    entitasId: parsed.data.userId,
    detail: { dingtalkUserId: parsed.data.dingtalkUserId },
  });

  return { ok: true as const };
}

export async function batchSyncDingtalkStatus() {
  const session = await requirePermission("pengaturan", "update");

  await db
    .update(dingtalkConfig)
    .set({
      lastSyncAt: new Date(),
      lastSyncStatus: "success",
      updatedAt: new Date(),
    })
    .where(eq(dingtalkConfig.isActive, true));

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DINGTALK_SYNC_STATUS_UPDATED",
    entitasType: "dingtalk_config",
    entitasId: "sync",
    detail: { status: "success" },
  });

  return { ok: true as const };
}

export async function autoMatchDingtalkUsers() {
  const session = await requirePermission("pengaturan", "update");

  try {
    const dtkUsers = await listDingtalkUsers();
    if (dtkUsers.length === 0) {
      return { ok: false as const, error: "Tidak ada user ditemukan di DingTalk." };
    }

    const arkaUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.isActive, true));

    const emailToArka = new Map<string, string>();
    for (const u of arkaUsers) {
      if (u.email) emailToArka.set(u.email.toLowerCase(), u.id);
    }

    let matched = 0;
    const updates: { arkaId: string; dtkUserId: string }[] = [];

    for (const dtk of dtkUsers) {
      if (!dtk.email) continue;
      const arkaId = emailToArka.get(dtk.email.toLowerCase());
      if (arkaId) {
        updates.push({ arkaId, dtkUserId: dtk.userId });
      }
    }

    for (const u of updates) {
      await db
        .update(users)
        .set({ dingtalkUserId: u.dtkUserId })
        .where(eq(users.id, u.arkaId));
      matched++;
    }

    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_AUTO_MATCH",
      entitasType: "users",
      entitasId: "batch",
      detail: { totalDingtalk: dtkUsers.length, totalArka: arkaUsers.length, matched },
    });

    return {
      ok: true as const,
      data: {
        matched,
        totalDingtalk: dtkUsers.length,
        totalArka: arkaUsers.length,
      },
    };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal auto-match.",
    };
  }
}

/**
 * Ambil daftar user DingTalk yang belum punya akun ARKA.
 * Filter by email — yang emailnya tidak ada di users table.
 */
export async function getDingtalkUnimportedUsers() {
  await requirePermission("pengaturan", "view");

  try {
    const dtkUsers = await listDingtalkUsers();
    if (dtkUsers.length === 0) {
      return { ok: true as const, data: [] as DingtalkUser[] };
    }

    const emails = dtkUsers.flatMap((u) => (u.email ? [u.email.toLowerCase()] : []));

    const existing = emails.length > 0
      ? await db.select({ email: users.email }).from(users).where(inArray(users.email, emails))
      : [];

    const existingEmails = new Set(existing.map((u) => u.email?.toLowerCase()));

    const unimported = dtkUsers.filter(
      (u) => !u.email || !existingEmails.has(u.email.toLowerCase()),
    );

    return { ok: true as const, data: unimported };
  } catch (e) {
    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Gagal ambil data DingTalk.",
    };
  }
}

interface ImportUser {
  userId: string;
  name: string;
  email: string;
  mobile?: string;
  role: "admin" | "staff" | "pejabat" | "viewer";
}

/**
 * Buat akun ARKA untuk user DingTalk yang dipilih.
 * Akun dibuat dengan isActive: false dan password placeholder.
 * dingtalkUserId langsung di-set.
 */
export async function importDingtalkUsersToArka(selectedUsers: ImportUser[]) {
  const session = await requirePermission("pengaturan", "update");

  if (!selectedUsers.length) {
    return { ok: false as const, error: "Tidak ada user dipilih." };
  }

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const u of selectedUsers) {
    try {
      const [existing] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, u.email))
        .limit(1);

      if (existing) {
        skipped++;
        continue;
      }

      const userId = crypto.randomUUID();

      await db.insert(users).values({
        id: userId,
        namaLengkap: u.name,
        email: u.email,
        noHp: u.mobile ?? null,
        role: u.role,
        dingtalkUserId: u.userId,
        isActive: false,
      });

      await db.insert(account).values({
        id: crypto.randomUUID(),
        accountId: userId,
        providerId: "credential",
        userId,
        password: PENDING_INVITE_PASSWORD,
      });

      imported++;
    } catch (e) {
      errors.push(`${u.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "DINGTALK_IMPORT_USERS",
    entitasType: "users",
    entitasId: "bulk",
    detail: { imported, skipped, errors: errors.length },
  });

  return { ok: true as const, data: { imported, skipped, errors } };
}
