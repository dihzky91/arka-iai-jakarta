"use server";

import { db } from "@/server/db";
import { notifications, users, type Notification } from "@/server/db/schema";
import { eq, and, desc, count, gte, lte, inArray, lt } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";
import { checkNotificationPreference } from "./notificationPreferences";
import { requireSession, requirePermission } from "./auth";
import {
  buildSuratKeluarReviewEmail,
  buildSuratKeluarRevisiEmail,
  buildSuratKeluarSelesaiEmail,
  sendEmail,
} from "@/lib/email";

export interface NotificationInput {
  userId: string;
  type: typeof notifications.$inferInsert.type;
  title: string;
  message: string;
  entitasType?: string;
  entitasId?: string;
}

/**
 * @internal — hanya boleh dipanggil dari server action lain, bukan dari client.
 * Tidak ada auth check karena ini helper internal yang dipanggil setelah
 * action pemanggil sudah melakukan permission check sendiri.
 */
export async function createNotification(input: NotificationInput): Promise<Notification> {
  const result = await db
    .insert(notifications)
    .values({
      id: nanoid(),
      userId: input.userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entitasType: input.entitasType ?? null,
      entitasId: input.entitasId ?? null,
      isRead: false,
      isEmailSent: false,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create notification");
  }

  revalidatePath("/dashboard");
  return result[0];
}

export async function getNotifications(options?: {
  unreadOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<Notification[]> {
  const session = await requireSession();
  const userId = session.user.id;

  const conditions = [eq(notifications.userId, userId)];

  if (options?.unreadOnly) {
    conditions.push(eq(notifications.isRead, false));
  }

  const results = await db
    .select()
    .from(notifications)
    .where(conditions.length > 1 ? and(...conditions) : conditions[0])
    .orderBy(desc(notifications.createdAt))
    .limit(options?.limit ?? 50)
    .offset(options?.offset ?? 0);

  return results;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await requireSession();
  const userId = session.user.id;

  const result = await db
    .select({ count: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  return result[0]?.count || 0;
}

export async function markNotificationAsRead(
  notificationId: string,
): Promise<void> {
  const session = await requireSession();
  const userId = session.user.id;

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(
      and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
    );

  revalidatePath("/dashboard");
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const session = await requireSession();
  const userId = session.user.id;

  await db
    .update(notifications)
    .set({
      isRead: true,
      readAt: new Date(),
    })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));

  revalidatePath("/dashboard");
}

export async function deleteNotification(
  notificationId: string,
): Promise<void> {
  const session = await requireSession();
  const userId = session.user.id;

  await db
    .delete(notifications)
    .where(
      and(eq(notifications.id, notificationId), eq(notifications.userId, userId))
    );

  revalidatePath("/dashboard");
}

export async function pruneOldNotifications(daysOld: number = 90): Promise<number> {
  // Fungsi ini dipanggil dari 2 konteks:
  // 1. Cron job (tanpa session) — dilindungi oleh CRON_SECRET di route handler
  // 2. Admin manual — harus punya permission pengaturan:manage
  try {
    // Jika ada session aktif, enforce permission admin
    await requirePermission("pengaturan", "manage");
  } catch (err) {
    // Jika error = "Unauthorized" (tidak ada session), izinkan untuk cron context.
    // Jika error = "Forbidden" (ada session tapi bukan admin), re-throw.
    if (err instanceof Error && err.message === "Unauthorized") {
      // Cron context — tidak ada session, tapi cron route sudah auth via CRON_SECRET
    } else {
      throw err;
    }
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - daysOld);

  const result = await db
    .delete(notifications)
    .where(
      and(
        eq(notifications.isRead, true),
        lt(notifications.createdAt, cutoff)
      )
    )
    .returning({ id: notifications.id });

  return result.length;
}

// ─── INTERNAL HELPERS (dipanggil dari server action lain yang sudah ber-guard) ───

/** @internal */
export async function notifyDisposisiBaru(
  kepadaUserId: string,
  dariNama: string,
  suratPerihal: string,
  disposisiId: string
): Promise<void> {
  const pref = await checkNotificationPreference(kepadaUserId, "disposisi_baru");
  if (!pref.inApp) return;

  await createNotification({
    userId: kepadaUserId,
    type: "disposisi_baru",
    title: "Disposisi Baru",
    message: `Anda menerima disposisi dari ${dariNama} untuk surat: ${suratPerihal}`,
    entitasType: "disposisi",
    entitasId: disposisiId,
  });
}

/** @internal */
export async function notifyDisposisiDeadline(
  userId: string,
  suratPerihal: string,
  batasWaktu: Date,
  disposisiId: string
): Promise<void> {
  const pref = await checkNotificationPreference(userId, "disposisi_deadline");
  if (!pref.inApp) return;

  const daysLeft = Math.ceil(
    (batasWaktu.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  await createNotification({
    userId,
    type: "disposisi_deadline",
    title: "Deadline Disposisi Mendekati",
    message: `Disposisi untuk "${suratPerihal}" akan berakhir dalam ${daysLeft} hari`,
    entitasType: "disposisi",
    entitasId: disposisiId,
  });
}

/** @internal */
export async function notifySuratKeluarApproval(
  pejabatUserId: string,
  pengirimNama: string,
  perihal: string,
  suratId: string,
  prosesViaSimpeg = false,
  tujuan?: string | null,
): Promise<void> {
  const pref = await checkNotificationPreference(pejabatUserId, "surat_keluar_approval");

  if (pref.inApp) {
    await createNotification({
      userId: pejabatUserId,
      type: "surat_keluar_approval",
      title: "Persetujuan Surat Keluar",
      message: `${pengirimNama} meminta persetujuan untuk surat: ${perihal}`,
      entitasType: "surat_keluar",
      entitasId: suratId,
    });
  }

  if (pref.email && !prosesViaSimpeg) {
    const [pejabat] = await db
      .select({ email: users.email, namaLengkap: users.namaLengkap })
      .from(users)
      .where(eq(users.id, pejabatUserId))
      .limit(1);

    if (pejabat?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const email = buildSuratKeluarReviewEmail({
        pejabatNama: pejabat.namaLengkap,
        pengirimNama,
        perihal,
        tujuan,
        reviewUrl: `${appUrl}/surat-keluar/review/${suratId}`,
      });
      void sendEmail({ to: pejabat.email, toName: pejabat.namaLengkap, ...email });
    }
  }
}

/** @internal */
export async function notifySuratKeluarRevisi(
  creatorUserId: string,
  pejabatNama: string,
  perihal: string,
  catatan: string,
  suratId: string
): Promise<void> {
  const pref = await checkNotificationPreference(creatorUserId, "surat_keluar_revisi");

  if (pref.inApp) {
    await createNotification({
      userId: creatorUserId,
      type: "surat_keluar_revisi",
      title: "Revisi Surat Keluar Diperlukan",
      message: `${pejabatNama} meminta revisi untuk "${perihal}". Catatan: ${catatan}`,
      entitasType: "surat_keluar",
      entitasId: suratId,
    });
  }

  if (pref.email) {
    const [creator] = await db
      .select({ email: users.email, namaLengkap: users.namaLengkap })
      .from(users)
      .where(eq(users.id, creatorUserId))
      .limit(1);

    if (creator?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const email = buildSuratKeluarRevisiEmail({
        pembuatNama: creator.namaLengkap,
        pejabatNama,
        perihal,
        catatan,
        suratUrl: `${appUrl}/surat-keluar`,
      });
      void sendEmail({ to: creator.email, toName: creator.namaLengkap, ...email });
    }
  }
}

/** @internal */
export async function notifySuratKeluarSelesai(
  creatorUserId: string,
  perihal: string,
  nomorSurat: string | null,
  suratId: string
): Promise<void> {
  const pref = await checkNotificationPreference(creatorUserId, "surat_keluar_selesai");

  if (pref.inApp) {
    await createNotification({
      userId: creatorUserId,
      type: "surat_keluar_selesai",
      title: "Surat Keluar Selesai",
      message: `Surat "${perihal}" telah selesai${nomorSurat ? ` dengan nomor ${nomorSurat}` : ""}`,
      entitasType: "surat_keluar",
      entitasId: suratId,
    });
  }

  if (pref.email) {
    const [creator] = await db
      .select({ email: users.email, namaLengkap: users.namaLengkap })
      .from(users)
      .where(eq(users.id, creatorUserId))
      .limit(1);

    if (creator?.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
      const email = buildSuratKeluarSelesaiEmail({
        pembuatNama: creator.namaLengkap,
        perihal,
        nomorSurat,
        suratUrl: `${appUrl}/surat-keluar`,
      });
      void sendEmail({ to: creator.email, toName: creator.namaLengkap, ...email });
    }
  }
}

/** @internal */
export async function notifySuratMasukBaru(
  suratPerihal: string,
  pengirim: string,
  suratMasukId: string
): Promise<void> {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.isActive, true),
        inArray(users.role, ["admin", "pejabat"])
      )
    );

  for (const recipient of recipients) {
    const pref = await checkNotificationPreference(recipient.id, "surat_masuk_baru");
    if (!pref.inApp) continue;

    await createNotification({
      userId: recipient.id,
      type: "surat_masuk_baru",
      title: "Surat Masuk Baru",
      message: `Surat masuk baru "${suratPerihal}" dari ${pengirim}`,
      entitasType: "surat_masuk",
      entitasId: suratMasukId,
    });
  }
}
