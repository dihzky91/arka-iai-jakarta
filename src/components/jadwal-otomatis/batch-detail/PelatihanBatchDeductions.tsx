"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, ReceiptText, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { DeductionRow } from "@/server/actions/jadwal-otomatis/honorarium";

function formatCurrency(value: number) {
  return `Rp ${Math.round(value).toLocaleString("id-ID")}`;
}

export function PelatihanBatchDeductions({
  deductions,
  uniqueInstructors,
  canManage,
  isDraft,
  isPending,
  onAddDeduction,
  onRemoveDeduction,
}: {
  deductions: DeductionRow[];
  uniqueInstructors: { id: string; name: string }[];
  canManage: boolean;
  isDraft: boolean;
  isPending: boolean;
  onAddDeduction: (data: {
    instructorId: string;
    deductionType: "pph21" | "pph23" | "other";
    description: string;
    amount: number;
  }) => void;
  onRemoveDeduction: (deductionId: string) => void;
}) {
  const [newInstructor, setNewInstructor] = useState("");
  const [newType, setNewType] = useState<"pph21" | "pph23" | "other">("pph21");
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");

  function handleAdd() {
    if (!newInstructor || !newDesc || !newAmount) return;
    const amount = Number.parseFloat(newAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    onAddDeduction({
      instructorId: newInstructor,
      deductionType: newType,
      description: newDesc.trim(),
      amount,
    });
    setNewInstructor("");
    setNewType("pph21");
    setNewDesc("");
    setNewAmount("");
  }

  const total = deductions.reduce((sum, d) => sum + d.amount, 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>Potongan</CardTitle>
            <CardDescription>
              PPh 21, PPh 23, atau potongan lainnya per instruktur.
            </CardDescription>
          </div>
          <div className="text-right text-sm font-semibold text-foreground">
            Total: {formatCurrency(total)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {deductions.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Belum ada potongan"
            description="Potongan PPh atau potongan lain per instruktur akan tampil di sini setelah ditambahkan."
          />
        ) : (
          <div className="space-y-3">
            {deductions.map((d) => (
              <div
                key={d.id}
                className="rounded-lg border border-border/60 p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {d.instructorName}
                      </p>
                      <Badge variant="outline">
                        {d.deductionType === "pph21"
                          ? "PPh 21"
                          : d.deductionType === "pph23"
                            ? "PPh 23"
                            : "Lainnya"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {d.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-destructive">
                      {formatCurrency(d.amount)}
                    </p>
                    {canManage && isDraft ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveDeduction(d.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      {canManage && isDraft ? (
        <CardFooter className="border-t border-border/60 px-6 py-4">
          <div className="grid gap-3 w-full md:grid-cols-[200px_130px_1fr_130px_auto] md:items-end">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Instruktur</p>
              <Select
                value={newInstructor}
                onValueChange={setNewInstructor}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih instruktur" />
                </SelectTrigger>
                <SelectContent>
                  {uniqueInstructors.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Tipe</p>
              <Select
                value={newType}
                onValueChange={(v) =>
                  setNewType(v as "pph21" | "pph23" | "other")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pph21">PPh 21</SelectItem>
                  <SelectItem value="pph23">PPh 23</SelectItem>
                  <SelectItem value="other">Lainnya</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Keterangan</p>
              <Input
                placeholder="Misal: PPh 21 atas honor"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">
                Jumlah (Rp)
              </p>
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <Button
              onClick={handleAdd}
              disabled={isPending || !newInstructor || !newDesc || !newAmount}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              Tambah
            </Button>
          </div>
        </CardFooter>
      ) : null}
    </Card>
  );
}
