export const DASHBOARD_TAGS = {
  persuratan: "dashboard-persuratan",
  kepegawaian: "dashboard-kepegawaian",
  sertifikat: "dashboard-sertifikat",
  keuangan: "dashboard-keuangan",
  ujian: "dashboard-ujian",
  projects: "dashboard-projects",
} as const;

export type DashboardTag = (typeof DASHBOARD_TAGS)[keyof typeof DASHBOARD_TAGS];
