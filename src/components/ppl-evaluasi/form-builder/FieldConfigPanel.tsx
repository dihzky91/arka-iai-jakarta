"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  FormField,
  GridConfig,
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
