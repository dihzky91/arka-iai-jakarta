"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/server/db";
import {
  notifications,
  notificationPreferences,
  type NotificationPreferences,
} from "@/server/db/schema";
import { requireSession } from "./auth";

export type NotificationPreferencesRow = NotificationPreferences;
export type NotificationPreferenceType = typeof notifications.$inferInsert.type;

const DEFAULTS = {
  inAppDisposisiBaru: true,
  inAppDisposisiDeadline: true,
  inAppSuratKeluarApproval: true,
  inAppSuratKeluarRevisi: true,
  inAppSuratKeluarSelesai: true,
  inAppSuratMasukBaru: true,
  inAppProjectInvitation: true,
  inAppProjectMention: true,
  inAppProjectUpdate: true,
  inAppHonorariumStatus: true,
  inAppSystem: true,
  emailDisposisiBaru: true,
  emailDisposisiDeadline: true,
  emailSuratKeluarApproval: false,
  emailSuratKeluarRevisi: false,
  emailSuratKeluarSelesai: false,
  emailSuratMasukBaru: false,
  emailProjectInvitation: false,
  emailProjectMention: false,
  emailProjectUpdate: false,
  emailHonorariumStatus: false,
  emailSystem: false,
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
  inAppProjectInvitation: z.boolean(),
  inAppProjectMention: z.boolean(),
  inAppProjectUpdate: z.boolean(),
  inAppHonorariumStatus: z.boolean(),
  inAppSystem: z.boolean(),
  emailDisposisiBaru: z.boolean(),
  emailDisposisiDeadline: z.boolean(),
  emailSuratKeluarApproval: z.boolean(),
  emailSuratKeluarRevisi: z.boolean(),
  emailSuratKeluarSelesai: z.boolean(),
  emailSuratMasukBaru: z.boolean(),
  emailProjectInvitation: z.boolean(),
  emailProjectMention: z.boolean(),
  emailProjectUpdate: z.boolean(),
  emailHonorariumStatus: z.boolean(),
  emailSystem: z.boolean(),
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
  type: NotificationPreferenceType,
): Promise<{ inApp: boolean; email: boolean }> {
  const [pref] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  if (!pref) {
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
    project_invitation: { inApp: pref.inAppProjectInvitation, email: pref.emailProjectInvitation },
    mention: { inApp: pref.inAppProjectMention, email: pref.emailProjectMention },
    project_update: { inApp: pref.inAppProjectUpdate, email: pref.emailProjectUpdate },
    honorarium_status: { inApp: pref.inAppHonorariumStatus, email: pref.emailHonorariumStatus },
    system: { inApp: pref.inAppSystem, email: pref.emailSystem },
  };

  return map[type];
}
