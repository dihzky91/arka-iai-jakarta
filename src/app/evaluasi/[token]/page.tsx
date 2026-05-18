"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { CheckCircle2, AlertCircle, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  getKuesionerByToken,
  submitResponse,
} from "@/server/actions/ppl-evaluasi/responses";
import type { PublicKuesionerData } from "@/server/actions/ppl-evaluasi/types";
import type {
  FormField,
  GridConfig,
  OptionsConfig,
  ScaleConfig,
} from "@/components/ppl-evaluasi/form-builder/types";

// ─── MAIN PAGE COMPONENT ─────────────────────────────────────────────────────

export default function EvaluasiPublicPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [kuesioner, setKuesioner] = useState<PublicKuesionerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [namaResponden, setNamaResponden] = useState("");
  const [emailResponden, setEmailResponden] = useState("");
  const [isPending, startTransition] = useTransition();

  // Fetch kuesioner data on mount
  useEffect(() => {
    getKuesionerByToken(token).then((data) => {
      if (!data) {
        setNotFound(true);
      } else {
        setKuesioner(data);
      }
      setLoading(false);
    });
  }, [token]);

  const updateAnswer = useCallback(
    (fieldId: string, value: unknown) => {
      setAnswers((prev) => ({ ...prev, [fieldId]: value }));
    },
    [],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await submitResponse(token, {
        namaResponden,
        emailResponden,
        answers,
      });

      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.error ?? "Terjadi kesalahan");
      }
    });
  };

  // ─── LOADING STATE ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-sm text-slate-500">Memuat kuesioner...</p>
        </div>
      </PageShell>
    );
  }

  // ─── NOT FOUND STATE ─────────────────────────────────────────────────────────

  if (notFound) {
    return (
      <PageShell>
        <Card className="w-full overflow-hidden rounded-3xl border-white/70 bg-white/85 py-0 shadow-[0_8px_30px_rgb(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <XCircle className="h-12 w-12 text-slate-400" />
            <h2 className="text-lg font-medium text-slate-700">
              Kuesioner Tidak Ditemukan
            </h2>
            <p className="text-sm text-slate-500">
              Link kuesioner tidak valid atau sudah tidak tersedia.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ─── DEACTIVATED STATE ───────────────────────────────────────────────────────

  if (kuesioner && !kuesioner.isActive) {
    return (
      <PageShell>
        <Card className="w-full overflow-hidden rounded-3xl border-white/70 bg-white/85 py-0 shadow-[0_8px_30px_rgb(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="h-12 w-12 text-amber-500" />
            <h2 className="text-lg font-medium text-slate-700">
              Kuesioner Sudah Ditutup
            </h2>
            <p className="text-sm text-slate-500">
              Kuesioner evaluasi untuk kegiatan ini sudah tidak menerima respons.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ─── SUCCESS STATE ───────────────────────────────────────────────────────────

  if (submitted) {
    return (
      <PageShell>
        <Card className="w-full overflow-hidden rounded-3xl border-white/70 bg-white/85 py-0 shadow-[0_8px_30px_rgb(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h2 className="text-lg font-medium text-slate-700">
              Terima Kasih!
            </h2>
            <p className="text-sm text-slate-500">
              Respons Anda telah berhasil disimpan. Terima kasih atas partisipasi
              Anda dalam evaluasi kegiatan ini.
            </p>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  // ─── FORM STATE ──────────────────────────────────────────────────────────────

  if (!kuesioner) return null;

  const sortedFields = [...kuesioner.fields].sort(
    (a, b) => a.order - b.order,
  );

  return (
    <PageShell>
      {/* Header */}
      <div className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white shadow-md">
        <CheckCircle2 className="h-5 w-5" />
        <h1 className="text-center text-base font-medium tracking-wide md:text-lg">
          Evaluasi Kegiatan
        </h1>
      </div>

      <Card className="w-full overflow-hidden rounded-3xl border-white/70 bg-white/85 py-0 shadow-[0_8px_30px_rgb(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
        <CardContent className="p-0">
          {/* Kegiatan info */}
          <div className="border-b border-slate-100 bg-slate-50/70 px-6 py-5">
            <h2 className="text-base font-medium text-slate-800">
              {kuesioner.kegiatanNama}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {kuesioner.templateNama}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            {/* Error message */}
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Respondent info */}
            <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <h3 className="text-sm font-medium text-slate-700">
                Data Peserta
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="nama">
                    Nama <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="nama"
                    placeholder="Nama lengkap"
                    value={namaResponden}
                    onChange={(e) => setNamaResponden(e.target.value)}
                    required
                    maxLength={200}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@contoh.com"
                    value={emailResponden}
                    onChange={(e) => setEmailResponden(e.target.value)}
                    required
                    maxLength={150}
                  />
                </div>
              </div>
            </div>

            {/* Dynamic fields */}
            {sortedFields.map((field) => (
              <FieldRenderer
                key={field.id}
                field={field}
                value={answers[field.id]}
                onChange={(val) => updateAnswer(field.id, val)}
              />
            ))}

            {/* Submit button */}
            <div className="pt-2">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  "Kirim Respons"
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </PageShell>
  );
}

// ─── PAGE SHELL ──────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#dbeafe_0%,_#f8fafc_42%,_#ffffff_100%)] px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
        <div className="mb-6 flex h-20 w-20 items-center justify-center">
          <Image
            src="/iai-logo.png"
            alt="Logo IAI"
            width={80}
            height={80}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        {children}
        <footer className="mt-12 text-center text-xs text-slate-400">
          &copy; {new Date().getFullYear()} IAI Wilayah Jakarta
        </footer>
      </div>
    </main>
  );
}

// ─── FIELD RENDERER ──────────────────────────────────────────────────────────

interface FieldRendererProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ field, value, onChange }: FieldRendererProps) {
  const requiredMark = field.required ? (
    <span className="text-red-500">*</span>
  ) : null;

