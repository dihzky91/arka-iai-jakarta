import { z } from "zod";

// ─── BLOCK SCHEMAS ────────────────────────────────────────────────────────────

const baseBlock = { id: z.string() };

const paragraphBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("paragraph"),
  content: z.string().min(1),
  align: z.enum(["left", "center", "right"]).optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
});

const headingBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("heading"),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  content: z.string().min(1),
  align: z.enum(["left", "center", "right"]).optional(),
});

const buttonBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("button"),
  label: z.string().min(1).max(100),
  url: z.string().min(1),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  fullWidth: z.boolean().optional(),
});

const dividerBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("divider"),
  style: z.enum(["solid", "dashed", "dotted"]).optional(),
  color: z.string().optional(),
});

const spacerBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("spacer"),
  height: z.number().min(8).max(64),
});

const imageBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("image"),
  src: z.string().min(1),
  alt: z.string(),
  width: z.number().max(600).optional(),
  align: z.enum(["left", "center", "right"]).optional(),
  linkUrl: z.string().optional(),
});

const alertBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("alert"),
  variant: z.enum(["info", "warning", "success", "error"]),
  content: z.string().min(1),
  icon: z.boolean().optional(),
});

const tableBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("table"),
  headers: z.array(z.string()),
  rows: z.array(z.array(z.string())),
  striped: z.boolean().optional(),
});

const listBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("list"),
  items: z.array(z.string().min(1)).min(1),
  ordered: z.boolean().optional(),
});

const signatureBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("signature"),
});

// ColumnsBlock uses a lazy reference for nested blocks
const columnsBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("columns"),
  columns: z
    .array(
      z.object({
        width: z.enum(["1/2", "1/3", "2/3"]),
        blocks: z.array(z.any()), // nested blocks — validated at runtime
      }),
    )
    .min(2)
    .max(3),
});

export const templateBlockSchema = z.discriminatedUnion("type", [
  paragraphBlockSchema,
  headingBlockSchema,
  buttonBlockSchema,
  dividerBlockSchema,
  spacerBlockSchema,
  imageBlockSchema,
  alertBlockSchema,
  tableBlockSchema,
  listBlockSchema,
  columnsBlockSchema,
  signatureBlockSchema,
]);

// ─── TEMPLATE SCHEMAS ─────────────────────────────────────────────────────────

export const emailTemplateCategorySchema = z.enum([
  "persuratan",
  "akademik",
  "keuangan",
  "auth",
  "sistem",
  "ppl",
  "custom",
]);

export const createTemplateSchema = z.object({
  templateKey: z
    .string()
    .min(3)
    .max(100)
    .regex(/^[a-z][a-z0-9_]*$/, "Hanya huruf kecil, angka, dan underscore"),
  templateName: z.string().min(3).max(300),
  description: z.string().max(1000).optional(),
  category: emailTemplateCategorySchema,
  subject: z.string().min(3).max(500),
  bodyBlocks: z.array(templateBlockSchema).min(1),
  layoutId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateTemplateSchema = createTemplateSchema.partial().extend({
  changeNote: z.string().max(500).optional(),
});

export const createLayoutSchema = z.object({
  name: z.string().min(3).max(200),
  description: z.string().max(500).optional(),
  headerHtml: z.string().max(10000).optional(),
  footerHtml: z.string().max(10000).optional(),
  cssInline: z.string().max(20000).optional(),
  isDefault: z.boolean().optional(),
});

export const testSendSchema = z.object({
  templateId: z.string(),
  recipientEmail: z.string().email(),
  variables: z.record(z.string()).optional(),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type CreateLayoutInput = z.infer<typeof createLayoutSchema>;
export type TestSendInput = z.infer<typeof testSendSchema>;
