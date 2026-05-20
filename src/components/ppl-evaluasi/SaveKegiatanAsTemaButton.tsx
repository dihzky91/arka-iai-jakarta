"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveKegiatanAsTema } from "@/server/actions/ppl-evaluasi/tema-bank";

interface Props {
  kegiatanId: number;
}

export function SaveKegiatanAsTemaButton({ kegiatanId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      const result = await saveKegiatanAsTema(kegiatanId);
      if (result.ok && result.data) {
        toast.success("Kegiatan berhasil disimpan sebagai tema");
        setDialogOpen(false);
        router.push(`/ppl-evaluasi/tema/${result.data.id}`);
      } else {
        toast.error(result.error ?? "Gagal menyimpan tema");
      }
    });
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
        <BookOpen className="h-3.5 w-3.5 mr-1" />
        Simpan sebagai Tema
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Simpan sebagai Tema</DialogTitle>
            <DialogDescription>
              Kegiatan ini akan disimpan ke Bank Tema PPL.
              Data kegiatan (nama, kategori, narasumber, template evaluasi) akan otomatis disalin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? "Menyimpan..." : "Simpan sebagai Tema"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
