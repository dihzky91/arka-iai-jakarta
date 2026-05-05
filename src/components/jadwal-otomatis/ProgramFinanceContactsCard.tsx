"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateProgramFinanceContact } from "@/server/actions/jadwal-otomatis/programs";

type ProgramRow = {
  id: string;
  name: string;
  code: string;
  financeContactName: string | null;
  financeWhatsappNumber: string | null;
};

interface ProgramFinanceContactsCardProps {
  programs: ProgramRow[];
  canConfigure: boolean;
}

export function ProgramFinanceContactsCard({
  programs,
  canConfigure,
}: ProgramFinanceContactsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, { contactName: string; whatsappNumber: string }>>(
    () =>
      Object.fromEntries(
        programs.map((program) => [
          program.id,
          {
            contactName: program.financeContactName ?? "",
            whatsappNumber: program.financeWhatsappNumber ?? "",
          },
        ]),
      ),
  );

  const hasData = useMemo(() => programs.length > 0, [programs.length]);

  function updateDraft(
    programId: string,
    key: "contactName" | "whatsappNumber",
    value: string,
  ) {
    setDrafts((prev) => ({
      ...prev,
      [programId]: {
        contactName: prev[programId]?.contactName ?? "",
        whatsappNumber: prev[programId]?.whatsappNumber ?? "",
        [key]: value,
      },
    }));
  }

  function handleSave(programId: string, programName: string) {
    if (!canConfigure) return;
    const draft = drafts[programId] ?? { contactName: "", whatsappNumber: "" };

    startTransition(async () => {
      const result = await updateProgramFinanceContact({
        programId,
        financeContactName: draft.contactName,
        financeWhatsappNumber: draft.whatsappNumber,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan kontak keuangan program.");
        return;
      }
      toast.success(`Kontak keuangan program ${programName} diperbarui.`);
    });
  }

  return (
    <Card className="rounded-[28px]">
      <CardHeader className="border-b border-border">
        <CardTitle>Default Kontak Keuangan per Program</CardTitle>
        <CardDescription>
          Dipakai sebagai fallback kedua setelah override kelas.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <p className="text-sm text-muted-foreground">Belum ada program aktif.</p>
        ) : (
          <div className="space-y-4">
            {programs.map((program) => {
              const draft = drafts[program.id] ?? {
                contactName: "",
                whatsappNumber: "",
              };
              return (
                <div
                  key={program.id}
                  className="rounded-2xl border border-border bg-muted/20 p-4"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{program.name}</p>
                      <p className="text-xs text-muted-foreground">{program.code}</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleSave(program.id, program.name)}
                      disabled={isPending || !canConfigure}
                    >
                      {isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-2 h-4 w-4" />
                      )}
                      Simpan
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Input
                      placeholder="Nama kontak keuangan program"
                      value={draft.contactName}
                      maxLength={200}
                      onChange={(event) =>
                        updateDraft(program.id, "contactName", event.target.value)
                      }
                      disabled={!canConfigure}
                    />
                    <Input
                      placeholder="Nomor WA (contoh: 6281234567890)"
                      value={draft.whatsappNumber}
                      maxLength={30}
                      onChange={(event) =>
                        updateDraft(program.id, "whatsappNumber", event.target.value)
                      }
                      disabled={!canConfigure}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
