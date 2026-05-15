"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bulkCreateTemplateItems } from "@/server/actions/penilaianKinerja";
import type { PenilaianTemplateItem } from "@/server/db/schema";

interface ItemRow {
  id?: number;
  nomor: number;
  keterangan: string;
  bobot: number;
}

interface TemplateItemEditorProps {
  templateId: number;
  initialItems: PenilaianTemplateItem[];
  totalBobot: number;
}

export function TemplateItemEditor({
  templateId,
  initialItems,
  totalBobot: initialTotalBobot,
}: TemplateItemEditorProps) {
  const router = useRouter();
  const [items, setItems] = useState<ItemRow[]>(
    initialItems.map((item) => ({
      id: item.id,
      nomor: item.nomor,
      keterangan: item.keterangan,
      bobot: parseFloat(item.bobot),
    })),
  );
  const [saving, setSaving] = useState(false);

  const totalBobot = items.reduce((sum, item) => sum + (item.bobot || 0), 0);
  const bobotValid = Math.abs(totalBobot - 1.0) < 0.001;

  function addItem() {
    const nextNomor = items.length > 0 ? Math.max(...items.map((i) => i.nomor)) + 1 : 1;
    setItems([...items, { nomor: nextNomor, keterangan: "", bobot: 0.05 }]);
  }

  function removeItem(index: number) {
    setItems(items.filter((_, i) => i !== index));
  }

  function updateItem(index: number, field: keyof ItemRow, value: string | number) {
    setItems(
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  }

  async function handleSave() {
    // Validate
    const emptyItems = items.filter((i) => !i.keterangan.trim());
    if (emptyItems.length > 0) {
      toast.error("Semua item harus memiliki keterangan");
      return;
    }

    if (items.length === 0) {
      toast.error("Minimal 1 item diperlukan");
      return;
    }

    setSaving(true);
    try {
      await bulkCreateTemplateItems({
        templateId,
        items: items.map((item, idx) => ({
          nomor: idx + 1,
          keterangan: item.keterangan,
          bobot: item.bobot,
        })),
      });
      toast.success("Item template berhasil disimpan");
      router.refresh();
    } catch (err) {
      toast.error("Gagal menyimpan item template");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Bobot indicator */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Total Bobot:</span>
        <Badge
          variant={bobotValid ? "default" : "destructive"}
          className="gap-1"
        >
          {bobotValid ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <AlertTriangle className="h-3 w-3" />
          )}
          {totalBobot.toFixed(3)}
        </Badge>
        {!bobotValid && (
          <span className="text-sm text-muted-foreground">
            (harus = 1.000)
          </span>
        )}
      </div>

      {/* Items table */}
      <div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">No</TableHead>
              <TableHead>Keterangan</TableHead>
              <TableHead className="w-28">Bobot</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center text-muted-foreground py-8"
                >
                  Belum ada item. Klik &quot;Tambah Item&quot; untuk memulai.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={item.nomor}
                      onChange={(e) =>
                        updateItem(index, "nomor", parseInt(e.target.value) || 1)
                      }
                      className="w-14 h-8 text-center"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.keterangan}
                      onChange={(e) =>
                        updateItem(index, "keterangan", e.target.value)
                      }
                      placeholder="Deskripsi kriteria penilaian..."
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.005"
                      min="0.001"
                      max="1"
                      value={item.bobot}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "bobot",
                          parseFloat(e.target.value) || 0,
                        )
                      }
                      className="w-24 h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeItem(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={addItem}>
          <Plus className="mr-2 h-4 w-4" />
          Tambah Item
        </Button>

        <Button onClick={handleSave} disabled={saving || items.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Menyimpan..." : "Simpan Semua"}
        </Button>
      </div>
    </div>
  );
}
