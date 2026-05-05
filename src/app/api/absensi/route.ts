import { NextResponse } from "next/server";
import { listAbsensiKaryawan } from "@/server/actions/absensi";

function readPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function errorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : String(error);
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const result = await listAbsensiKaryawan({
      userId: searchParams.get("userId") ?? undefined,
      tanggalMulai: searchParams.get("tanggalMulai") ?? undefined,
      tanggalSelesai: searchParams.get("tanggalSelesai") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      page: readPositiveInt(searchParams.get("page")),
      pageSize: readPositiveInt(searchParams.get("pageSize")),
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Gagal mengambil absensi.",
      },
      { status: errorStatus(error) },
    );
  }
}
