"use client";

import { Save } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Rnd } from "react-rnd";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateTemplate, type TemplateRow } from "@/server/actions/sertifikat/templates";
import type {
  TemplateFieldKey,
  TemplateFieldMap,
  TemplateFieldPosition,
} from "@/server/db/schema";

const fields: { key: TemplateFieldKey; label: string; sample: string }[] = [
  { key: "namaPeserta", label: "Nama Peserta", sample: "[Nama Peserta]" },
  { key: "noSertifikat", label: "No Sertifikat", sample: "WS001-001/2026" },
  { key: "namaKegiatan", label: "Nama Kegiatan", sample: "[Nama Kegiatan]" },
  { key: "kategori", label: "Kategori", sample: "Workshop" },
  { key: "tanggalKegiatan", label: "Tanggal Kegiatan", sample: "15 April 2026" },
  { key: "lokasi", label: "Lokasi", sample: "Jakarta" },
  { key: "skp", label: "SKP", sample: "8 SKP" },
  { key: "qrCode", label: "QR Code", sample: "[QR]" },
  { key: "signature1Nama", label: "TTD 1 Nama", sample: "[Nama TTD 1]" },
  { key: "signature1Jabatan", label: "TTD 1 Jabatan", sample: "[Jabatan TTD 1]" },
  { key: "signature2Nama", label: "TTD 2 Nama", sample: "[Nama TTD 2]" },
  { key: "signature2Jabatan", label: "TTD 2 Jabatan", sample: "[Jabatan TTD 2]" },
  { key: "signature3Nama", label: "TTD 3 Nama", sample: "[Nama TTD 3]" },
  { key: "signature3Jabatan", label: "TTD 3 Jabatan", sample: "[Jabatan TTD 3]" },
];

const defaultPosition: TemplateFieldPosition = {
  enabled: true,
  x: 50,
  y: 50,
  width: 30,
  fontSize: 18,
  fontWeight: "normal",
  fontStyle: "normal",
  fontFamily: "Helvetica",
  color: "#111827",
  align: "center",
};

function sampleFor(key: TemplateFieldKey) {
  return fields.find((field) => field.key === key)?.sample ?? key;
}

