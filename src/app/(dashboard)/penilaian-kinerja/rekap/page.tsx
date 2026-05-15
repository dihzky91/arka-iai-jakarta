import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/server/actions/auth";
import { listPeriode } from "@/server/actions/penilaianKinerja";
import { RekapDashboard } from "@/components/penilaian-kinerja/RekapDashboard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function RekapPenilaianPage() {
  await requirePermission("penilaianKinerja", "export");
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
          <CardTitle>Rekap Penilaian Kinerja</CardTitle>
          <CardDescription>
            Dashboard ringkasan dan perbandingan penilaian kinerja per periode.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <RekapDashboard periodes={periodes} />
        </CardContent>
      </Card>
    </div>
  );
}
