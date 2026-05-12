export const PROJECT_TYPES = [
  "Workshop",
  "Seminar",
  "Lokakarya",
  "Pelatihan",
  "Lainnya",
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

export type ProjectType = (typeof PROJECT_TYPES)[number];
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectMemberRole = (typeof PROJECT_MEMBER_ROLES)[number];
export type ProjectTaskStatus = (typeof PROJECT_TASK_STATUSES)[number];
