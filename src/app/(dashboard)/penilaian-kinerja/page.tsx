import Link from "next/link";
import { BarChart2, Calendar, FileText, Plus } from "lucide-react";
import { requirePermission } from "@/server/actions/auth";
import { listPenilaian, listPeriode } from "@/server/actions/penilaianKinerja";
import { PenilaianTable } from "@/components/penilaian-kinerja/PenilaianTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PenilaianKinerjaPage() {
  await requirePermission("penilaianKinerja", "create");
  const [{ rows, total }, periodes] = await Promise.all([
    listPenilaian(),
    listPeriode(),
  ]);

  return (
    <div className="space-y-6">
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Penilaian Kinerja Karyawan</CardTitle>
              <CardDescription className="mt-1">
                Kelola penilaian kinerja karyawan per periode kuartalan.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/penilaian-kinerja/rekap">
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Rekap
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/penilaian-kinerja/periode">
                  <Calendar className="mr-2 h-4 w-4" />
                  Periode
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/penilaian-kinerja/template">
                  <FileText className="mr-2 h-4 w-4" />
                  Template
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/penilaian-kinerja/input">
                  <Plus className="mr-2 h-4 w-4" />
                  Input Penilaian
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <PenilaianTable data={rows} total={total} periodes={periodes} />
        </CardContent>
      </Card>
    </div>
  );
}
