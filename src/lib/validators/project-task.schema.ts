import { z } from "zod";

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.")
  .optional()
  .nullable();

export const projectTaskCreateSchema = z.object({
  title: z.string().trim().min(1, "Judul task wajib diisi.").max(255),
  description: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  dueDate: isoDateSchema,
  milestoneId: z.string().uuid().optional().nullable(),
  relatedEntityType: z.string().max(50).optional().nullable(),
  relatedEntityId: z.string().max(100).optional().nullable(),
});

export const projectTaskUpdateSchema = projectTaskCreateSchema.extend({
  id: z.string().uuid("ID task tidak valid."),
});

export const projectMilestoneCreateSchema = z.object({
  title: z.string().trim().min(1, "Judul milestone wajib diisi.").max(255),
  targetDate: isoDateSchema,
});

export const projectMilestoneUpdateSchema = projectMilestoneCreateSchema.extend({
  id: z.string().uuid("ID milestone tidak valid."),
});

export type ProjectTaskCreateInput = z.infer<typeof projectTaskCreateSchema>;
export type ProjectTaskUpdateInput = z.infer<typeof projectTaskUpdateSchema>;
export type ProjectMilestoneCreateInput = z.infer<typeof projectMilestoneCreateSchema>;
export type ProjectMilestoneUpdateInput = z.infer<typeof projectMilestoneUpdateSchema>;
