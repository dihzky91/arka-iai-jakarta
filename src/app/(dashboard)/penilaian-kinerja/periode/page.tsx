import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/server/actions/auth";
import { listPeriode } from "@/server/actions/penilaianKinerja";
import { PeriodeManager } from "@/components/penilaian-kinerja/PeriodeManager";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function PeriodePenilaianPage() {
  await requirePermission("penilaianKinerja", "manage");
  const periodes = await listPeriode();

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
          <CardTitle>Periode Penilaian</CardTitle>
          <CardDescription>
            Kelola periode penilaian kinerja kuartalan.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <PeriodeManager initialData={periodes} />
        </CardContent>
      </Card>
    </div>
  );
}
