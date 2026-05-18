export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "select"
  | "radio"
  | "checkbox"
  | "scale"
  | "grid";

export interface FormField {
  id: string; // nanoid
  type: FieldType;
  label: string; // max 300 chars
  required: boolean;
  order: number;
  config: ScaleConfig | GridConfig | OptionsConfig | null;
}

export interface ScaleConfig {
  min: number; // 1-10
  max: number; // 1-10, must be > min
  minLabel: string; // max 50 chars
  maxLabel: string; // max 50 chars
}

export interface GridConfig {
  rows: string[]; // 1-30 items, max 300 chars each
  columns: string[]; // 2-10 items, max 100 chars each
}

export interface OptionsConfig {
  options: string[]; // 1-50 items, max 200 chars each
}

export interface KuesionerTemplate {
  id: number;
  nama: string; // max 200 chars
  fields: FormField[]; // 1-50 fields
  createdAt: Date;
  updatedAt: Date;
}
