"use client";

import {
  Type,
  Heading,
  MousePointerClick,
  Minus,
  MoveVertical,
  ImageIcon,
  AlertTriangle,
  Table,
  List,
  Columns,
  PenTool,
} from "lucide-react";
import type { TemplateBlock } from "@/lib/email/template-engine/types";

interface Props {
  onAddBlock: (type: TemplateBlock["type"]) => void;
}

const BLOCK_OPTIONS: Array<{
  type: TemplateBlock["type"];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  { type: "paragraph", label: "Paragraf", icon: Type, description: "Teks dengan variabel" },
  { type: "heading", label: "Heading", icon: Heading, description: "H1/H2/H3" },
  { type: "button", label: "Tombol", icon: MousePointerClick, description: "CTA button" },
  { type: "divider", label: "Pemisah", icon: Minus, description: "Garis horizontal" },
  { type: "spacer", label: "Spasi", icon: MoveVertical, description: "Jarak vertikal" },
  { type: "image", label: "Gambar", icon: ImageIcon, description: "Gambar dengan URL" },
  { type: "alert", label: "Alert", icon: AlertTriangle, description: "Info/warning box" },
  { type: "table", label: "Tabel", icon: Table, description: "Tabel data" },
  { type: "list", label: "List", icon: List, description: "Ordered/unordered" },
  { type: "columns", label: "Kolom", icon: Columns, description: "2-3 kolom layout" },
  { type: "signature", label: "Signature", icon: PenTool, description: "Brand signature" },
];

export function BlockPalette({ onAddBlock }: Props) {
  return (
    <div className="rounded-xl border border-border/60 bg-card shadow-sm p-3">
      <p className="text-xs font-medium text-muted-foreground mb-2">
        + Tambah Block
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-1.5">
        {BLOCK_OPTIONS.map((opt) => (
          <button
            key={opt.type}
            onClick={() => onAddBlock(opt.type)}
            className="flex flex-col items-center gap-1 rounded-md border p-2 text-center transition-colors hover:bg-accent hover:border-primary/30"
            title={opt.description}
          >
            <opt.icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] font-medium">{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
