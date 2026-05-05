import { NextResponse } from "next/server";
import { syncAbsensiDariDingTalk } from "@/server/actions/dingtalk/sync-attendance";
import { getMonthRangeInJakarta, getTodayIsoInJakarta } from "@/lib/utils";

type SyncRequestBody = {
  tanggalMulai?: string;
  tanggalSelesai?: string;
};

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as SyncRequestBody;
    const { start } = getMonthRangeInJakarta();
    const tanggalMulai = body.tanggalMulai ?? start;
    const tanggalSelesai = body.tanggalSelesai ?? getTodayIsoInJakarta();

    const result = await syncAbsensiDariDingTalk(tanggalMulai, tanggalSelesai);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Sync absensi gagal.",
      },
      { status: errorStatus(error) },
    );
  }
}
