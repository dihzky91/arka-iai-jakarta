"use server";

import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { userDashboardPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/actions/auth";
import type { UserWidgetPreference } from "@/lib/dashboard-widgets";

/**
 * Get dashboard widget preferences for the current user.
 * Returns null if user has no saved preferences (use defaults).
 */
export async function getUserDashboardPreferences(): Promise<UserWidgetPreference[] | null> {
  const session = await requireSession();

  const rows = await db
    .select({
      widgetKey: userDashboardPreferences.widgetKey,
      visible: userDashboardPreferences.visible,
      sortOrder: userDashboardPreferences.sortOrder,
    })
    .from(userDashboardPreferences)
    .where(eq(userDashboardPreferences.userId, session.user.id))
    .orderBy(userDashboardPreferences.sortOrder);

  if (rows.length === 0) return null;

  return rows;
}

/**
 * Save dashboard widget preferences for the current user.
 * Replaces all existing preferences with the new set.
 */
export async function saveUserDashboardPreferences(
  widgets: { widgetKey: string; visible: boolean; sortOrder: number }[],
): Promise<{ ok: true }> {
  const session = await requireSession();
  const userId = session.user.id;

  // Delete existing preferences and insert new ones in a transaction
  await db.transaction(async (tx) => {
    await tx
      .delete(userDashboardPreferences)
      .where(eq(userDashboardPreferences.userId, userId));

    if (widgets.length > 0) {
      await tx.insert(userDashboardPreferences).values(
        widgets.map((w) => ({
          userId,
          widgetKey: w.widgetKey,
          visible: w.visible,
          sortOrder: w.sortOrder,
        })),
      );
    }
  });

  return { ok: true };
}

/**
 * Reset dashboard preferences to defaults (delete all saved preferences).
 */
export async function resetDashboardPreferences(): Promise<{ ok: true }> {
  const session = await requireSession();

  await db
    .delete(userDashboardPreferences)
    .where(eq(userDashboardPreferences.userId, session.user.id));

  return { ok: true };
}
