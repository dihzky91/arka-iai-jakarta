"use server";

import { db } from "@/server/db";
import {
  classSessions,
  makeupSessions,
  kelasPelatihan,
  nationalHolidays,
  classTypes,
  type ClassSession,
  type MakeupSession,
} from "@/server/db/schema";
import { eq, and, or, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { requirePermission } from "@/server/actions/auth";
import { parseIsoDateInJakarta } from "@/lib/utils";

export interface CancelSessionInput {
  sessionId: string;
  reason: string;
  cancelledBy: string;
}

export interface CancelSessionResult {
  success: boolean;
  message: string;
  session?: ClassSession;
}

/**
 * Membatalkan sesi kelas (Force Majeure)
 * Status sesi berubah menjadi 'cancelled'
 */
export async function cancelSession(
  input: CancelSessionInput
): Promise<CancelSessionResult> {
  try {
    await requirePermission("jadwalUjian", "manage");
    const { sessionId, reason, cancelledBy } = input;

    // Validasi input
    if (!sessionId || !reason || reason.length < 3) {
      return {
        success: false,
        message: "Session ID dan alasan pembatalan wajib diisi (min. 3 karakter)",
      };
    }

    // Cek apakah sesi exists
    const existingSession = await db.query.classSessions.findFirst({
      where: eq(classSessions.id, sessionId),
    });

    if (!existingSession) {
      return {
        success: false,
        message: "Sesi tidak ditemukan",
      };
    }

    // Cek apakah sesi sudah cancelled atau completed
    if (existingSession.status === "cancelled") {
      return {
        success: false,
        message: "Sesi sudah dibatalkan sebelumnya",
      };
    }

    if (existingSession.status === "completed") {
      return {
        success: false,
        message: "Sesi sudah selesai, tidak dapat dibatalkan",
      };
    }

    // Update sesi menjadi cancelled
    const updatedSession = await db
      .update(classSessions)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelledBy,
        cancellationReason: reason,
      })
      .where(eq(classSessions.id, sessionId))
      .returning();

    revalidatePath("/kelas-jadwal");

    return {
      success: true,
      message: "Sesi berhasil dibatalkan",
      session: updatedSession[0],
    };
  } catch (error) {
    console.error("Error cancelling session:", error);
    return {
      success: false,
      message: "Gagal membatalkan sesi. Silakan coba lagi.",
    };
  }
}

export interface ScheduleMakeupInput {
  originalSessionId: string;
  kelasId: string;
  scheduledDate: string; // YYYY-MM-DD
  timeSlotStart: string; // HH:MM
  timeSlotEnd: string; // HH:MM
  createdBy: string;
}

export interface ScheduleMakeupResult {
  success: boolean;
  message: string;
  makeupSession?: MakeupSession;
  conflicts?: string[];
}

/**
 * Validasi tanggal makeup
 * - Tidak boleh libur nasional
 * - Tidak bentrok dengan sesi lain di kelas yang sama
 * - Mengikuti active_days dari class_type
 */
