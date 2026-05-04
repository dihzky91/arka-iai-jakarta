"use server";

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { absensiKaryawan, users } from "@/server/db/schema";
import { requirePermission } from "@/server/actions/auth";
import { writeAuditLog } from "@/server/lib/audit";
import { getAttendanceRecords } from "@/lib/dingtalk/attendance";
import { listDingtalkUsers } from "@/lib/dingtalk/contact";

export async function syncAbsensiDariDingTalk(
  tanggalMulai: string,
  tanggalSelesai: string,
) {
  const session = await requirePermission("absensi", "sync");

  // Pull semua user DingTalk — tidak perlu akun ARKA dulu
  const dtkUsers = await listDingtalkUsers();

  if (dtkUsers.length === 0) {
    return { ok: false as const, error: "Tidak ada user ditemukan di DingTalk." };
  }

  // Build map: dingtalkUserId → ARKA userId (untuk yang sudah ter-link)
  const arkaRows = await db
    .select({ id: users.id, dingtalkUserId: users.dingtalkUserId, namaLengkap: users.namaLengkap })
    .from(users)
    .where(isNotNull(users.dingtalkUserId));

  const arkaMap = new Map(arkaRows.map((r) => [r.dingtalkUserId!, { id: r.id, nama: r.namaLengkap }]));

  // Map dingtalkUserId → nama dari DingTalk (untuk display)
  const dtkNamaMap = new Map(dtkUsers.map((u) => [u.userId, u.name]));

  const dtkUserIds = dtkUsers.map((u) => u.userId);

  let berhasil = 0;
  let duplikat = 0;
  let unlinked = 0; // record masuk tapi tanpa akun ARKA

  try {
    const records = await getAttendanceRecords(dtkUserIds, tanggalMulai, tanggalSelesai);

    for (const record of records) {
      const arkaUser = arkaMap.get(record.userId);
      const dingtalkNama = dtkNamaMap.get(record.userId) ?? record.userId;

      try {
        if (arkaUser) {
          // User punya akun ARKA — simpan dengan userId
          await db
            .insert(absensiKaryawan)
            .values({
              id: crypto.randomUUID(),
              userId: arkaUser.id,
              dingtalkUserId: record.userId,
              dingtalkNama,
              tanggal: record.tanggal,
              jamMasuk: record.jamMasuk ? new Date(record.jamMasuk) : null,
              jamPulang: record.jamPulang ? new Date(record.jamPulang) : null,
              status: record.status,
              keterlambatanMenit: record.keterlambatanMenit,
              sumber: "dingtalk",
              dingtalkRecordId: record.dingtalkRecordId,
            })
            .onConflictDoNothing();
        } else {
          // User belum punya akun ARKA — simpan sebagai DingTalk-only
          await db
            .insert(absensiKaryawan)
            .values({
              id: crypto.randomUUID(),
              userId: null,
              dingtalkUserId: record.userId,
              dingtalkNama,
              tanggal: record.tanggal,
              jamMasuk: record.jamMasuk ? new Date(record.jamMasuk) : null,
              jamPulang: record.jamPulang ? new Date(record.jamPulang) : null,
              status: record.status,
              keterlambatanMenit: record.keterlambatanMenit,
              sumber: "dingtalk",
              dingtalkRecordId: record.dingtalkRecordId,
            })
            .onConflictDoNothing();
          unlinked++;
        }
        berhasil++;
      } catch {
        duplikat++;
      }
    }

    await writeAuditLog({
      userId: session.user.id,
      aksi: "DINGTALK_SYNC_ATTENDANCE",
      entitasType: "absensi_karyawan",
      entitasId: `${tanggalMulai}_${tanggalSelesai}`,
      detail: { berhasil, duplikat, unlinked, totalDtk: dtkUsers.length, tanggalMulai, tanggalSelesai },
    });

    return {
      ok: true as const,
      data: { berhasil, duplikat, unlinked, totalUser: dtkUsers.length, totalRecord: records.length },
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
    .select({ id: users.id, dingtalkUserId: users.dingtalkUserId, namaLengkap: users.namaLengkap })
    .from(users)
    .where(and(eq(users.id, userId), isNotNull(users.dingtalkUserId)))
    .limit(1);

  if (!user?.dingtalkUserId) {
    return { ok: false as const, error: "User tidak memiliki DingTalk User ID." };
  }

  const records = await getAttendanceRecords([user.dingtalkUserId], tanggalMulai, tanggalSelesai);

  let berhasil = 0;

  for (const record of records) {
    await db
      .insert(absensiKaryawan)
      .values({
        id: crypto.randomUUID(),
        userId: user.id,
        dingtalkUserId: record.userId,
        dingtalkNama: user.namaLengkap,
        tanggal: record.tanggal,
        jamMasuk: record.jamMasuk ? new Date(record.jamMasuk) : null,
        jamPulang: record.jamPulang ? new Date(record.jamPulang) : null,
        status: record.status,
        keterlambatanMenit: record.keterlambatanMenit,
        sumber: "dingtalk",
        dingtalkRecordId: record.dingtalkRecordId,
      })
      .onConflictDoNothing();

    berhasil++;
  }

  return { ok: true as const, data: { berhasil } };
}
