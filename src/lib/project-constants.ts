export const PROJECT_TYPES = [
  "Workshop",
  "Seminar",
  "Lokakarya",
  "Pelatihan",
  "Lainnya",
  "brevet_ab",
  "brevet_c",
  "bfa",
] as const;

export const PROJECT_STATUSES = [
  "not_started",
  "in_progress",
  "on_hold",
  "completed",
  "cancelled",
] as const;

export const PROJECT_MEMBER_ROLES = [
  "owner",
  "manager",
  "member",
  "viewer",
] as const;

export const PROJECT_TASK_STATUSES = ["todo", "in_progress", "done"] as const;

export const TIPE_PELAKSANAAN = ["online", "offline", "hybrid"] as const;

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  Workshop: "Workshop",
  Seminar: "Seminar",
  Lokakarya: "Lokakarya",
  Pelatihan: "Pelatihan",
  Lainnya: "Lainnya",
  brevet_ab: "Brevet AB",
  brevet_c: "Brevet C",
  bfa: "BFA",
};

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
export type TipePelaksanaan = (typeof TIPE_PELAKSANAAN)[number];