async function validateMakeupDate(
  kelasId: string,
  scheduledDate: string,
  timeSlotStart: string,
  timeSlotEnd: string,
  excludeSessionId?: string
): Promise<{ valid: boolean; conflicts: string[] }> {
  const conflicts: string[] = [];

  // 1. Cek libur nasional
  const holiday = await db.query.nationalHolidays.findFirst({
    where: eq(nationalHolidays.date, scheduledDate),
  });

  if (holiday) {
    conflicts.push(`Tanggal ${scheduledDate} adalah hari libur: ${holiday.name}`);
  }

  // 2. Cek active_days dari class_type kelas ini
  const kelas = await db.query.kelasPelatihan.findFirst({
    where: eq(kelasPelatihan.id, kelasId),
  });

  if (!kelas) {
    conflicts.push("Kelas tidak ditemukan");
    return { valid: conflicts.length === 0, conflicts };
  }

  const kelasClassType = await db.query.classTypes.findFirst({
    where: eq(classTypes.id, kelas.classTypeId),
  });

  const date = parseIsoDateInJakarta(scheduledDate);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = dayNames[date.getDay()] ?? "";
  const activeDays = kelasClassType?.activeDays.split(",") ?? [];

  if (!activeDays.includes(dayName)) {
    conflicts.push(
      `Tanggal ${scheduledDate} (${dayName}) tidak sesuai dengan jadwal kelas (${activeDays.join(", ")})`
    );
  }

  // 3. Cek bentrok dengan sesi lain di kelas yang sama
  const existingSessions = await db.query.classSessions.findMany({
    where: and(
      eq(classSessions.kelasId, kelasId),
      eq(classSessions.scheduledDate, scheduledDate),
      or(
        and(
          lte(classSessions.timeSlotStart, timeSlotEnd),
          gte(classSessions.timeSlotEnd, timeSlotStart)
        )
      ),
      excludeSessionId ? sql`${classSessions.id} != ${excludeSessionId}` : undefined
    ),
  });

  if (existingSessions.length > 0) {
    conflicts.push(
      `Bentrok dengan sesi lain pada tanggal ${scheduledDate} pukul ${timeSlotStart}-${timeSlotEnd}`
    );
  }

  // 4. Cek bentrok dengan sesi makeup lain di kelas yang sama
  const existingMakeups = await db.query.makeupSessions.findMany({
    where: and(
      eq(makeupSessions.kelasId, kelasId),
      eq(makeupSessions.scheduledDate, scheduledDate),
      eq(makeupSessions.status, "scheduled"),
      or(
        and(
          lte(makeupSessions.timeSlotStart, timeSlotEnd),
          gte(makeupSessions.timeSlotEnd, timeSlotStart)
        )
      )
    ),
  });

  if (existingMakeups.length > 0) {
    conflicts.push(
      `Bentrok dengan sesi makeup lain pada tanggal ${scheduledDate} pukul ${timeSlotStart}-${timeSlotEnd}`
    );
  }

  return { valid: conflicts.length === 0, conflicts };
}

/**
 * Menjadwalkan sesi makeup (pengganti)
 * Validasi: holiday, active_days, conflict dengan sesi lain
 */
export async function scheduleMakeup(
  input: ScheduleMakeupInput
): Promise<ScheduleMakeupResult> {
  try {
    await requirePermission("jadwalUjian", "manage");
    const {
      originalSessionId,
      kelasId,
      scheduledDate,
      timeSlotStart,
      timeSlotEnd,
      createdBy,
    } = input;

    // Validasi input
    if (!originalSessionId || !kelasId || !scheduledDate || !timeSlotStart || !timeSlotEnd) {
      return {
        success: false,
        message: "Semua field wajib diisi",
      };
    }

    // Cek sesi asli
    const originalSession = await db.query.classSessions.findFirst({
      where: eq(classSessions.id, originalSessionId),
    });

    if (!originalSession) {
      return {
        success: false,
        message: "Sesi asli tidak ditemukan",
      };
    }

    // Sesi asli harus cancelled
    if (originalSession.status !== "cancelled") {
      return {
        success: false,
        message: "Sesi asli harus dibatalkan terlebih dahulu sebelum membuat sesi makeup",
      };
    }

    // Cek apakah sudah ada makeup untuk sesi ini
    const existingMakeup = await db.query.makeupSessions.findFirst({
      where: eq(makeupSessions.originalSessionId, originalSessionId),
    });

    if (existingMakeup) {
      return {
        success: false,
        message: "Sesi makeup sudah ada untuk sesi ini. Silakan batalkan yang lama jika ingin mengganti.",
      };
    }

    // Validasi tanggal makeup
    const validation = await validateMakeupDate(
      kelasId,
      scheduledDate,
      timeSlotStart,
      timeSlotEnd
    );

    if (!validation.valid) {
      return {
        success: false,
        message: "Validasi tanggal makeup gagal",
        conflicts: validation.conflicts,
      };
    }

    // Buat sesi makeup
    const newMakeup = await db
      .insert(makeupSessions)
      .values({
        id: nanoid(),
        originalSessionId,
        kelasId,
        sessionNumber: originalSession.sessionNumber,
        isExamDay: originalSession.isExamDay,
        examSubjects: originalSession.examSubjects,
        materiName: originalSession.materiName,
        scheduledDate,
        timeSlotStart,
        timeSlotEnd,
        status: "scheduled",
        createdBy,
      })
      .returning();

    // Update status sesi asli menjadi 'makeup' (artinya sudah punya pengganti)
    await db
      .update(classSessions)
      .set({ status: "makeup" })
      .where(eq(classSessions.id, originalSessionId));

    // Update end_date kelas jika makeup di luar tanggal terakhir
    await recalculateEndDate(kelasId);

    revalidatePath("/kelas-jadwal");

    return {
      success: true,
      message: "Sesi makeup berhasil dijadwalkan",
      makeupSession: newMakeup[0],
    };
  } catch (error) {
    console.error("Error scheduling makeup:", error);
    return {
      success: false,
      message: "Gagal menjadwalkan sesi makeup. Silakan coba lagi.",
    };
  }
}

