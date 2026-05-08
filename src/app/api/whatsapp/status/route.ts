import { NextResponse } from "next/server";
import { isFonnteConfigured } from "@/lib/whatsapp/sender";

export async function GET() {
  return NextResponse.json({
    status: isFonnteConfigured() ? "configured" : "unconfigured",
  });
}
