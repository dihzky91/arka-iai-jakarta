"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { VariableInput } from "./VariableInput";
import type { TemplateBlock } from "@/lib/email/template-engine/types";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  block: TemplateBlock;
  variables: VariableDefinition[];
  onUpdate: (block: TemplateBlock) => void;
}

export function BlockRenderer({ block, variables, onUpdate }: Props) {
  switch (block.type) {
    case "paragraph":
      return <ParagraphEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "heading":
      return <HeadingEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "button":
      return <ButtonEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "divider":
      return <DividerEditor block={block} onUpdate={onUpdate} />;
    case "spacer":
      return <SpacerEditor block={block} onUpdate={onUpdate} />;
    case "image":
      return <ImageEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "alert":
      return <AlertEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "table":
      return <TableEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "list":
      return <ListEditor block={block} variables={variables} onUpdate={onUpdate} />;
    case "columns":
      return <ColumnsEditor block={block} onUpdate={onUpdate} />;
    case "signature":
      return <SignatureEditor />;
    default:
      return <p className="text-xs text-muted-foreground">Block tidak dikenal</p>;
  }
}

// ─── PARAGRAPH ────────────────────────────────────────────────────────────────

function ParagraphEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "paragraph" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <VariableInput
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        variables={variables}
        multiline
        placeholder="Isi paragraf... (ketik {{ untuk variabel)"
      />
      <div className="flex items-center gap-3">
        <AlignSelect
          value={block.align}
          onChange={(v) => onUpdate({ ...block, align: v })}
        />
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={block.bold ?? false}
            onCheckedChange={(v) => onUpdate({ ...block, bold: v })}
            className="scale-75"
          />
          Bold
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={block.italic ?? false}
            onCheckedChange={(v) => onUpdate({ ...block, italic: v })}
            className="scale-75"
          />
          Italic
        </label>
      </div>
    </div>
  );
}

// ─── HEADING ──────────────────────────────────────────────────────────────────

function HeadingEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "heading" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Select
          value={String(block.level)}
          onValueChange={(v) => onUpdate({ ...block, level: Number(v) as 1 | 2 | 3 })}
        >
          <SelectTrigger className="w-16 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">H1</SelectItem>
            <SelectItem value="2">H2</SelectItem>
            <SelectItem value="3">H3</SelectItem>
          </SelectContent>
        </Select>
        <VariableInput
          value={block.content}
          onChange={(v) => onUpdate({ ...block, content: v })}
          variables={variables}
          placeholder="Heading text..."
          className="flex-1"
        />
      </div>
      <AlignSelect value={block.align} onChange={(v) => onUpdate({ ...block, align: v })} />
    </div>
  );
}

// ─── BUTTON ───────────────────────────────────────────────────────────────────

function ButtonEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "button" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <VariableInput
          value={block.label}
          onChange={(v) => onUpdate({ ...block, label: v })}
          variables={variables}
          placeholder="Label tombol"
        />
        <VariableInput
          value={block.url}
          onChange={(v) => onUpdate({ ...block, url: v })}
          variables={variables}
          placeholder="URL ({{variable}} supported)"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">Warna:</Label>
          <input
            type="color"
            value={block.color ?? "#1d4ed8"}
            onChange={(e) => onUpdate({ ...block, color: e.target.value })}
            className="h-6 w-8 cursor-pointer rounded border"
          />
        </div>
        <AlignSelect value={block.align} onChange={(v) => onUpdate({ ...block, align: v })} />
        <label className="flex items-center gap-1.5 text-xs">
          <Switch
            checked={block.fullWidth ?? false}
            onCheckedChange={(v) => onUpdate({ ...block, fullWidth: v })}
            className="scale-75"
          />
          Full width
        </label>
      </div>
    </div>
  );
}

// ─── DIVIDER ──────────────────────────────────────────────────────────────────

function DividerEditor({
  block,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "divider" }>;
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Select
        value={block.style ?? "solid"}
        onValueChange={(v) => onUpdate({ ...block, style: v as "solid" | "dashed" | "dotted" })}
      >
        <SelectTrigger className="w-24 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="solid">Solid</SelectItem>
          <SelectItem value="dashed">Dashed</SelectItem>
          <SelectItem value="dotted">Dotted</SelectItem>
        </SelectContent>
      </Select>
      <input
        type="color"
        value={block.color ?? "#e5e7eb"}
        onChange={(e) => onUpdate({ ...block, color: e.target.value })}
        className="h-6 w-8 cursor-pointer rounded border"
      />
      <hr
        className="flex-1"
        style={{
          borderStyle: block.style ?? "solid",
          borderColor: block.color ?? "#e5e7eb",
        }}
      />
    </div>
  );
}