  switch (field.type) {
    case "text":
      return (
        <div className="space-y-2">
          <Label>{field.label} {requiredMark}</Label>
          <Input
            type="text"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );

    case "textarea":
      return (
        <div className="space-y-2">
          <Label>{field.label} {requiredMark}</Label>
          <Textarea
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            rows={4}
          />
        </div>
      );

    case "number":
      return (
        <div className="space-y-2">
          <Label>{field.label} {requiredMark}</Label>
          <Input
            type="number"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );

    case "email":
      return (
        <div className="space-y-2">
          <Label>{field.label} {requiredMark}</Label>
          <Input
            type="email"
            value={(value as string) ?? ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
          />
        </div>
      );

    case "select":
      return <SelectField field={field} value={value} onChange={onChange} requiredMark={requiredMark} />;

    case "radio":
      return <RadioField field={field} value={value} onChange={onChange} requiredMark={requiredMark} />;

    case "checkbox":
      return <CheckboxField field={field} value={value} onChange={onChange} requiredMark={requiredMark} />;

    case "scale":
      return <ScaleField field={field} value={value} onChange={onChange} requiredMark={requiredMark} />;

    case "grid":
      return <GridField field={field} value={value} onChange={onChange} requiredMark={requiredMark} />;

    default:
      return null;
  }
}

// ─── SELECT FIELD ────────────────────────────────────────────────────────────

function SelectField({
  field,
  value,
  onChange,
  requiredMark,
}: FieldRendererProps & { requiredMark: React.ReactNode }) {
  const config = field.config as OptionsConfig | null;
  const options = config?.options ?? [];

  return (
    <div className="space-y-2">
      <Label>{field.label} {requiredMark}</Label>
      <Select
        value={(value as string) ?? ""}
        onValueChange={(val) => onChange(val)}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Pilih opsi..." />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt, idx) => (
            <SelectItem key={idx} value={opt}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── RADIO FIELD ─────────────────────────────────────────────────────────────

function RadioField({
  field,
  value,
  onChange,
  requiredMark,
}: FieldRendererProps & { requiredMark: React.ReactNode }) {
  const config = field.config as OptionsConfig | null;
  const options = config?.options ?? [];

  return (
    <div className="space-y-2">
      <Label>{field.label} {requiredMark}</Label>
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <label
            key={idx}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-2.5 transition-colors hover:bg-slate-50 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50"
          >
            <input
              type="radio"
              name={field.id}
              value={opt}
              checked={(value as string) === opt}
              onChange={() => onChange(opt)}
              className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-slate-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── CHECKBOX FIELD ──────────────────────────────────────────────────────────

function CheckboxField({
  field,
  value,
  onChange,
  requiredMark,
}: FieldRendererProps & { requiredMark: React.ReactNode }) {
  const config = field.config as OptionsConfig | null;
  const options = config?.options ?? [];
  const selected = (value as string[]) ?? [];

  const toggleOption = (opt: string) => {
    const newSelected = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(newSelected);
  };

  return (
    <div className="space-y-2">
      <Label>{field.label} {requiredMark}</Label>
      <div className="space-y-2">
        {options.map((opt, idx) => (
          <label
            key={idx}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 px-4 py-2.5 transition-colors hover:bg-slate-50 has-[:checked]:border-blue-300 has-[:checked]:bg-blue-50"
          >
            <Checkbox
              checked={selected.includes(opt)}
              onCheckedChange={() => toggleOption(opt)}
            />
            <span className="text-sm text-slate-700">{opt}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ─── SCALE FIELD ─────────────────────────────────────────────────────────────

function ScaleField({
  field,
  value,
  onChange,
  requiredMark,
}: FieldRendererProps & { requiredMark: React.ReactNode }) {
  const config = field.config as ScaleConfig | null;
  if (!config) return null;

  const { min, max, minLabel, maxLabel } = config;
  const scaleValues = Array.from(
    { length: max - min + 1 },
    (_, i) => min + i,
  );

  return (
    <div className="space-y-2">
      <Label>{field.label} {requiredMark}</Label>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
        <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {scaleValues.map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => onChange(String(val))}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border text-sm font-medium transition-all ${
                String(value) === String(val)
                  ? "border-blue-500 bg-blue-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50"
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── GRID FIELD ──────────────────────────────────────────────────────────────

function GridField({
  field,
  value,
  onChange,
  requiredMark,
}: FieldRendererProps & { requiredMark: React.ReactNode }) {
  const config = field.config as GridConfig | null;
  if (!config) return null;

  const { rows, columns } = config;
  const gridAnswers = (value as Record<string, string>) ?? {};

  const updateRow = (rowIdx: number, colValue: string) => {
    const updated = { ...gridAnswers, [String(rowIdx)]: colValue };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      <Label>{field.label} {requiredMark}</Label>
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-4 py-3 text-left font-medium text-slate-600">
                Pernyataan
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className="px-2 py-3 text-center font-medium text-slate-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className="border-b border-slate-50 last:border-0"
              >
                <td className="px-4 py-3 text-slate-700">{row}</td>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-2 py-3 text-center">
                    <input
                      type="radio"
                      name={`${field.id}-row-${rowIdx}`}
                      value={col}
                      checked={gridAnswers[String(rowIdx)] === col}
                      onChange={() => updateRow(rowIdx, col)}
                      className="h-4 w-4 border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
