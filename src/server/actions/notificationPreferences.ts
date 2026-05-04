"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import { notificationPreferences, type NotificationPreferences } from "@/server/db/schema";
import { requireSession } from "./auth";

export type NotificationPreferencesRow = NotificationPreferences;

const DEFAULTS = {
  inAppDisposisiBaru: true,
  inAppDisposisiDeadline: true,
  inAppSuratKeluarApproval: true,
  inAppSuratKeluarRevisi: true,
  inAppSuratKeluarSelesai: true,
  inAppSuratMasukBaru: true,
  emailDisposisiBaru: true,
  emailDisposisiDeadline: true,
  emailSuratKeluarApproval: false,
  emailSuratKeluarRevisi: false,
  emailSuratKeluarSelesai: false,
  emailSuratMasukBaru: false,
  deadlineReminderDays: 1,
};

export async function getMyNotificationPreferences(): Promise<NotificationPreferencesRow> {
  const session = await requireSession();
  const userId = session.user.id;

  const [existing] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (existing) return existing;

  // Auto-create default row on first access
  const [created] = await db
    .insert(notificationPreferences)
    .values({ userId, ...DEFAULTS })
    .returning();

  return created!;
}

const updateSchema = z.object({
  inAppDisposisiBaru: z.boolean(),
  inAppDisposisiDeadline: z.boolean(),
  inAppSuratKeluarApproval: z.boolean(),
  inAppSuratKeluarRevisi: z.boolean(),
  inAppSuratKeluarSelesai: z.boolean(),
  inAppSuratMasukBaru: z.boolean(),
  emailDisposisiBaru: z.boolean(),
  emailDisposisiDeadline: z.boolean(),
  emailSuratKeluarApproval: z.boolean(),
  emailSuratKeluarRevisi: z.boolean(),
  emailSuratKeluarSelesai: z.boolean(),
  emailSuratMasukBaru: z.boolean(),
  deadlineReminderDays: z.number().int().min(0).max(30),
});

export async function updateMyNotificationPreferences(input: unknown) {
  const session = await requireSession();
  const userId = session.user.id;

  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Data tidak valid.",
    };
  }

  const [existing] = await db
    .select({ id: notificationPreferences.id })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (existing) {
    await db
      .update(notificationPreferences)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db
      .insert(notificationPreferences)
      .values({ userId, ...parsed.data });
  }

  revalidatePath("/pengaturan");
  return { ok: true as const };
}

/**
 * Helper untuk modul lain: cek apakah user mau menerima tipe notifikasi tertentu.
 * Returns { inApp, email } booleans.
 */
export async function checkNotificationPreference(
  userId: string,
  type:
    | "disposisi_baru"
    | "disposisi_deadline"
    | "surat_keluar_approval"
    | "surat_keluar_revisi"
    | "surat_keluar_selesai"
    | "surat_masuk_baru",
): Promise<{ inApp: boolean; email: boolean }> {
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (!pref) {
    // Default: in-app on, email depends on type
    const emailDefault =
      type === "disposisi_baru" || type === "disposisi_deadline";
    return { inApp: true, email: emailDefault };
  }

  const map = {
    disposisi_baru: { inApp: pref.inAppDisposisiBaru, email: pref.emailDisposisiBaru },
    disposisi_deadline: { inApp: pref.inAppDisposisiDeadline, email: pref.emailDisposisiDeadline },
    surat_keluar_approval: { inApp: pref.inAppSuratKeluarApproval, email: pref.emailSuratKeluarApproval },
    surat_keluar_revisi: { inApp: pref.inAppSuratKeluarRevisi, email: pref.emailSuratKeluarRevisi },
    surat_keluar_selesai: { inApp: pref.inAppSuratKeluarSelesai, email: pref.emailSuratKeluarSelesai },
    surat_masuk_baru: { inApp: pref.inAppSuratMasukBaru, email: pref.emailSuratMasukBaru },
  };

  return map[type];
}
