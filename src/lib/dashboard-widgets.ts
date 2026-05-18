import type { Capability } from "@/lib/rbac/capabilities";

export interface DashboardWidgetDef {
  key: string;
  label: string;
  category: "project" | "persuratan" | "kepegawaian" | "sertifikat" | "keuangan" | "general";
  requiredCapability?: Capability;
  /** Jika true, widget ini selalu tampil dan tidak bisa di-hide */
  alwaysVisible?: boolean;
}

/**
 * Registry semua widget yang tersedia di dashboard.
 * Urutan di sini = default sort order.
 */
export const DASHBOARD_WIDGETS: DashboardWidgetDef[] = [
  // Project-centric widgets
  { key: "quick_stats", label: "Statistik Cepat", category: "project", alwaysVisible: true },
  { key: "projects_overview", label: "Projects Overview", category: "project", requiredCapability: "projects:view" },
  { key: "tasks_overview", label: "Semua Task", category: "project", requiredCapability: "projects:view" },
  { key: "my_tasks", label: "Task Saya", category: "project", requiredCapability: "projects:view" },
  { key: "upcoming_events", label: "Event Mendatang", category: "general", requiredCapability: "calendar:view" },

  // Admin/overview widgets
  { key: "metric_persuratan", label: "Surat Masuk", category: "persuratan", requiredCapability: "surat_masuk:view" },
  { key: "metric_kepegawaian", label: "Kepegawaian", category: "kepegawaian", requiredCapability: "absensi:view" },
  { key: "metric_sertifikat", label: "Sertifikat", category: "sertifikat", requiredCapability: "sertifikat:view" },
  { key: "metric_keuangan", label: "Keuangan", category: "keuangan", requiredCapability: "keuangan:view" },
  { key: "antrean_persuratan", label: "Antrean Persuratan", category: "persuratan", requiredCapability: "surat_masuk:view" },

  // General widgets
  { key: "profile_card", label: "Profil Saya", category: "general" },
  { key: "quick_actions", label: "Aksi Cepat", category: "general" },
];

export type WidgetKey = (typeof DASHBOARD_WIDGETS)[number]["key"];

/**
 * Default widget keys untuk project-centric view (staff/pejabat).
 */
export const DEFAULT_PROJECT_CENTRIC_WIDGETS: string[] = [
  "quick_stats",
  "projects_overview",
  "tasks_overview",
  "my_tasks",
  "upcoming_events",
  "profile_card",
  "quick_actions",
];

/**
 * Default widget keys untuk admin/superadmin view.
 */
export const DEFAULT_ADMIN_WIDGETS: string[] = [
  "metric_persuratan",
  "metric_kepegawaian",
  "metric_sertifikat",
  "metric_keuangan",
  "antrean_persuratan",
  "profile_card",
  "quick_actions",
];

export interface UserWidgetPreference {
  widgetKey: string;
  visible: boolean;
  sortOrder: number;
}

/**
 * Resolve widget mana yang tampil berdasarkan:
 * 1. User preference (jika ada)
 * 2. Default berdasarkan role
 *
 * Filter juga berdasarkan capability user.
 */
export function resolveVisibleWidgets(
  preferences: UserWidgetPreference[] | null,
  capabilities: Capability[],
  isSuperAdmin: boolean,
  isProjectCentric: boolean,
): { key: string; visible: boolean; sortOrder: number }[] {
  const capSet = new Set(capabilities);

  // Filter widgets yang user punya akses
  const accessibleWidgets = DASHBOARD_WIDGETS.filter(
    (w) =>
      isSuperAdmin ||
      !w.requiredCapability ||
      capSet.has(w.requiredCapability),
  );

  // Jika user punya preference, pakai itu
  if (preferences && preferences.length > 0) {
    const prefMap = new Map(preferences.map((p) => [p.widgetKey, p]));

    return accessibleWidgets
      .map((w) => {
        const pref = prefMap.get(w.key);
        return {
          key: w.key,
          visible: w.alwaysVisible ? true : (pref?.visible ?? true),
          sortOrder: pref?.sortOrder ?? accessibleWidgets.indexOf(w),
        };
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  // Default berdasarkan role
  const defaultKeys = isProjectCentric
    ? DEFAULT_PROJECT_CENTRIC_WIDGETS
    : DEFAULT_ADMIN_WIDGETS;

  const defaultSet = new Set(defaultKeys);

  return accessibleWidgets
    .map((w, idx) => ({
      key: w.key,
      visible: defaultSet.has(w.key),
      sortOrder: idx,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}
