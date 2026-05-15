"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  PeriodeRow,
  TemplateRow,
  KaryawanOption,
} from "@/server/actions/penilaianKinerja";
import {
  createPenilaian,
  getTemplateItemsForForm,
  savePenilaianDraft,
  submitPenilaian,
} from "@/server/actions/penilaianKinerja";
import type { PenilaianTemplateItem } from "@/server/db/schema";

interface NilaiItem {
  templateItemId: number;
  tipe: "tugas" | "perilaku";
  nomor: number;
  keterangan: string;
  bobot: number;
  nilai: number;
  keteranganNilai: string;
}

interface PenilaianInputFormProps {
  periodes: PeriodeRow[];
  tugasTemplates: TemplateRow[];
  perilakuTemplates: TemplateRow[];
  karyawan: KaryawanOption[];
}

export function PenilaianInputForm({
  periodes,
  tugasTemplates,
  perilakuTemplates,
  karyawan,
}: PenilaianInputFormProps) {
  const router = useRouter();

  const [periodeId, setPeriodeId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [tugasTemplateId, setTugasTemplateId] = useState<string>("");
  const [perilakuTemplateId, setPerilakuTemplateId] = useState<string>("");
  const [catatan, setCatatan] = useState("");

  const [tugasItems, setTugasItems] = useState<NilaiItem[]>([]);
  const [perilakuItems, setPerilakuItems] = useState<NilaiItem[]>([]);

  const [penilaianId, setPenilaianId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingItems, setLoadingItems] = useState(false);

  // Load template items when template is selected
  const loadTemplateItems = useCallback(
    async (templateId: string, tipe: "tugas" | "perilaku") => {
      if (!templateId) return;
      setLoadingItems(true);
      try {
        const items = await getTemplateItemsForForm(parseInt(templateId));
        const nilaiItems: NilaiItem[] = items.map((item) => ({
          templateItemId: item.id,
          tipe,
          nomor: item.nomor,
          keterangan: item.keterangan,
          bobot: parseFloat(item.bobot),
          nilai: 0,
          keteranganNilai: "",
        }));
        if (tipe === "tugas") {
          setTugasItems(nilaiItems);
        } else {
          setPerilakuItems(nilaiItems);
        }
      } catch {
        toast.error("Gagal memuat item template");
      } finally {
        setLoadingItems(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (tugasTemplateId) loadTemplateItems(tugasTemplateId, "tugas");
  }, [tugasTemplateId, loadTemplateItems]);

  useEffect(() => {
    if (perilakuTemplateId) loadTemplateItems(perilakuTemplateId, "perilaku");
  }, [perilakuTemplateId, loadTemplateItems]);

  // Auto-select default perilaku template
  useEffect(() => {
    const defaultPerilaku = perilakuTemplates.find((t) => t.isDefault);
    if (defaultPerilaku && !perilakuTemplateId) {
      setPerilakuTemplateId(String(defaultPerilaku.id));
    }
  }, [perilakuTemplates, perilakuTemplateId]);

  function updateNilai(
    tipe: "tugas" | "perilaku",
    index: number,
    field: "nilai" | "keteranganNilai",
    value: number | string,
  ) {
    const setter = tipe === "tugas" ? setTugasItems : setPerilakuItems;
    setter((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  const totalTugas = tugasItems.reduce(
    (sum, i) => sum + i.nilai * i.bobot,
    0,
  );
  const totalPerilaku = perilakuItems.reduce(
    (sum, i) => sum + i.nilai * i.bobot,
    0,
  );
  const componentCount = (tugasItems.length > 0 ? 1 : 0) + (perilakuItems.length > 0 ? 1 : 0);
  const nilaiAkhir = componentCount > 0 ? (totalTugas + totalPerilaku) / componentCount : 0;

  async function handleCreateAndSave(submit: boolean) {
    if (!periodeId || !userId) {
      toast.error("Pilih periode dan karyawan terlebih dahulu");
      return;
    }
    if (tugasItems.length === 0 && perilakuItems.length === 0) {
      toast.error("Pilih minimal satu template");
      return;
    }

    setLoading(true);
    try {
      // Create penilaian if not yet created
      let id = penilaianId;
      if (!id) {
        const result = await createPenilaian({
          periodeId: parseInt(periodeId),
          userId,
          templateTugasId: tugasTemplateId ? parseInt(tugasTemplateId) : null,
          templatePerilakuId: perilakuTemplateId
            ? parseInt(perilakuTemplateId)
            : null,
        });
        if (!result.ok) {
          toast.error(result.error ?? "Gagal membuat penilaian");
          return;
        }
        id = result.id!;
        setPenilaianId(id);
      }

      const allItems = [...tugasItems, ...perilakuItems].map((item) => ({
        templateItemId: item.templateItemId,
        tipe: item.tipe,
        nilai: item.nilai,
        bobot: item.bobot,
        keterangan: item.keteranganNilai || undefined,
      }));

      if (submit) {
        const result = await submitPenilaian({
          id,
          items: allItems,
          catatan: catatan || undefined,
        });
        if (result.ok) {
          toast.success("Penilaian berhasil disubmit");
          router.push("/penilaian-kinerja");
        } else {
          toast.error(result.error ?? "Gagal submit penilaian");
        }
      } else {
        const result = await savePenilaianDraft({
          id,
          items: allItems,
          catatan: catatan || undefined,
        });
        if (result.ok) {
          toast.success("Draft berhasil disimpan");
        } else {
          toast.error(result.error ?? "Gagal menyimpan draft");
        }
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pilih Karyawan & Periode</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label>Periode</Label>
            <Select value={periodeId} onValueChange={setPeriodeId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih periode" />
              </SelectTrigger>
              <SelectContent>
                {periodes.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Karyawan</Label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih karyawan" />
              </SelectTrigger>
              <SelectContent>
                {karyawan.map((k) => (
                  <SelectItem key={k.id} value={k.id}>
                    {k.namaLengkap}
                    {k.jabatan ? ` — ${k.jabatan}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Template Tugas</Label>
            <Select value={tugasTemplateId} onValueChange={setTugasTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder="Pilih template" />
              </SelectTrigger>
              <SelectContent>
                {tugasTemplates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nama}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Template Perilaku</Label>
            <Select
              value={perilakuTemplateId}
              onValueChange={setPerilakuTemplateId}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih template" />
              </SelectTrigger>
              <SelectContent>
                {perilakuTemplates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.nama} {t.isDefault ? "(Default)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tugas Section */}
      {tugasItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Penilaian Pelaksanaan Tugas</CardTitle>
            <CardDescription>
              Total Nilai Terbobot:{" "}
              <span className="font-mono font-semibold">
                {totalTugas.toFixed(1)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NilaiTable
              items={tugasItems}
              tipe="tugas"
              onUpdateNilai={updateNilai}
            />
          </CardContent>
        </Card>
      )}

      {/* Perilaku Section */}
      {perilakuItems.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Penilaian Perilaku</CardTitle>
            <CardDescription>
              Total Nilai Terbobot:{" "}
              <span className="font-mono font-semibold">
                {totalPerilaku.toFixed(1)}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <NilaiTable
              items={perilakuItems}
              tipe="perilaku"
              onUpdateNilai={updateNilai}
            />
          </CardContent>
        </Card>
      )}

      {/* Summary & Actions */}
      {(tugasItems.length > 0 || perilakuItems.length > 0) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Badge variant="outline" className="text-base px-3 py-1">
                    Tugas: {totalTugas.toFixed(1)}
                  </Badge>
                  <Badge variant="outline" className="text-base px-3 py-1">
                    Perilaku: {totalPerilaku.toFixed(1)}
                  </Badge>
                  <Badge className="text-base px-3 py-1">
                    Nilai Akhir: {nilaiAkhir.toFixed(1)}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <Label>Catatan (opsional)</Label>
                  <Textarea
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Catatan umum untuk penilaian ini..."
                    rows={2}
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleCreateAndSave(false)}
                  disabled={loading}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Draft
                </Button>
                <Button
                  onClick={() => handleCreateAndSave(true)}
                  disabled={loading}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Submit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {loadingItems && (
        <div className="text-center text-muted-foreground py-4">
          Memuat item template...
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: NilaiTable ────────────────────────────────────────────────

function NilaiTable({
  items,
  tipe,
  onUpdateNilai,
}: {
  items: NilaiItem[];
  tipe: "tugas" | "perilaku";
  onUpdateNilai: (
    tipe: "tugas" | "perilaku",
    index: number,
    field: "nilai" | "keteranganNilai",
    value: number | string,
  ) => void;
}) {
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">No</TableHead>
            <TableHead>Keterangan</TableHead>
            <TableHead className="w-20">Bobot</TableHead>
            <TableHead className="w-24">Nilai</TableHead>
            <TableHead className="w-28">Terbobot</TableHead>
            <TableHead className="w-48">Keterangan</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <TableRow key={item.templateItemId}>
              <TableCell className="text-center">{item.nomor}</TableCell>
              <TableCell className="text-sm">{item.keterangan}</TableCell>
              <TableCell className="text-center font-mono">
                {item.bobot.toFixed(2)}
              </TableCell>
              <TableCell>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={item.nilai || ""}
                  onChange={(e) =>
                    onUpdateNilai(
                      tipe,
                      index,
                      "nilai",
                      Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                    )
                  }
                  className="h-8 w-20 text-center"
                />
              </TableCell>
              <TableCell className="font-mono text-center">
                {(item.nilai * item.bobot).toFixed(1)}
              </TableCell>
              <TableCell>
                <Input
                  value={item.keteranganNilai}
                  onChange={(e) =>
                    onUpdateNilai(tipe, index, "keteranganNilai", e.target.value)
                  }
                  placeholder="Opsional"
                  className="h-8"
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
