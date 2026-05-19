"use server";

import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { requireSession } from "@/server/actions/auth";
import { isValidColorThemeId, DEFAULT_COLOR_THEME, type ColorThemeId } from "@/lib/color-themes";

export const getUserColorTheme = cache(async (): Promise<ColorThemeId> => {
  const session = await requireSession();
  const [row] = await db
    .select({ colorTheme: users.colorTheme })
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  const theme = row?.colorTheme ?? DEFAULT_COLOR_THEME;
  return isValidColorThemeId(theme) ? theme : DEFAULT_COLOR_THEME;
});

export async function setUserColorTheme(themeId: ColorThemeId): Promise<{ success: boolean }> {
  if (!isValidColorThemeId(themeId)) {
    return { success: false };
  }

  const session = await requireSession();
  await db
    .update(users)
    .set({ colorTheme: themeId, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return { success: true };
}
