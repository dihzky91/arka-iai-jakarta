// Barrel re-export — server action boundaries are in each domain file.
// All consumers can continue importing from "@/server/actions/projects" unchanged.
export * from "./project-core";
export * from "./project-content";
export * from "./project-tasks";
export * from "./project-resources";
export * from "./project-integrations";
export * from "./project-global";

// Re-export shared types directly so they are resolvable without going
// through a "use server" boundary (safe for client component type imports).
export type { ProjectLabelRow, ProjectListRow } from "./_project-shared";
