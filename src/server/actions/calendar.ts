"use server";

import { db } from "@/server/db";
import { calendarEvents, type CalendarEvent, disposisi, suratKeluar, jadwalUjian, kelasUjian, penugasanPengawas, pengawas, adminJaga, jadwalAdminJaga as jadwalAdminJagaTable } from "@/server/db/schema";
import { eq, and, gte, lte, desc, or, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { parseIsoDateTimeInJakarta } from "@/lib/utils";

export interface CalendarEventInput {
  title: string;
  description?: string;
  eventType: typeof calendarEvents.$inferInsert.eventType;
  entitasType?: string;
  entitasId?: string;
  startDate: Date;
  endDate?: Date;
  allDay?: boolean;
  userId?: string;
  isPublic?: boolean;
}

export async function createCalendarEvent(input: CalendarEventInput): Promise<CalendarEvent> {
  const result = await db
    .insert(calendarEvents)
    .values({
      id: nanoid(),
      title: input.title,
      description: input.description ?? null,
      eventType: input.eventType,
      entitasType: input.entitasType ?? null,
      entitasId: input.entitasId ?? null,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      allDay: input.allDay ?? false,
      userId: input.userId ?? null,
      isPublic: input.isPublic ?? false,
    })
    .returning();

  if (!result[0]) {
    throw new Error("Failed to create calendar event");
  }

  return result[0];
}

export async function getCalendarEvents(options?: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  includePublic?: boolean;
}): Promise<CalendarEvent[]> {
  const conditions: ReturnType<typeof eq>[] = [];

  if (options?.userId) {
    if (options.includePublic) {
      conditions.push(
        or(
          eq(calendarEvents.userId, options.userId),
          eq(calendarEvents.isPublic, true)
        ) as ReturnType<typeof eq>
      );
    } else {
      conditions.push(eq(calendarEvents.userId, options.userId));
    }
  }

  if (options?.startDate) {
    conditions.push(gte(calendarEvents.startDate, options.startDate));
  }

  if (options?.endDate) {
    conditions.push(lte(calendarEvents.startDate, options.endDate));
  }

  if (options?.eventType) {
    conditions.push(eq(calendarEvents.eventType, options.eventType as typeof calendarEvents.$inferInsert.eventType));
  }

  const results = await db
    .select()
    .from(calendarEvents)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(calendarEvents.startDate));

  return results;
}

