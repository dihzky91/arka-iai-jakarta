import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/server/actions/auth";
import {
  listPeriode,
  listTemplates,
  listKaryawanForPenilaian,
} from "@/server/actions/penilaianKinerja";
import { PenilaianInputForm } from "@/components/penilaian-kinerja/PenilaianInputForm";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PenilaianInputPage() {
  await requirePermission("penilaianKinerja", "create");

  const [periodes, templates, karyawan] = await Promise.all([
    listPeriode(),
    listTemplates(),
    listKaryawanForPenilaian(),
  ]);

  const openPeriodes = periodes.filter((p) => p.status === "open");
  const tugasTemplates = templates.filter((t) => t.tipe === "tugas");
  const perilakuTemplates = templates.filter((t) => t.tipe === "perilaku");

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/penilaian-kinerja">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Penilaian Kinerja
          </Link>
        </Button>
      </div>

      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Input Penilaian Kinerja</CardTitle>
          <CardDescription>
            Pilih karyawan dan periode, lalu isi nilai penilaian.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PenilaianInputForm
            periodes={openPeriodes}
            tugasTemplates={tugasTemplates}
            perilakuTemplates={perilakuTemplates}
            karyawan={karyawan}
          />
        </CardContent>
      </Card>
    </div>
  );
}