export function TemplateEditor({
  template,
  onSaved,
}: {
  template: TemplateRow;
  onSaved?: () => void;
}) {
  const [positions, setPositions] = useState<TemplateFieldMap>(template.fieldPositions ?? {});
  const [activeKey, setActiveKey] = useState<TemplateFieldKey | null>(null);
  const [isPending, startTransition] = useTransition();

  const scale = Math.min(800 / template.imageWidth, 600 / template.imageHeight, 1);
  const canvasWidth = Math.round(template.imageWidth * scale);
  const canvasHeight = Math.round(template.imageHeight * scale);

  const activePosition = activeKey ? positions[activeKey] : undefined;

  const renderedFields = useMemo(
    () =>
      Object.entries(positions).filter(
        (entry): entry is [TemplateFieldKey, TemplateFieldPosition] => Boolean(entry[1]?.enabled),
      ),
    [positions],
  );

  function addField(key: TemplateFieldKey) {
    setPositions((prev) => ({
      ...prev,
      [key]: prev[key] ?? defaultPosition,
    }));
    setActiveKey(key);
  }

  function updateField(key: TemplateFieldKey, patch: Partial<TemplateFieldPosition>) {
    setPositions((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? defaultPosition), ...patch },
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await updateTemplate(template.id, { fieldPositions: positions });
      if (result.ok) {
        toast.success("Template berhasil disimpan.");
        onSaved?.();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
      <div className="space-y-2 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
        <Label>Field</Label>
        <div className="grid gap-2">
          {fields.map((field) => (
            <Button
              key={field.key}
              type="button"
              variant={positions[field.key]?.enabled ? "secondary" : "outline"}
              className="justify-start"
              onClick={() => addField(field.key)}
            >
              {field.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-auto rounded-lg border border-border/60 bg-muted/25 p-3 shadow-sm">
        <div
          className="relative mx-auto bg-white shadow-sm"
          style={{ width: canvasWidth, height: canvasHeight }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={template.imageUrl}
            alt={template.nama}
            className="absolute inset-0 h-full w-full select-none object-fill"
            draggable={false}
          />
          {renderedFields.map(([key, position]) => {
            const widthPx =
              key === "qrCode"
                ? ((position.width ?? 12) / 100) * canvasWidth
                : ((position.width ?? 30) / 100) * canvasWidth;
            const heightPx = key === "qrCode" ? widthPx : Math.max(position.fontSize * 1.8, 28);
            return (
              <Rnd
                key={key}
                size={{ width: widthPx, height: heightPx }}
                position={{
                  x: (position.x / 100) * canvasWidth - widthPx / 2,
                  y: (position.y / 100) * canvasHeight - heightPx / 2,
                }}
                bounds="parent"
                onDragStop={(_event, data) => {
                  updateField(key, {
                    x: ((data.x + widthPx / 2) / canvasWidth) * 100,
                    y: ((data.y + heightPx / 2) / canvasHeight) * 100,
                  });
                }}
                onResizeStop={(_event, _direction, ref, _delta, pos) => {
                  const nextWidth = ref.offsetWidth;
                  const nextHeight = ref.offsetHeight;
                  updateField(key, {
                    width: (nextWidth / canvasWidth) * 100,
                    x: ((pos.x + nextWidth / 2) / canvasWidth) * 100,
                    y: ((pos.y + nextHeight / 2) / canvasHeight) * 100,
                  });
                }}
                onClick={() => setActiveKey(key)}
                className={`flex items-center justify-center border bg-white/70 text-center text-xs shadow-sm ${
                  activeKey === key ? "border-primary" : "border-dashed border-muted-foreground/50"
                }`}
              >
                {key === "qrCode" ? (
                  <div className="grid h-full w-full place-items-center border border-muted-foreground/70 text-[10px]">
                    QR
                  </div>
                ) : (
                  <span
                    style={{
                      fontSize: Math.max(8, position.fontSize * scale),
                      fontWeight: position.fontWeight,
                      fontStyle: position.fontStyle,
                      color: position.color,
                      textAlign: position.align,
                    }}
                  >
                    {sampleFor(key)}
                  </span>
                )}
              </Rnd>
            );
          })}
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-card p-3 shadow-sm">
        <div className="flex items-center justify-between">
          <Label>Properti</Label>
          <Button type="button" onClick={save} disabled={isPending}>
            <Save className="h-4 w-4" />
            Simpan
          </Button>
        </div>
        {activeKey && activePosition ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">{fields.find((field) => field.key === activeKey)?.label}</p>
            <PropertyNumber
              label="Ukuran Font"
              value={activePosition.fontSize}
              min={8}
              max={72}
              onChange={(value) => updateField(activeKey, { fontSize: value })}
            />
            <PropertyNumber
              label="Lebar (%)"
              value={activePosition.width ?? 30}
              min={1}
              max={100}
              onChange={(value) => updateField(activeKey, { width: value })}
            />
            <div className="space-y-2">
              <Label>Warna</Label>
              <Input
                type="color"
                value={activePosition.color}
                onChange={(event) => updateField(activeKey, { color: event.target.value })}
              />
            </div>
            <Select
              value={activePosition.fontFamily}
              onValueChange={(value) =>
                updateField(activeKey, {
                  fontFamily: value as TemplateFieldPosition["fontFamily"],
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Helvetica">Helvetica</SelectItem>
                <SelectItem value="Times-Roman">Times-Roman</SelectItem>
                <SelectItem value="Courier">Courier</SelectItem>
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={activePosition.fontWeight === "bold" ? "default" : "outline"}
                onClick={() =>
                  updateField(activeKey, {
                    fontWeight: activePosition.fontWeight === "bold" ? "normal" : "bold",
                  })
                }
              >
                Bold
              </Button>
              <Button
                type="button"
                variant={activePosition.fontStyle === "italic" ? "default" : "outline"}
                onClick={() =>
                  updateField(activeKey, {
                    fontStyle: activePosition.fontStyle === "italic" ? "normal" : "italic",
                  })
                }
              >
                Italic
              </Button>
            </div>
            <Select
              value={activePosition.align}
              onValueChange={(value) =>
                updateField(activeKey, { align: value as TemplateFieldPosition["align"] })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Kiri</SelectItem>
                <SelectItem value="center">Tengah</SelectItem>
                <SelectItem value="right">Kanan</SelectItem>
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="destructive"
              onClick={() => updateField(activeKey, { enabled: false })}
            >
              Hapus Field
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
            Pilih field pada canvas untuk mengubah properti.
          </div>
        )}
      </div>
    </div>
  );
}

function PropertyNumber({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  );
}