export async function getCalendarEventsByMonth(
  year: number,
  month: number,
  userId?: string
): Promise<CalendarEvent[]> {
  const monthText = String(month).padStart(2, "0");
  const startIso = `${year}-${monthText}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endIso = `${year}-${monthText}-${String(lastDay).padStart(2, "0")}`;
  const start = parseIsoDateTimeInJakarta(startIso, "00:00");
  const end = parseIsoDateTimeInJakarta(endIso, "23:59");

  return getCalendarEvents({
    userId,
    startDate: start,
    endDate: end,
    includePublic: true,
  });
}

export async function updateCalendarEvent(
  eventId: string,
  input: Partial<CalendarEventInput>,
  userId: string
): Promise<CalendarEvent> {
  const updateData: Partial<typeof calendarEvents.$inferInsert> = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.description !== undefined) updateData.description = input.description;
  if (input.eventType !== undefined) updateData.eventType = input.eventType;
  if (input.startDate !== undefined) updateData.startDate = input.startDate;
  if (input.endDate !== undefined) updateData.endDate = input.endDate;
  if (input.allDay !== undefined) updateData.allDay = input.allDay;
  if (input.isPublic !== undefined) updateData.isPublic = input.isPublic;

  updateData.updatedAt = new Date();

  const result = await db
    .update(calendarEvents)
    .set(updateData)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)))
    .returning();

  if (!result[0]) {
    throw new Error("Failed to update calendar event");
  }

  return result[0];
}

export async function deleteCalendarEvent(eventId: string, userId: string): Promise<void> {
  await db
    .delete(calendarEvents)
    .where(and(eq(calendarEvents.id, eventId), eq(calendarEvents.userId, userId)));

}

// Sync disposisi deadline to calendar
export async function syncDisposisiDeadline(
  disposisiId: string,
  suratPerihal: string,
  batasWaktu: Date,
  userId: string
): Promise<void> {
  // Check if event already exists
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.entitasType, "disposisi"),
        eq(calendarEvents.entitasId, disposisiId),
        eq(calendarEvents.eventType, "disposisi_deadline")
      )
    );

  const existingEvent = existing[0];
  if (existingEvent) {
    // Update existing event
    await db
      .update(calendarEvents)
      .set({
        startDate: batasWaktu,
        title: `Deadline: ${suratPerihal}`,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, existingEvent.id));
  } else {
    // Create new event
    await createCalendarEvent({
      title: `Deadline: ${suratPerihal}`,
      description: `Batas waktu menyelesaikan disposisi untuk surat: ${suratPerihal}`,
      eventType: "disposisi_deadline",
      entitasType: "disposisi",
      entitasId: disposisiId,
      startDate: batasWaktu,
      allDay: true,
      userId,
      isPublic: false,
    });
  }
}

// Sync surat keluar workflow to calendar
export async function syncSuratKeluarEvent(
  suratId: string,
  perihal: string,
  status: string,
  userId: string
): Promise<void> {
  const eventTitle = `Surat Keluar: ${perihal}`;

  // Check if event already exists
  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.entitasType, "surat_keluar"),
        eq(calendarEvents.entitasId, suratId)
      )
    );

  const existingEvent = existing[0];
  if (existingEvent) {
    // Update existing event
    await db
      .update(calendarEvents)
      .set({
        title: eventTitle,
        description: `Status: ${status}`,
        updatedAt: new Date(),
      })
      .where(eq(calendarEvents.id, existingEvent.id));
  } else {
    // Create new event
    await createCalendarEvent({
      title: eventTitle,
      description: `Surat keluar dalam proses. Status: ${status}`,
      eventType: "surat_deadline",
      entitasType: "surat_keluar",
      entitasId: suratId,
      startDate: new Date(),
      allDay: true,
      userId,
      isPublic: false,
    });
  }
}

// ─── UJIAN SYNC ───────────────────────────────────────────────────────────────

export async function syncUjianEvent(
  ujianId: string,
  mataPelajaran: string[],
  namaKelas: string,
  tanggalUjian: string,
  jamMulai: string,
  jamSelesai: string,
  catatan: string | null,
  pengawasNama: string[],
  adminJagaNama: string[],
): Promise<void> {
  const title = `Ujian: ${mataPelajaran.join(", ")} - ${namaKelas}`;
  const startDate = parseIsoDateTimeInJakarta(tanggalUjian, jamMulai);
  const endDate = parseIsoDateTimeInJakarta(tanggalUjian, jamSelesai);
  const descParts: string[] = [];
  if (catatan) descParts.push(catatan);
  if (pengawasNama.length > 0) descParts.push(`Pengawas: ${pengawasNama.join(", ")}`);
  if (adminJagaNama.length > 0) descParts.push(`Admin jaga: ${adminJagaNama.join(", ")}`);

  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.entitasType, "ujian"),
        eq(calendarEvents.entitasId, ujianId),
        eq(calendarEvents.eventType, "ujian"),
      ),
    );

  if (existing[0]) {
    await db
      .update(calendarEvents)
      .set({ title, startDate, endDate, description: descParts.join(" | ") || undefined, updatedAt: new Date() })
      .where(eq(calendarEvents.id, existing[0].id));
  } else {
    await createCalendarEvent({
      title,
      description: descParts.join(" | ") || undefined,
      eventType: "ujian" as typeof calendarEvents.$inferInsert.eventType,
      entitasType: "ujian",
      entitasId: ujianId,
      startDate,
      endDate,
      allDay: false,
      isPublic: true,
    });
  }
}

export async function removeUjianEvent(ujianId: string): Promise<void> {
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.entitasType, "ujian"), eq(calendarEvents.entitasId, ujianId)),
    );
}

export async function syncPenugasanPengawasEvent(
  penugasanId: string,
  pengawasNama: string,
  mataPelajaran: string[],
  namaKelas: string,
  tanggalUjian: string,
  jamMulai: string,
  jamSelesai: string,
): Promise<void> {
  const title = `Pengawas: ${pengawasNama} — ${mataPelajaran.join(", ")}`;
  const startDate = parseIsoDateTimeInJakarta(tanggalUjian, jamMulai);
  const endDate = parseIsoDateTimeInJakarta(tanggalUjian, jamSelesai);

  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.entitasType, "ujian_pengawas"),
        eq(calendarEvents.entitasId, penugasanId),
      ),
    );

  if (existing[0]) {
    await db
      .update(calendarEvents)
      .set({ title, startDate, endDate, updatedAt: new Date() })
      .where(eq(calendarEvents.id, existing[0].id));
  } else {
    await createCalendarEvent({
      title,
      description: `Kelas: ${namaKelas}`,
      eventType: "ujian_pengawas" as typeof calendarEvents.$inferInsert.eventType,
      entitasType: "ujian_pengawas",
      entitasId: penugasanId,
      startDate,
      endDate,
      allDay: false,
      isPublic: true,
    });
  }
}

export async function removePenugasanPengawasEvent(penugasanId: string): Promise<void> {
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.entitasType, "ujian_pengawas"), eq(calendarEvents.entitasId, penugasanId)),
    );
}

export async function syncAdminJagaEvent(
  adminJagaId: string,
  pengawasNama: string,
  mataPelajaran: string[],
  namaKelas: string,
  tanggalUjian: string,
  jamMulai: string,
  jamSelesai: string,
): Promise<void> {
  const title = `Admin Jaga: ${pengawasNama} — ${mataPelajaran.join(", ")}`;
  const startDate = parseIsoDateTimeInJakarta(tanggalUjian, jamMulai);
  const endDate = parseIsoDateTimeInJakarta(tanggalUjian, jamSelesai);

  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.entitasType, "admin_jaga"),
        eq(calendarEvents.entitasId, adminJagaId),
      ),
    );

  if (existing[0]) {
    await db
      .update(calendarEvents)
      .set({ title, startDate, endDate, updatedAt: new Date() })
      .where(eq(calendarEvents.id, existing[0].id));
  } else {
    await createCalendarEvent({
      title,
      description: `Kelas: ${namaKelas}`,
      eventType: "admin_jaga" as typeof calendarEvents.$inferInsert.eventType,
      entitasType: "admin_jaga",
      entitasId: adminJagaId,
      startDate,
      endDate,
      allDay: false,
      isPublic: true,
    });
  }
}

export async function removeAdminJagaEvent(adminJagaId: string): Promise<void> {
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.entitasType, "admin_jaga"), eq(calendarEvents.entitasId, adminJagaId)),
    );
}

export async function syncJadwalAdminJagaEvent(
  jadwalId: string,
  pengawasNama: string,
  kelasNama: string,
  tanggal: string,
  jamMulai: string | null,
  jamSelesai: string | null,
  materi: string,
): Promise<void> {
  const title = `Admin Jaga: ${pengawasNama} — ${materi}`;
  const startDate = parseIsoDateTimeInJakarta(tanggal, jamMulai ?? "17:15");
  const endDate = parseIsoDateTimeInJakarta(tanggal, jamSelesai ?? "21:30");

  const existing = await db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.entitasType, "jadwal_admin_jaga"),
        eq(calendarEvents.entitasId, jadwalId),
      ),
    );

  if (existing[0]) {
    await db
      .update(calendarEvents)
      .set({ title, startDate, endDate, updatedAt: new Date() })
      .where(eq(calendarEvents.id, existing[0].id));
  } else {
    await createCalendarEvent({
      title,
      description: `Kelas: ${kelasNama}`,
      eventType: "admin_jaga" as typeof calendarEvents.$inferInsert.eventType,
      entitasType: "jadwal_admin_jaga",
      entitasId: jadwalId,
      startDate,
      endDate,
      allDay: false,
      isPublic: true,
    });
  }
}

export async function removeJadwalAdminJagaEvent(jadwalId: string): Promise<void> {
  await db
    .delete(calendarEvents)
    .where(
      and(eq(calendarEvents.entitasType, "jadwal_admin_jaga"), eq(calendarEvents.entitasId, jadwalId)),
    );
}

// ─── BACKFILL ─────────────────────────────────────────────────────────────────
// Sinkronisasi data ujian/pengawas/admin yang sudah ada ke calendar

export async function backfillCalendarEvents(): Promise<void> {
  // Hapus semua event hasil sync terdahulu (idempotent — delete all, recreate all)
  await db.delete(calendarEvents).where(
    inArray(calendarEvents.entitasType, ["ujian", "ujian_pengawas", "admin_jaga", "jadwal_admin_jaga"]),
  );

  // Backfill jadwalUjian + penugasanPengawas + adminJaga (linked to exam)
  const allUjian = await db
    .select({
      id: jadwalUjian.id,
      mataPelajaran: jadwalUjian.mataPelajaran,
      tanggalUjian: jadwalUjian.tanggalUjian,
      jamMulai: jadwalUjian.jamMulai,
      jamSelesai: jadwalUjian.jamSelesai,
      catatan: jadwalUjian.catatan,
      kelasId: jadwalUjian.kelasId,
    })
    .from(jadwalUjian);

  const kelasIds = [...new Set(allUjian.map((u) => u.kelasId))];
  const kelasMapArr = kelasIds.length > 0
    ? await db.select({ id: kelasUjian.id, namaKelas: kelasUjian.namaKelas }).from(kelasUjian).where(inArray(kelasUjian.id, kelasIds))
    : [];
  const kelasMap = new Map(kelasMapArr.map((k) => [k.id, k.namaKelas]));

  for (const ujian of allUjian) {
    const namaKelas = kelasMap.get(ujian.kelasId) ?? "";

    const penugasans = await db
      .select({ id: penugasanPengawas.id, pengawasId: penugasanPengawas.pengawasId })
      .from(penugasanPengawas)
      .where(eq(penugasanPengawas.ujianId, ujian.id));

    const pengawasIds = penugasans.map((p) => p.pengawasId);
    const pengawasList = pengawasIds.length > 0
      ? await db.select({ id: pengawas.id, nama: pengawas.nama }).from(pengawas).where(inArray(pengawas.id, pengawasIds))
      : [];
    const pengawasMap = new Map(pengawasList.map((p) => [p.id, p.nama]));
    const pengawasNama = pengawasList.map((p) => p.nama);

    const adminJagas = await db
      .select({ id: adminJaga.id, pengawasId: adminJaga.pengawasId })
      .from(adminJaga)
      .where(eq(adminJaga.ujianId, ujian.id));

    const adminJagaIds = adminJagas.map((a) => a.pengawasId);
    const adminJagaList = adminJagaIds.length > 0
      ? await db.select({ id: pengawas.id, nama: pengawas.nama }).from(pengawas).where(inArray(pengawas.id, adminJagaIds))
      : [];
    const adminJagaMap = new Map(adminJagaList.map((a) => [a.id, a.nama]));
    const adminJagaNama = adminJagaList.map((a) => a.nama);

    await syncUjianEvent(ujian.id, ujian.mataPelajaran, namaKelas, ujian.tanggalUjian, ujian.jamMulai, ujian.jamSelesai, ujian.catatan, pengawasNama, adminJagaNama);

    for (const p of penugasans) {
      await syncPenugasanPengawasEvent(p.id, pengawasMap.get(p.pengawasId) ?? "", ujian.mataPelajaran, namaKelas, ujian.tanggalUjian, ujian.jamMulai, ujian.jamSelesai);
    }

    for (const a of adminJagas) {
      await syncAdminJagaEvent(a.id, adminJagaMap.get(a.pengawasId) ?? "", ujian.mataPelajaran, namaKelas, ujian.tanggalUjian, ujian.jamMulai, ujian.jamSelesai);
    }
  }

  // Backfill jadwalAdminJaga (standalone, not linked to exam)
  const allJadwalAdminJaga = await db
    .select({
      id: jadwalAdminJagaTable.id,
      kelasId: jadwalAdminJagaTable.kelasId,
      tanggal: jadwalAdminJagaTable.tanggal,
      jamMulai: jadwalAdminJagaTable.jamMulai,
      jamSelesai: jadwalAdminJagaTable.jamSelesai,
      materi: jadwalAdminJagaTable.materi,
      pengawasId: jadwalAdminJagaTable.pengawasId,
    })
    .from(jadwalAdminJagaTable);

  const jajKelasIds = [...new Set(allJadwalAdminJaga.map((j) => j.kelasId))];
  const jajKelasMapArr = jajKelasIds.length > 0
    ? await db.select({ id: kelasUjian.id, namaKelas: kelasUjian.namaKelas }).from(kelasUjian).where(inArray(kelasUjian.id, jajKelasIds))
    : [];
  const jajKelasMap = new Map(jajKelasMapArr.map((k) => [k.id, k.namaKelas]));

  for (const j of allJadwalAdminJaga) {
    const [jajPengawas] = await db
      .select({ nama: pengawas.nama })
      .from(pengawas)
      .where(eq(pengawas.id, j.pengawasId));
    const jajNamaKelas = jajKelasMap.get(j.kelasId) ?? "";

    if (jajPengawas) {
      await syncJadwalAdminJagaEvent(j.id, jajPengawas.nama, jajNamaKelas, j.tanggal, j.jamMulai, j.jamSelesai, j.materi);
    }
  }
}

// Get upcoming deadlines
export async function getUpcomingDeadlines(
  userId: string,
  daysAhead: number = 7
): Promise<CalendarEvent[]> {
  const now = new Date();
  const future = new Date();
  future.setDate(now.getDate() + daysAhead);

  return db
    .select()
    .from(calendarEvents)
    .where(
      and(
        eq(calendarEvents.userId, userId),
        gte(calendarEvents.startDate, now),
        lte(calendarEvents.startDate, future),
        eq(calendarEvents.eventType, "disposisi_deadline")
      )
    )
    .orderBy(calendarEvents.startDate);
}
