import { z } from "zod";

export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const uuidIdSchema = z.object({ id: z.string().uuid() });

export const uploadFileSchema = z.object({
  fileName: z.string().min(1, "Nama file wajib ada."),
  contentType: z.string().min(1).optional(),
  dataUrl: z.string().min(1, "Data file wajib ada."),
});

export type UploadFileInput = z.infer<typeof uploadFileSchema>;
