"use client";

import { Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type {
  FormField,
  GridConfig,
  NarasumberSectionConfig,
  OptionsConfig,
  ScaleConfig,
} from "./types";

interface FieldConfigPanelProps {
  field: FormField;
  onChange: (field: FormField) => void;
  disabled?: boolean;
}

export function FieldConfigPanel({ field, onChange, disabled }: FieldConfigPanelProps) {
  const updateLabel = (label: string) => {
    if (label.length <= 300) {
      onChange({ ...field, label });
    }
  };

  const updateRequired = (required: boolean) => {
    onChange({ ...field, required });
  };


  return (
    <div className="space-y-4">
      {/* Label */}
      <div className="space-y-1.5">
        <Label>Label Field</Label>
        <Input
          value={field.label}
          onChange={(e) => updateLabel(e.target.value)}
          placeholder="Masukkan label field..."
          maxLength={300}
          disabled={disabled}
        />
        <p className="text-xs text-muted-foreground">{field.label.length}/300 karakter</p>
      </div>

      {/* Required toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor={`required-${field.id}`}>Wajib diisi</Label>
        <Switch
          id={`required-${field.id}`}
          checked={field.required}
          onCheckedChange={updateRequired}
          disabled={disabled}
        />
      </div>

      {/* Type-specific config */}
      {field.type === "scale" && (
        <ScaleConfigPanel
          config={(field.config as ScaleConfig) ?? { min: 1, max: 5, minLabel: "", maxLabel: "" }}
          onChange={(config) => onChange({ ...field, config })}
          disabled={disabled}
        />
      )}

      {field.type === "grid" && (
        <GridConfigPanel
          config={(field.config as GridConfig) ?? { rows: [""], columns: ["", ""] }}
          onChange={(config) => onChange({ ...field, config })}
          disabled={disabled}
        />
      )}

      {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && (
        <OptionsConfigPanel
          config={(field.config as OptionsConfig) ?? { options: [""] }}
          onChange={(config) => onChange({ ...field, config })}
          disabled={disabled}
        />
      )}

      {field.type === "narasumber_section" && (
        <NarasumberSectionConfigPanel
          config={(field.config as NarasumberSectionConfig) ?? { fields: [] }}
          onChange={(config) => onChange({ ...field, config })}
          disabled={disabled}
        />
      )}
    </div>
  );
}

// ─── Scale Config ────────────────────────────────────────────────────────────

function ScaleConfigPanel({
  config,
  onChange,
  disabled,
}: {
  config: ScaleConfig;
  onChange: (config: ScaleConfig) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Konfigurasi Skala</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Nilai Minimum</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={config.min}
            onChange={(e) => onChange({ ...config, min: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Nilai Maksimum</Label>
          <Input
            type="number"
            min={1}
            max={10}
            value={config.max}
            onChange={(e) => onChange({ ...config, max: Number(e.target.value) })}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Label Minimum</Label>
          <Input
            value={config.minLabel}
            onChange={(e) => {
              if (e.target.value.length <= 50) {
                onChange({ ...config, minLabel: e.target.value });
              }
            }}
            placeholder="cth: Sangat Buruk"
            maxLength={50}
            disabled={disabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Label Maksimum</Label>
          <Input
            value={config.maxLabel}
            onChange={(e) => {
              if (e.target.value.length <= 50) {
                onChange({ ...config, maxLabel: e.target.value });
              }
            }}
            placeholder="cth: Sangat Baik"
            maxLength={50}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Grid Config ─────────────────────────────────────────────────────────────

function GridConfigPanel({
  config,
  onChange,
  disabled,
}: {
  config: GridConfig;
  onChange: (config: GridConfig) => void;
  disabled?: boolean;
}) {
  const addRow = () => {
    if (config.rows.length < 30) {
      onChange({ ...config, rows: [...config.rows, ""] });
    }
  };

  const removeRow = (index: number) => {
    if (config.rows.length > 1) {
      onChange({ ...config, rows: config.rows.filter((_, i) => i !== index) });
    }
  };

  const updateRow = (index: number, value: string) => {
    if (value.length <= 300) {
      const rows = [...config.rows];
      rows[index] = value;
      onChange({ ...config, rows });
    }
  };

  const addColumn = () => {
    if (config.columns.length < 10) {
      onChange({ ...config, columns: [...config.columns, ""] });
    }
  };

  const removeColumn = (index: number) => {
    if (config.columns.length > 2) {
      onChange({ ...config, columns: config.columns.filter((_, i) => i !== index) });
    }
  };

  const updateColumn = (index: number, value: string) => {
    if (value.length <= 100) {
      const columns = [...config.columns];
      columns[index] = value;
      onChange({ ...config, columns });
    }
  };

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <p className="text-sm font-medium">Konfigurasi Grid</p>

      {/* Rows */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Baris (Pernyataan) — {config.rows.length}/30</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={addRow}
            disabled={disabled || config.rows.length >= 30}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {config.rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={row}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={`Baris ${i + 1}`}
              maxLength={300}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => removeRow(i)}
              disabled={disabled || config.rows.length <= 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>

      {/* Columns */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Kolom (Skala) — {config.columns.length}/10</Label>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={addColumn}
            disabled={disabled || config.columns.length >= 10}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
        {config.columns.map((col, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={col}
              onChange={(e) => updateColumn(i, e.target.value)}
              placeholder={`Kolom ${i + 1}`}
              maxLength={100}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => removeColumn(i)}
              disabled={disabled || config.columns.length <= 2}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Options Config ──────────────────────────────────────────────────────────

function OptionsConfigPanel({
  config,
  onChange,
  disabled,
}: {
  config: OptionsConfig;
  onChange: (config: OptionsConfig) => void;
  disabled?: boolean;
}) {
  const addOption = () => {
    if (config.options.length < 50) {
      onChange({ ...config, options: [...config.options, ""] });
    }
  };

  const removeOption = (index: number) => {
    if (config.options.length > 1) {
      onChange({ ...config, options: config.options.filter((_, i) => i !== index) });
    }
  };

  const updateOption = (index: number, value: string) => {
    if (value.length <= 200) {
      const options = [...config.options];
      options[index] = value;
      onChange({ ...config, options });
    }
  };

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <Label>Opsi — {config.options.length}/50</Label>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={addOption}
          disabled={disabled || config.options.length >= 50}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {config.options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
            placeholder={`Opsi ${i + 1}`}
            maxLength={200}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => removeOption(i)}
            disabled={disabled || config.options.length <= 1}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}

// ─── Narasumber Section Config ──────────────────────────────────────────────

const NARASUMBER_FIELD_TYPES = ["scale", "radio", "textarea", "text"] as const;

function NarasumberSectionConfigPanel({
  config,
  onChange,
  disabled,
}: {
  config: NarasumberSectionConfig;
  onChange: (config: NarasumberSectionConfig) => void;
  disabled?: boolean;
}) {
  const addField = () => {
    if (config.fields.length < 20) {
      onChange({
        ...config,
        fields: [
          ...config.fields,
          { type: "scale", label: "", required: false, config: null },
        ],
      });
    }
  };

  const removeField = (index: number) => {
    if (config.fields.length > 1) {
      onChange({
        ...config,
        fields: config.fields.filter((_, i) => i !== index),
      });
    }
  };

  const updateField = (index: number, updates: Partial<{
    type: "scale" | "radio" | "textarea" | "text";
    label: string;
    required: boolean;
    config: ScaleConfig | OptionsConfig | null;
  }>) => {
    const fields = [...config.fields];
    fields[index] = { ...fields[index], ...updates } as (typeof config.fields)[number];
    onChange({ ...config, fields });
  };

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Sub-Field Evaluasi Narasumber</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={addField}
          disabled={disabled || config.fields.length >= 20}
        >
          <Plus className="h-3 w-3 mr-1" />
          Tambah
        </Button>
      </div>

      {config.fields.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Belum ada sub-field. Tambah sub-field untuk evaluasi per-narasumber.
        </p>
      )}

      {config.fields.map((field, idx) => (
        <div key={idx} className="space-y-2 rounded-md border p-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Sub-Field {idx + 1}</span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={() => removeField(idx)}
              disabled={disabled || config.fields.length <= 1}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Tipe Field</Label>
            <Select
              value={field.type}
              onValueChange={(val: string) =>
                updateField(idx, {
                  type: val as (typeof NARASUMBER_FIELD_TYPES)[number],
                  config: val === "scale" ? { min: 1, max: 5, minLabel: "", maxLabel: "" } :
                          val === "radio" ? { options: [""] } : null,
                })
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scale">Skala</SelectItem>
                <SelectItem value="radio">Pilihan Tunggal</SelectItem>
                <SelectItem value="textarea">Teks Panjang</SelectItem>
                <SelectItem value="text">Teks Singkat</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={field.label}
              onChange={(e) => {
                if (e.target.value.length <= 300) {
                  updateField(idx, { label: e.target.value });
                }
              }}
              placeholder="cth: Penguasaan materi"
              maxLength={300}
              className="h-8 text-xs"
              disabled={disabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs" htmlFor={`narsub-req-${idx}`}>Wajib diisi</Label>
            <Switch
              id={`narsub-req-${idx}`}
              checked={field.required}
              onCheckedChange={(checked) => updateField(idx, { required: checked })}
              disabled={disabled}
            />
          </div>

          {field.type === "scale" && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Min</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={(field.config as ScaleConfig)?.min ?? 1}
                  onChange={(e) =>
                    updateField(idx, {
                      config: {
                        ...((field.config as ScaleConfig) ?? { min: 1, max: 5, minLabel: "", maxLabel: "" }),
                        min: Number(e.target.value),
                      },
                    })
                  }
                  className="h-8 text-xs"
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={(field.config as ScaleConfig)?.max ?? 5}
                  onChange={(e) =>
                    updateField(idx, {
                      config: {
                        ...((field.config as ScaleConfig) ?? { min: 1, max: 5, minLabel: "", maxLabel: "" }),
                        max: Number(e.target.value),
                      },
                    })
                  }
                  className="h-8 text-xs"
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {field.type === "radio" && (
            <div className="space-y-1">
              <Label className="text-xs">Opsi (dipisah koma)</Label>
              <Input
                value={((field.config as OptionsConfig)?.options ?? []).join(", ")}
                onChange={(e) =>
                  updateField(idx, {
                    config: {
                      options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    },
                  })
                }
                placeholder="Sangat Baik, Baik, Cukup, Kurang"
                className="h-8 text-xs"
                disabled={disabled}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