/**
 * Menghitung ulang end_date kelas berdasarkan tanggal sesi terakhir
 * Termasuk sesi makeup
 */
async function recalculateEndDate(kelasId: string): Promise<void> {
  try {
    // Cari tanggal terakhir dari semua sesi (regular + makeup)
    const lastRegularSession = await db.query.classSessions.findFirst({
      where: and(
        eq(classSessions.kelasId, kelasId),
        or(
          eq(classSessions.status, "scheduled"),
          eq(classSessions.status, "completed"),
          eq(classSessions.status, "makeup")
        )
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.scheduledDate)],
    });

    const lastMakeupSession = await db.query.makeupSessions.findFirst({
      where: and(
        eq(makeupSessions.kelasId, kelasId),
        eq(makeupSessions.status, "scheduled")
      ),
      orderBy: (sessions, { desc }) => [desc(sessions.scheduledDate)],
    });

    // Tentukan tanggal terakhir
    let finalEndDate: string | null = null;

    if (lastRegularSession && lastMakeupSession) {
      finalEndDate =
        lastRegularSession.scheduledDate > lastMakeupSession.scheduledDate
          ? lastRegularSession.scheduledDate
          : lastMakeupSession.scheduledDate;
    } else if (lastRegularSession) {
      finalEndDate = lastRegularSession.scheduledDate;
    } else if (lastMakeupSession) {
      finalEndDate = lastMakeupSession.scheduledDate;
    }

    // Update end_date kelas
    if (finalEndDate) {
      await db
        .update(kelasPelatihan)
        .set({ endDate: finalEndDate })
        .where(eq(kelasPelatihan.id, kelasId));
    }
  } catch (error) {
    console.error("Error recalculating end date:", error);
    throw error;
  }
}

export interface DeleteMakeupInput {
  makeupSessionId: string;
}

export interface DeleteMakeupResult {
  success: boolean;
  message: string;
}

/**
 * Menghapus sesi makeup dan mengembalikan status sesi asli ke 'cancelled'
 */
export async function deleteMakeup(
  input: DeleteMakeupInput
): Promise<DeleteMakeupResult> {
  try {
    await requirePermission("jadwalUjian", "manage");
    const { makeupSessionId } = input;

    const makeupSession = await db.query.makeupSessions.findFirst({
      where: eq(makeupSessions.id, makeupSessionId),
    });

    if (!makeupSession) {
      return {
        success: false,
        message: "Sesi makeup tidak ditemukan",
      };
    }

    // Hapus sesi makeup
    await db.delete(makeupSessions).where(eq(makeupSessions.id, makeupSessionId));

    // Kembalikan status sesi asli ke 'cancelled'
    await db
      .update(classSessions)
      .set({ status: "cancelled" })
      .where(eq(classSessions.id, makeupSession.originalSessionId));

    // Recalculate end_date
    await recalculateEndDate(makeupSession.kelasId);

    revalidatePath("/kelas-jadwal");

    return {
      success: true,
      message: "Sesi makeup berhasil dihapus",
    };
  } catch (error) {
    console.error("Error deleting makeup:", error);
    return {
      success: false,
      message: "Gagal menghapus sesi makeup",
    };
  }
}

export interface GetMakeupSessionsInput {
  kelasId?: string;
  originalSessionId?: string;
}

/**
 * Mengambil daftar sesi makeup
 */
export async function getMakeupSessions(
  input: GetMakeupSessionsInput = {}
): Promise<MakeupSession[]> {
  try {
    await requirePermission("jadwalUjian", "view");
    const { kelasId, originalSessionId } = input;

    let query = db.query.makeupSessions.findMany({
      orderBy: (sessions, { desc }) => [desc(sessions.scheduledDate)],
    });

    // Note: Drizzle query builder doesn't support dynamic where in findMany
    // We'll filter in memory for simplicity, or use raw query for production
    const sessions = await query;

    return sessions.filter((s) => {
      if (kelasId && s.kelasId !== kelasId) return false;
      if (originalSessionId && s.originalSessionId !== originalSessionId) return false;
      return true;
    });
  } catch (error) {
    console.error("Error getting makeup sessions:", error);
    return [];
  }
}
