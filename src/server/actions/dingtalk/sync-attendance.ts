"use server";

import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { absensiKaryawan, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import {
  getAttendanceRecordsWithDiagnostics,
  type NormalizedAttendance,
} from "@/lib/dingtalk/attendance";
import { listDingtalkUsers } from "@/lib/dingtalk/contact";

type AbsensiUpsertInput = {
  arkaUser: { id: string; nama: string | null } | undefined;
  dingtalkNama: string;
  record: NormalizedAttendance;
};

async function upsertAbsensiDingtalk({
  arkaUser,
  dingtalkNama,
  record,
}: AbsensiUpsertInput): Promise<"inserted" | "updated"> {
  const existingWhere = arkaUser
    ? and(
        eq(absensiKaryawan.userId, arkaUser.id),
        eq(absensiKaryawan.tanggal, record.tanggal),
        eq(absensiKaryawan.sumber, "dingtalk"),
      )
    : and(
        isNull(absensiKaryawan.userId),
        eq(absensiKaryawan.dingtalkUserId, record.userId),
        eq(absensiKaryawan.tanggal, record.tanggal),
        eq(absensiKaryawan.sumber, "dingtalk"),
      );

  const values = {
    userId: arkaUser?.id ?? null,
    dingtalkUserId: record.userId,
    dingtalkNama,
    tanggal: record.tanggal,
    jamMasuk: record.jamMasuk ? new Date(record.jamMasuk) : null,
    jamPulang: record.jamPulang ? new Date(record.jamPulang) : null,
    status: record.status,
    keterlambatanMenit: record.keterlambatanMenit,
    sumber: "dingtalk" as const,
    dingtalkRecordId: record.dingtalkRecordId,
    catatan: record.catatan,
    updatedAt: new Date(),
  };

  const [existing] = await db
    .select({ id: absensiKaryawan.id })
    .from(absensiKaryawan)
    .where(existingWhere)
    .limit(1);

  if (existing) {
    await db
      .update(absensiKaryawan)
      .set(values)
      .where(eq(absensiKaryawan.id, existing.id));
    return "updated";
  }

  await db.insert(absensiKaryawan).values({
    id: crypto.randomUUID(),
    ...values,
  });
  return "inserted";
}

export async function syncAbsensiDariDingTalk(
  tanggalMulai: string,
  tanggalSelesai: string,
) {
  const session = await requirePermission("absensi", "sync");

  const dtkUsers = await listDingtalkUsers();

  if (dtkUsers.length === 0) {
    return { ok: false as const, error: "Tidak ada user ditemukan di DingTalk." };
  }

  const arkaRows = await db
    .select({
      id: users.id,
      dingtalkUserId: users.dingtalkUserId,
      namaLengkap: users.namaLengkap,
    })
    .from(users)
    .where(isNotNull(users.dingtalkUserId));

  const arkaMap = new Map(
    arkaRows.map((r) => [
      r.dingtalkUserId!,
      { id: r.id, nama: r.namaLengkap },
    ]),
  );
  const dtkNamaMap = new Map(dtkUsers.map((u) => [u.userId, u.name]));
  const dtkUserIds = dtkUsers.map((u) => u.userId);

  let berhasil = 0;
  let gagal = 0;
  let diperbarui = 0;
  let unlinked = 0;

  try {
    const { records, diagnostics } = await getAttendanceRecordsWithDiagnostics(
      dtkUserIds,
      tanggalMulai,
      tanggalSelesai,
    );

    for (const record of records) {
      const arkaUser = arkaMap.get(record.userId);
      const dingtalkNama = dtkNamaMap.get(record.userId) ?? record.userId;

      try {
        const result = await upsertAbsensiDingtalk({
          arkaUser,
          dingtalkNama,
          record,
        });
        if (result === "updated") diperbarui++;
        if (!arkaUser) unlinked++;
        berhasil++;
      } catch {
        gagal++;
      }
    }

    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_SYNC_ATTENDANCE",
      entitasType: "absensi_karyawan",
      entitasId: `${tanggalMulai}_${tanggalSelesai}`,
      detail: {
        berhasil,
        gagal,
        diperbarui,
        unlinked,
        totalDtk: dtkUsers.length,
        tanggalMulai,
        tanggalSelesai,
        diagnostics,
      },
    });

    return {
      ok: true as const,
      data: {
        berhasil,
        gagal,
        diperbarui,
        unlinked,
        totalUser: dtkUsers.length,
        totalRecord: records.length,
        diagnostics,
      },
    };
  } catch (e) {
    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_SYNC_ATTENDANCE_FAILED",
      entitasType: "absensi_karyawan",
      entitasId: `${tanggalMulai}_${tanggalSelesai}`,
      detail: { error: e instanceof Error ? e.message : String(e) },
    });

    return {
      ok: false as const,
      error: e instanceof Error ? e.message : "Sync absensi gagal.",
    };
  }
}

export async function syncAbsensiPerUser(
  userId: string,
  tanggalMulai: string,
  tanggalSelesai: string,
) {
  await requirePermission("absensi", "sync");

  const [user] = await db
    .select({
      id: users.id,
      dingtalkUserId: users.dingtalkUserId,
      namaLengkap: users.namaLengkap,
    })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.dingtalkUserId)))
    .limit(1);

  if (!user?.dingtalkUserId) {
    return { ok: false as const, error: "User tidak memiliki DingTalk User ID." };
  }

  const { records } = await getAttendanceRecordsWithDiagnostics(
    [user.dingtalkUserId],
    tanggalMulai,
    tanggalSelesai,
  );

  let berhasil = 0;

  for (const record of records) {
    await upsertAbsensiDingtalk({
      arkaUser: { id: user.id, nama: user.namaLengkap },
      dingtalkNama: user.namaLengkap,
      record,
    });
    berhasil++;
  }

  return { ok: true as const, data: { berhasil } };
}
