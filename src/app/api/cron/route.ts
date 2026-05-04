import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { disposisi, users, notificationPreferences } from "@/server/db/schema";
import { and, eq, lt, gte, isNull } from "drizzle-orm";
import { notifyDisposisiDeadline, pruneOldNotifications } from "@/server/actions/notifications";

async function processDeadlineNotifications() {
  const batchResult: string[] = [];

  const prefs = await db
    .select({
      userId: notificationPreferences.userId,
      deadlineReminderDays: notificationPreferences.deadlineReminderDays,
    })
    .from(notificationPreferences);

  const prefMap = new Map(
    prefs.map((p) => [p.userId, p.deadlineReminderDays ?? 1])
  );

  for (const [userId, days] of prefMap) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);
    const now = new Date();

    const nearingDeadlines = await db
      .select({
        id: disposisi.id,
        suratMasukId: disposisi.suratMasukId,
        batasWaktu: disposisi.batasWaktu,
      })
      .from(disposisi)
      .where(
        and(
          eq(disposisi.kepadaUserId, userId),
          eq(disposisi.status, "dibaca"),
          isNull(disposisi.tanggalSelesai),
          gte(disposisi.batasWaktu, now.toISOString().split("T")[0]!),
          lt(disposisi.batasWaktu, cutoff.toISOString().split("T")[0]!)
        )
      );

    if (nearingDeadlines.length > 0) {
      const batasStr = nearingDeadlines[0]!.batasWaktu;
      const batasDate = batasStr ? new Date(batasStr) : new Date();
      await notifyDisposisiDeadline(
        userId,
        "surat terkait",
        batasDate,
        nearingDeadlines[0]!.id
      );
      batchResult.push(`Sent ${nearingDeadlines.length} deadline notifs to ${userId}`);
    }
  }

  return batchResult;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  try {
    const deadlineResults = await processDeadlineNotifications();
    results.push(...deadlineResults);
  } catch (error) {
    console.error("Cron: deadline notification failed", error);
  }

  try {
    const pruned = await pruneOldNotifications(90);
    results.push(`Pruned ${pruned} old notifications`);
  } catch (error) {
    console.error("Cron: pruning failed", error);
  }

  return NextResponse.json({ ok: true, results });
}