// ─── SPACER ───────────────────────────────────────────────────────────────────

function SpacerEditor({
  block,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "spacer" }>;
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs shrink-0">Height:</Label>
      <input
        type="range"
        min={8}
        max={64}
        value={block.height}
        onChange={(e) => onUpdate({ ...block, height: Number(e.target.value) })}
        className="flex-1"
      />
      <span className="text-xs text-muted-foreground w-10 text-right">
        {block.height}px
      </span>
    </div>
  );
}

// ─── IMAGE ────────────────────────────────────────────────────────────────────

function ImageEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "image" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <VariableInput
          value={block.src}
          onChange={(v) => onUpdate({ ...block, src: v })}
          variables={variables}
          placeholder="URL gambar"
        />
        <Input
          value={block.alt}
          onChange={(e) => onUpdate({ ...block, alt: e.target.value })}
          placeholder="Alt text"
          className="h-8 text-xs"
        />
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Label className="text-xs">Width:</Label>
          <Input
            type="number"
            value={block.width ?? ""}
            onChange={(e) =>
              onUpdate({ ...block, width: e.target.value ? Number(e.target.value) : undefined })
            }
            placeholder="auto"
            className="w-20 h-7 text-xs"
            max={600}
          />
        </div>
        <AlignSelect value={block.align} onChange={(v) => onUpdate({ ...block, align: v })} />
      </div>
    </div>
  );
}

// ─── ALERT ────────────────────────────────────────────────────────────────────

function AlertEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "alert" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  const variantColors = {
    info: "border-l-blue-500 bg-blue-50",
    warning: "border-l-amber-500 bg-amber-50",
    success: "border-l-green-500 bg-green-50",
    error: "border-l-red-500 bg-red-50",
  };

  return (
    <div className={`space-y-2 rounded border-l-4 p-2 ${variantColors[block.variant]}`}>
      <Select
        value={block.variant}
        onValueChange={(v) =>
          onUpdate({ ...block, variant: v as "info" | "warning" | "success" | "error" })
        }
      >
        <SelectTrigger className="w-28 h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="info">ℹ️ Info</SelectItem>
          <SelectItem value="warning">⚠️ Warning</SelectItem>
          <SelectItem value="success">✅ Success</SelectItem>
          <SelectItem value="error">❌ Error</SelectItem>
        </SelectContent>
      </Select>
      <VariableInput
        value={block.content}
        onChange={(v) => onUpdate({ ...block, content: v })}
        variables={variables}
        multiline
        placeholder="Isi alert..."
      />
    </div>
  );
}

// ─── TABLE ────────────────────────────────────────────────────────────────────

function TableEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "table" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  function addColumn() {
    const newHeaders = [...block.headers, `Kolom ${block.headers.length + 1}`];
    const newRows = block.rows.map((row) => [...row, ""]);
    onUpdate({ ...block, headers: newHeaders, rows: newRows });
  }

  function addRow() {
    const newRow = block.headers.map(() => "");
    onUpdate({ ...block, rows: [...block.rows, newRow] });
  }

  function removeRow(ri: number) {
    onUpdate({ ...block, rows: block.rows.filter((_, i) => i !== ri) });
  }

  function removeColumn(ci: number) {
    const newHeaders = block.headers.filter((_, i) => i !== ci);
    const newRows = block.rows.map((row) => row.filter((_, i) => i !== ci));
    onUpdate({ ...block, headers: newHeaders, rows: newRows });
  }

  return (
    <div className="space-y-2 overflow-x-auto">
      {/* Headers */}
      <div className="flex gap-1 items-center">
        {block.headers.map((h, i) => (
          <div key={i} className="relative">
            <Input
              value={h}
              onChange={(e) => {
                const newHeaders = [...block.headers];
                newHeaders[i] = e.target.value;
                onUpdate({ ...block, headers: newHeaders });
              }}
              className="w-28 h-7 text-xs font-semibold"
              placeholder={`Header ${i + 1}`}
            />
            {block.headers.length > 1 && (
              <button
                onClick={() => removeColumn(i)}
                className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-destructive text-[8px] text-white flex items-center justify-center opacity-0 group-hover:opacity-100"
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button
          onClick={addColumn}
          className="h-7 px-2 rounded border text-xs text-muted-foreground hover:bg-accent"
        >
          +
        </button>
      </div>
      {/* Rows */}
      {block.rows.map((row, ri) => (
        <div key={ri} className="flex gap-1 items-center">
          {row.map((cell, ci) => (
            <Input
              key={ci}
              value={cell}
              onChange={(e) => {
                const newRows = block.rows.map((r, idx) =>
                  idx === ri ? r.map((c, cidx) => (cidx === ci ? e.target.value : c)) : r,
                );
                onUpdate({ ...block, rows: newRows });
              }}
              className="w-28 h-7 text-xs"
              placeholder={`{{var}}`}
            />
          ))}
          <button
            onClick={() => removeRow(ri)}
            className="h-7 px-1.5 rounded text-xs text-destructive hover:bg-destructive/10"
          >
            ×
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <button onClick={addRow} className="text-xs text-primary hover:underline">
          + Baris
        </button>
        <label className="flex items-center gap-1 text-xs">
          <Switch
            checked={block.striped ?? false}
            onCheckedChange={(v) => onUpdate({ ...block, striped: v })}
            className="scale-75"
          />
          Striped
        </label>
      </div>
    </div>
  );
}

// ─── LIST ─────────────────────────────────────────────────────────────────────

function ListEditor({
  block,
  variables,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "list" }>;
  variables: VariableDefinition[];
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <label className="flex items-center gap-1 text-xs">
          <Switch
            checked={block.ordered ?? false}
            onCheckedChange={(v) => onUpdate({ ...block, ordered: v })}
            className="scale-75"
          />
          Numbered
        </label>
      </div>
      {block.items.map((item, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-4">
            {block.ordered ? `${i + 1}.` : "•"}
          </span>
          <VariableInput
            value={item}
            onChange={(v) => {
              const newItems = [...block.items];
              newItems[i] = v;
              onUpdate({ ...block, items: newItems });
            }}
            variables={variables}
            placeholder={`Item ${i + 1}`}
            className="flex-1"
          />
          {block.items.length > 1 && (
            <button
              onClick={() => {
                onUpdate({ ...block, items: block.items.filter((_, idx) => idx !== i) });
              }}
              className="rounded p-1 text-xs text-destructive hover:bg-destructive/10"
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={() => onUpdate({ ...block, items: [...block.items, ""] })}
        className="text-xs text-primary hover:underline"
      >
        + Tambah item
      </button>
    </div>
  );
}

// ─── COLUMNS ──────────────────────────────────────────────────────────────────

function ColumnsEditor({
  block,
  onUpdate,
}: {
  block: Extract<TemplateBlock, { type: "columns" }>;
  onUpdate: (b: TemplateBlock) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {block.columns.length} kolom ({block.columns.map((c) => c.width).join(" + ")})
      </p>
      <p className="text-xs text-muted-foreground italic">
        Editing kolom nested belum tersedia di versi ini.
      </p>
    </div>
  );
}

// ─── SIGNATURE ────────────────────────────────────────────────────────────────

function SignatureEditor() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground italic">
      <span className="text-base">✍️</span>
      Auto-generated brand signature (— ARKA • IAI Wilayah DKI Jakarta)
    </div>
  );
}

// ─── SHARED: ALIGN SELECT ─────────────────────────────────────────────────────

function AlignSelect({
  value,
  onChange,
}: {
  value?: "left" | "center" | "right";
  onChange: (v: "left" | "center" | "right" | undefined) => void;
}) {
  return (
    <div className="flex rounded-md border overflow-hidden">
      {(["left", "center", "right"] as const).map((align) => (
        <button
          key={align}
          onClick={() => onChange(value === align ? undefined : align)}
          className={`px-1.5 py-0.5 text-[10px] transition-colors ${
            value === align ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
          title={align}
        >
          {align === "left" ? "◀" : align === "center" ? "◆" : "▶"}
        </button>
      ))}
    </div>
  );
}
