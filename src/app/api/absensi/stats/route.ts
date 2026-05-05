import { NextResponse } from "next/server";
import { getAbsensiStats } from "@/server/actions/absensi";

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await getAbsensiStats({
      userId: searchParams.get("userId") ?? undefined,
      tanggalMulai: searchParams.get("tanggalMulai") ?? undefined,
      tanggalSelesai: searchParams.get("tanggalSelesai") ?? undefined,
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal mengambil statistik absensi.",
      },
      { status: errorStatus(error) },
    );
  }
}
