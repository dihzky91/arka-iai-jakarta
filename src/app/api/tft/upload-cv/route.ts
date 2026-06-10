import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/storage";

export const runtime = "nodejs";

/**
 * Upload CV file for TFT registration.
 * Accepts multipart form data with fields:
 * - file: The PDF file
 * - periodeId: The periode ID for folder organization
 *
 * Returns { ok: true, key, fileName } on success.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const periodeId = formData.get("periodeId") as string | null;

    if (!file) {
      return NextResponse.json({ ok: false, error: "File tidak ditemukan." }, { status: 400 });
    }

    if (!periodeId) {
      return NextResponse.json({ ok: false, error: "periodeId wajib." }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "Hanya file PDF yang diperbolehkan." }, { status: 400 });
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "Ukuran file maksimal 10 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const storage = getStorageProvider();

    const result = await storage.upload({
      body: buffer,
      fileName: file.name,
      contentType: file.type,
      folder: `tft/${periodeId}/cv`,
    });

    return NextResponse.json({
      ok: true,
      key: result.key,
      fileName: file.name,
    });
  } catch (error) {
    console.error("[TFT Upload CV]", error);
    return NextResponse.json({ ok: false, error: "Gagal mengupload file." }, { status: 500 });
  }
}
