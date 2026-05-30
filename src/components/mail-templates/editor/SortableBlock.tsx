"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Copy, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BlockRenderer } from "./BlockRenderer";
import type { TemplateBlock } from "@/lib/email/template-engine/types";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  block: TemplateBlock;
  variables: VariableDefinition[];
  onUpdate: (block: TemplateBlock) => void;
  onRemove: () => void;
  onDuplicate: () => void;
}

const BLOCK_LABELS: Record<string, string> = {
  paragraph: "Paragraf",
  heading: "Heading",
  button: "Tombol",
  divider: "Pemisah",
  spacer: "Spasi",
  image: "Gambar",
  alert: "Alert",
  table: "Tabel",
  list: "List",
  columns: "Kolom",
  signature: "Signature",
};

export function SortableBlock({
  block,
  variables,
  onUpdate,
  onRemove,
  onDuplicate,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-lg border bg-background transition-shadow ${
        isDragging ? "shadow-lg ring-2 ring-primary/20" : "hover:shadow-sm"
      }`}
    >
      {/* Block Header: Drag Handle + Type + Actions */}
      <div className="flex items-center gap-1.5 border-b px-2 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {BLOCK_LABELS[block.type] ?? block.type}
        </Badge>
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onDuplicate}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            title="Duplikasi"
          >
            <Copy className="h-3 w-3" />
          </button>
          <button
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            title="Hapus"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {/* Block Content */}
      <div className="p-2.5">
        <BlockRenderer
          block={block}
          variables={variables}
          onUpdate={onUpdate}
        />
      </div>
    </div>
  );
}
