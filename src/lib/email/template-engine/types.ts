// ─── TEMPLATE BLOCK TYPES ─────────────────────────────────────────────────────

export type TemplateBlock =
  | ParagraphBlock
  | HeadingBlock
  | ButtonBlock
  | DividerBlock
  | SpacerBlock
  | ImageBlock
  | AlertBlock
  | TableBlock
  | ListBlock
  | ColumnsBlock
  | SignatureBlock;

export interface ParagraphBlock {
  id: string;
  type: "paragraph";
  content: string; // supports {{variable}} inline
  align?: "left" | "center" | "right";
  bold?: boolean;
  italic?: boolean;
}

export interface HeadingBlock {
  id: string;
  type: "heading";
  level: 1 | 2 | 3;
  content: string;
  align?: "left" | "center" | "right";
}

export interface ButtonBlock {
  id: string;
  type: "button";
  label: string;
  url: string; // supports {{variable}}
  color?: string; // hex, default brand color
  align?: "left" | "center" | "right";
  fullWidth?: boolean;
}

export interface DividerBlock {
  id: string;
  type: "divider";
  style?: "solid" | "dashed" | "dotted";
  color?: string;
}

export interface SpacerBlock {
  id: string;
  type: "spacer";
  height: number; // px, 8-64
}

export interface ImageBlock {
  id: string;
  type: "image";
  src: string; // URL or {{variable}}
  alt: string;
  width?: number; // px, max 600
  align?: "left" | "center" | "right";
  linkUrl?: string;
}

export interface AlertBlock {
  id: string;
  type: "alert";
  variant: "info" | "warning" | "success" | "error";
  content: string;
  icon?: boolean; // show icon prefix
}

export interface TableBlock {
  id: string;
  type: "table";
  headers: string[];
  rows: string[][]; // supports {{variable}} per cell
  striped?: boolean;
}

export interface ListBlock {
  id: string;
  type: "list";
  items: string[]; // supports {{variable}} per item
  ordered?: boolean;
}

export interface ColumnsBlock {
  id: string;
  type: "columns";
  columns: {
    width: "1/2" | "1/3" | "2/3";
    blocks: TemplateBlock[];
  }[];
}

export interface SignatureBlock {
  id: string;
  type: "signature";
  // Auto-populated from system settings (app name, logo)
}

// ─── VARIABLE TYPES ───────────────────────────────────────────────────────────

export type VariableCategory =
  | "global"
  | "persuratan"
  | "disposisi"
  | "akademik"
  | "keuangan"
  | "auth"
  | "sertifikat"
  | "ppl"
  | "sistem";

export interface VariableDefinition {
  key: string; // e.g. "surat.perihal"
  label: string; // e.g. "Perihal surat"
  category: VariableCategory;
  sampleValue: string; // e.g. "Undangan Rapat Koordinasi"
  description?: string;
}

export interface TemplateVariable {
  [key: string]: string; // runtime values passed to renderer
}

// ─── SEND TEMPLATED EMAIL OPTIONS ─────────────────────────────────────────────

export interface SendTemplatedEmailOptions {
  to: string;
  toName?: string;
  variables: Record<string, string>;
  attachments?: {
    contentType: string;
    filename: string;
    base64Content: string;
  }[];
  overrideHtml?: string;
}

export interface SendTemplatedEmailResult {
  success: boolean;
  logId?: string;
  error?: string;
}
