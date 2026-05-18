"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlignLeft,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Copy,
  Grid3X3,
  GripVertical,
  Hash,
  List,
  Mail,
  SlidersHorizontal,
  Trash2,
  Type,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FieldConfigPanel } from "./FieldConfigPanel";
import type { FieldType, FormField } from "./types";

const FIELD_TYPE_LABELS: Record<FieldType, { label: string; icon: React.ReactNode }> = {
  text: { label: "Teks Singkat", icon: <Type className="h-3.5 w-3.5" /> },
  textarea: { label: "Teks Panjang", icon: <AlignLeft className="h-3.5 w-3.5" /> },
  number: { label: "Angka", icon: <Hash className="h-3.5 w-3.5" /> },
  email: { label: "Email", icon: <Mail className="h-3.5 w-3.5" /> },
  select: { label: "Dropdown", icon: <List className="h-3.5 w-3.5" /> },
  radio: { label: "Pilihan Tunggal", icon: <CircleDot className="h-3.5 w-3.5" /> },
  checkbox: { label: "Pilihan Ganda", icon: <CheckSquare className="h-3.5 w-3.5" /> },
  scale: { label: "Skala", icon: <SlidersHorizontal className="h-3.5 w-3.5" /> },
  grid: { label: "Grid", icon: <Grid3X3 className="h-3.5 w-3.5" /> },
};

interface FieldCardProps {
  field: FormField;
  onChange: (field: FormField) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  disabled?: boolean;
}

export function FieldCard({
  field,
  onChange,
  onRemove,
  onDuplicate,
  disabled,
}: FieldCardProps) {
  const [expanded, setExpanded] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const typeInfo = FIELD_TYPE_LABELS[field.type];

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`transition-shadow ${isDragging ? "shadow-lg ring-2 ring-primary/30" : ""}`}>
        <CardHeader className="flex-row items-center gap-2 py-3 px-4">
          {/* Drag handle */}
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            disabled={disabled}
            {...attributes}
            {...listeners}
            aria-label="Drag untuk mengubah urutan"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Field type badge */}
          <Badge variant="secondary" className="flex items-center gap-1 text-xs">
            {typeInfo.icon}
            {typeInfo.label}
          </Badge>

          {/* Field label */}
          <span className="flex-1 truncate text-sm font-medium">
            {field.label || <span className="italic text-muted-foreground">Belum ada label</span>}
          </span>

          {/* Required indicator */}
          {field.required && (
            <Badge variant="default" className="text-xs">
              Wajib
            </Badge>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onDuplicate}
              disabled={disabled}
              title="Duplikat field"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onRemove}
              disabled={disabled}
              title="Hapus field"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? "Tutup konfigurasi" : "Buka konfigurasi"}
            >
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </CardHeader>

        {expanded && (
          <CardContent className="pt-0 pb-4 px-4">
            <FieldConfigPanel field={field} onChange={onChange} disabled={disabled} />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
