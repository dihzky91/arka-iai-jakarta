"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import type { ColorThemeId } from "@/lib/color-themes";
import { getColorThemePreset } from "@/lib/color-themes";

interface ThemeApplicatorProps {
  initialTheme: ColorThemeId;
}

export function ThemeApplicator({ initialTheme }: ThemeApplicatorProps) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const synced = useRef(false);

  // Only sync server theme if localStorage doesn't already have a value
  // This prevents overriding the fast localStorage-based theme that next-themes already applied
  useEffect(() => {
    if (!synced.current) {
      synced.current = true;
      const stored = localStorage.getItem("arka-color-theme");
      // If no localStorage value, use server-provided theme
      if (!stored) {
        setTheme(initialTheme);
      }
    }
  }, [initialTheme, setTheme]);

  // Apply/remove dark class based on current theme preset
  useEffect(() => {
    const currentId = (resolvedTheme ?? theme ?? initialTheme) as ColorThemeId;
    const preset = getColorThemePreset(currentId);
    const html = document.documentElement;

    if (preset?.isDark) {
      html.classList.add("dark");
    } else {
      html.classList.remove("dark");
    }
  }, [theme, resolvedTheme, initialTheme]);

  return null;
}
