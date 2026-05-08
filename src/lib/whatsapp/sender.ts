import { env } from "@/lib/env";

export type SendResult =
  | { ok: true; messageId: string }
  | { ok: false; error: string };

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("0") ? "62" + digits.slice(1) : digits;
}

export async function sendWhatsAppMessage(
  phone: string,
  message: string,
): Promise<SendResult> {
  if (!env.FONNTE_TOKEN) {
    return { ok: false, error: "FONNTE_TOKEN belum dikonfigurasi di environment." };
  }

  const target = normalizePhone(phone);

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: { Authorization: env.FONNTE_TOKEN },
      body: new URLSearchParams({ target, message }),
    });

    const data = (await res.json()) as { status: boolean; reason?: string; id?: string };

    if (!data.status) {
      return { ok: false, error: data.reason ?? "Fonnte gagal kirim pesan." };
    }

    return { ok: true, messageId: String(data.id ?? "") };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Network error ke Fonnte API.";
    return { ok: false, error: msg };
  }
}

export function isFonnteConfigured(): boolean {
  return Boolean(env.FONNTE_TOKEN);
}
