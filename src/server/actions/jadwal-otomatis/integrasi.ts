"use server";

import { eq, and, asc, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { nanoid } from "nanoid";
import { db } from "@/server/db";
import { writeAuditLog } from "@/server/lib/audit";
import {
  kelasPelatihan,
  kelasUjian,
  jadwalUjian,
  classSessions,
  programs,
  classTypes,
  auditLog,
} from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";

export type PreviewData = {
  namaKelas: string;
  program: string;
  tipe: string;
  mode: string;
  lokasi: string | null;
  jadwalList: Array<{
    tanggalUjian: string;
    mataPelajaran: string[];
    jamMulai: string;
    jamSelesai: string;
  }>;
};

export async function previewKelasUjianFromPelatihan(
  kelasPelatihanId: string,
): Promise<PreviewData> {
  await requirePermission("jadwalPelatihan", "view");

  const kelas = await db
    .select({
      namaKelas: kelasPelatihan.namaKelas,
      mode: kelasPelatihan.mode,
      lokasi: kelasPelatihan.lokasi,
      programName: programs.name,
      classTypeName: classTypes.name,
    })
    .from(kelasPelatihan)
    .leftJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .leftJoin(classTypes, eq(kelasPelatihan.classTypeId, classTypes.id))
    .where(eq(kelasPelatihan.id, kelasPelatihanId))
    .then((r) => r[0] ?? null);

  if (!kelas) {
    throw new Error("Kelas pelatihan tidak ditemukan.");
  }

  const examSessions = await db
    .select({
      tanggalUjian: classSessions.scheduledDate,
      mataPelajaran: classSessions.examSubjects,
      jamMulai: classSessions.timeSlotStart,
      jamSelesai: classSessions.timeSlotEnd,
    })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelasPelatihanId),
        eq(classSessions.isExamDay, true),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));

  return {
    namaKelas: kelas.namaKelas,
    program: kelas.programName ?? "",
    tipe: kelas.classTypeName ?? "",
    mode: kelas.mode,
    lokasi: kelas.lokasi,
    jadwalList: examSessions.map((s) => ({
      tanggalUjian: s.tanggalUjian,
      mataPelajaran: s.mataPelajaran ?? [],
      jamMulai: s.jamMulai,
      jamSelesai: s.jamSelesai,
    })),
  };
}

export async function createKelasUjianFromPelatihan(kelasPelatihanId: string) {
  const session = await requirePermission("jadwalPelatihan", "manage");

  const existing = await db
    .select({ id: kelasUjian.id })
    .from(kelasUjian)
    .where(eq(kelasUjian.kelasPelatihanId, kelasPelatihanId))
    .then((r) => r[0] ?? null);

  if (existing) {
    return {
      ok: false as const,
      error: "Kelas ujian sudah pernah dibuat dari kelas pelatihan ini.",
    };
  }

  const kelas = await db
    .select({
      namaKelas: kelasPelatihan.namaKelas,
      mode: kelasPelatihan.mode,
      lokasi: kelasPelatihan.lokasi,
      programName: programs.name,
      classTypeName: classTypes.name,
    })
    .from(kelasPelatihan)
    .leftJoin(programs, eq(kelasPelatihan.programId, programs.id))
    .leftJoin(classTypes, eq(kelasPelatihan.classTypeId, classTypes.id))
    .where(eq(kelasPelatihan.id, kelasPelatihanId))
    .then((r) => r[0] ?? null);

  if (!kelas) {
    return { ok: false as const, error: "Kelas pelatihan tidak ditemukan." };
  }

  const examSessions = await db
    .select({
      scheduledDate: classSessions.scheduledDate,
      examSubjects: classSessions.examSubjects,
      timeSlotStart: classSessions.timeSlotStart,
      timeSlotEnd: classSessions.timeSlotEnd,
    })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.kelasId, kelasPelatihanId),
        eq(classSessions.isExamDay, true),
      ),
    )
    .orderBy(asc(classSessions.scheduledDate));

  if (examSessions.length === 0) {
    return {
      ok: false as const,
      error: "Tidak ada sesi ujian (isExamDay) pada kelas pelatihan ini.",
    };
  }

  const kelasUjianId = nanoid();
  const jadwalData = examSessions.map((exam) => ({
    id: nanoid(),
    kelasId: kelasUjianId,
    mataPelajaran: exam.examSubjects ?? [],
    tanggalUjian: exam.scheduledDate,
    jamMulai: exam.timeSlotStart,
    jamSelesai: exam.timeSlotEnd,
  }));

  const [createdKelas] = await db
    .insert(kelasUjian)
    .values({
      id: kelasUjianId,
      namaKelas: kelas.namaKelas,
      program: kelas.programName ?? "",
      tipe: kelas.classTypeName ?? "",
      mode: kelas.mode,
      lokasi: kelas.lokasi,
      kelasPelatihanId,
    })
    .returning();

  if (!createdKelas) {
    throw new Error("Gagal membuat kelas ujian.");
  }

  if (jadwalData.length > 0) {
    await db.insert(jadwalUjian).values(jadwalData);
  }

  await writeAuditLog({
    userId: session.user.id,
    aksi: "CREATE_KELAS_UJIAN_FROM_PELATIHAN",
    entitasType: "kelas_ujian",
    entitasId: kelasUjianId,
    detail: {
      kelasPelatihanId,
      namaKelas: kelas.namaKelas,
      jadwalCount: jadwalData.length,
    },
  });

  revalidatePath("/jadwal-otomatis");
  revalidatePath(`/jadwal-otomatis/${kelasPelatihanId}`);
  revalidatePath("/jadwal-ujian/kelas");

  return { ok: true as const, data: { kelasUjianId, jadwalUjianCount: jadwalData.length } };
}

export type KelasUjianLinked = {
  id: string;
  namaKelas: string;
  program: string;
  tipe: string;
  mode: string;
  lokasi: string | null;
  jumlahUjian: number;
  createdAt: Date;
};

export async function getKelasUjianByPelatihan(
  kelasPelatihanId: string,
): Promise<KelasUjianLinked | null> {
  await requirePermission("jadwalPelatihan", "view");

  const row = await db
    .select({
      id: kelasUjian.id,
      namaKelas: kelasUjian.namaKelas,
      program: kelasUjian.program,
      tipe: kelasUjian.tipe,
      mode: kelasUjian.mode,
      lokasi: kelasUjian.lokasi,
      jumlahUjian:
        sql<number>`COALESCE((SELECT COUNT(*) FROM ${jadwalUjian} WHERE ${jadwalUjian.kelasId} = ${kelasUjian.id})::int, 0)`.as(
          "jumlah_ujian",
        ),
      createdAt: kelasUjian.createdAt,
    })
    .from(kelasUjian)
    .where(eq(kelasUjian.kelasPelatihanId, kelasPelatihanId))
    .then((r) => r[0] ?? null);

  return row as KelasUjianLinked | null;
}
