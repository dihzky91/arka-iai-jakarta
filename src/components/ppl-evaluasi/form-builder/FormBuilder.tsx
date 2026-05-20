"use client";

import { useCallback, useState, useTransition } from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { Lock, Save } from "lucide-react";
import { nanoid } from "nanoid";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTemplate, updateTemplate } from "@/server/actions/ppl-evaluasi/kuesioner";
import { AddFieldButton } from "./AddFieldButton";
import { FieldCard } from "./FieldCard";
import type {
  FieldType,
  FormField,
  GridConfig,
  NarasumberSectionConfig,
  OptionsConfig,
  ScaleConfig,
} from "./types";

interface FormBuilderProps {
  kegiatanId: number;
  templateId?: number;
  initialNama?: string;
  initialFields?: FormField[];
  isLocked?: boolean;
}

function getDefaultConfig(type: FieldType): ScaleConfig | GridConfig | OptionsConfig | NarasumberSectionConfig | null {
  switch (type) {
    case "scale":
      return { min: 1, max: 5, minLabel: "", maxLabel: "" };
    case "grid":
      return { rows: [""], columns: ["", ""] };
    case "select":
    case "radio":
    case "checkbox":
      return { options: [""] };
    case "narasumber_section":
      return {
        fields: [
          { type: "scale", label: "Penguasaan materi", required: true, config: { min: 1, max: 5, minLabel: "", maxLabel: "" } },
          { type: "scale", label: "Cara penyampaian", required: true, config: { min: 1, max: 5, minLabel: "", maxLabel: "" } },
          { type: "scale", label: "Interaksi dengan peserta", required: true, config: { min: 1, max: 5, minLabel: "", maxLabel: "" } },
        ],
      };
    default:
      return null;
  }
}

export function FormBuilder({
  kegiatanId,
  templateId,
  initialNama = "",
  initialFields = [],
  isLocked = false,
}: FormBuilderProps) {
  const [nama, setNama] = useState(initialNama);
  const [fields, setFields] = useState<FormField[]>(initialFields);
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const addField = useCallback((type: FieldType) => {
    if (fields.length >= 50) {
      toast.error("Maksimal 50 field per template");
      return;
    }
    const newField: FormField = {
      id: nanoid(),
      type,
      label: "",
      required: false,
      order: fields.length,
      config: getDefaultConfig(type),
    };
    setFields((prev) => [...prev, newField]);
  }, [fields.length]);

  const updateField = useCallback((updatedField: FormField) => {
    setFields((prev) =>
      prev.map((f) => (f.id === updatedField.id ? updatedField : f)),
    );
  }, []);

  const removeField = useCallback((fieldId: string) => {
    setFields((prev) =>
      prev
        .filter((f) => f.id !== fieldId)
        .map((f, i) => ({ ...f, order: i })),
    );
  }, []);

  const duplicateField = useCallback((fieldId: string) => {
    if (fields.length >= 50) {
      toast.error("Maksimal 50 field per template");
      return;
    }
    setFields((prev) => {
      const index = prev.findIndex((f) => f.id === fieldId);
      if (index === -1) return prev;
      const source = prev[index]!;
      const duplicate: FormField = {
        ...source,
        id: nanoid(),
        label: `${source.label} (copy)`,
        order: index + 1,
      };
      const newFields = [...prev];
      newFields.splice(index + 1, 0, duplicate);
      return newFields.map((f, i) => ({ ...f, order: i }));
    });
  }, [fields.length]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const reordered = arrayMove(prev, oldIndex, newIndex);
      return reordered.map((f, i) => ({ ...f, order: i }));
    });
  }, []);

  const handleSave = () => {
    if (!nama.trim()) {
      toast.error("Nama template wajib diisi");
      return;
    }
    if (nama.length > 200) {
      toast.error("Nama template maksimal 200 karakter");
      return;
    }
    if (fields.length === 0) {
      toast.error("Template harus memiliki minimal 1 field");
      return;
    }
    if (fields.length > 50) {
      toast.error("Maksimal 50 field per template");
      return;
    }

    // Validate all fields have labels
    const emptyLabel = fields.find((f) => !f.label.trim());
    if (emptyLabel) {
      toast.error("Semua field harus memiliki label");
      return;
    }

    startTransition(async () => {
      const data = { nama: nama.trim(), fields };

      if (templateId) {
        const result = await updateTemplate(templateId, data);
        if (result.ok) {
          toast.success("Template berhasil diperbarui");
        } else {
          toast.error(result.error ?? "Gagal memperbarui template");
        }
      } else {
        const result = await createTemplate(data);
        if (result.ok) {
          toast.success("Template berhasil dibuat");
        } else {
          toast.error(result.error ?? "Gagal membuat template");
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Lock indicator */}
      {isLocked && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            Template ini terkunci karena sudah memiliki respons. Anda tidak dapat mengubah konfigurasi field.
          </span>
        </div>
      )}

      {/* Template name */}
      <div className="space-y-1.5">
        <Label htmlFor="template-nama">Nama Template</Label>
        <Input
          id="template-nama"
          value={nama}
          onChange={(e) => {
            if (e.target.value.length <= 200) {
              setNama(e.target.value);
            }
          }}
          placeholder="Masukkan nama template kuesioner..."
          maxLength={200}
          disabled={isLocked}
        />
        <p className="text-xs text-muted-foreground">{nama.length}/200 karakter</p>
      </div>

      {/* Field count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {fields.length} field{fields.length !== 1 ? "s" : ""} (maks. 50)
        </p>
        <AddFieldButton onAdd={addField} disabled={isLocked || fields.length >= 50} />
      </div>

      {/* Fields list with drag-and-drop */}
      {fields.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Belum ada field. Klik &quot;Tambah Field&quot; untuk memulai.
          </p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-3">
              {fields.map((field) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  onChange={updateField}
                  onRemove={() => removeField(field.id)}
                  onDuplicate={() => duplicateField(field.id)}
                  disabled={isLocked}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Save button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isLocked || isPending}
        >
          <Save className="h-4 w-4" />
          {isPending ? "Menyimpan..." : templateId ? "Simpan Perubahan" : "Buat Template"}
        </Button>
      </div>
    </div>
  );
}
