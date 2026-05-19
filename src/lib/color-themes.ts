export type ColorThemeId =
  | "ocean"
  | "emerald"
  | "violet"
  | "rose"
  | "amber"
  | "teal"
  | "indigo"
  | "solarized"
  | "pine"
  | "kimbie"
  | "midnight"
  | "obsidian";

export interface ColorThemePreset {
  id: ColorThemeId;
  label: string;
  /** Hex color used for the dot preview in the picker UI */
  previewHex: string;
  /** Whether this preset activates dark mode */
  isDark: boolean;
}

export const COLOR_THEME_PRESETS: ColorThemePreset[] = [
  { id: "ocean", label: "Ocean", previewHex: "#3b82f6", isDark: false },
  { id: "emerald", label: "Emerald", previewHex: "#10b981", isDark: false },
  { id: "violet", label: "Violet", previewHex: "#8b5cf6", isDark: false },
  { id: "rose", label: "Rose", previewHex: "#f43f5e", isDark: false },
  { id: "amber", label: "Amber", previewHex: "#f59e0b", isDark: false },
  { id: "teal", label: "Teal", previewHex: "#14b8a6", isDark: false },
  { id: "indigo", label: "Indigo", previewHex: "#1e3a5f", isDark: false },
  { id: "solarized", label: "Solarized", previewHex: "#fdf6e3", isDark: false },
  { id: "pine", label: "Pine", previewHex: "#1a3a3a", isDark: true },
  { id: "kimbie", label: "Kimbie", previewHex: "#221a0f", isDark: true },
  { id: "midnight", label: "Midnight", previewHex: "#6366f1", isDark: true },
  { id: "obsidian", label: "Obsidian", previewHex: "#64748b", isDark: true },
];

export const DEFAULT_COLOR_THEME: ColorThemeId = "ocean";

export const COLOR_THEME_IDS = COLOR_THEME_PRESETS.map((p) => p.id);

export function getColorThemePreset(id: ColorThemeId): ColorThemePreset | undefined {
  return COLOR_THEME_PRESETS.find((p) => p.id === id);
}

export function isValidColorThemeId(value: string): value is ColorThemeId {
  return COLOR_THEME_IDS.includes(value as ColorThemeId);
}
