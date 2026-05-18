import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ClipboardList, FileText, Link2, Plus } from "lucide-react";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listTemplates } from "@/server/actions/ppl-evaluasi/kuesioner";

export const metadata: Metadata = {
  title: "Kuesioner | PPL Evaluasi | ARKA",
};

export default async function KuesionerPage() {
  const templates = await listTemplates();

  return (
    <PageWrapper
      title="Kuesioner Evaluasi"
      description="Kelola template kuesioner evaluasi untuk kegiatan PPL."
    >
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Template Kuesioner
              </CardTitle>
              <CardDescription className="mt-1">
                Buat dan kelola template kuesioner. Template bisa di-link ke kegiatan PPL untuk mengumpulkan evaluasi peserta.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {templates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium">Belum ada template kuesioner</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Buat template kuesioner dari halaman detail kegiatan PPL.
              </p>
              <Button asChild className="mt-4" variant="outline">
                <Link href="/ppl-evaluasi">
                  <Plus className="h-4 w-4 mr-1" />
                  Buka Kegiatan PPL
                </Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Template</TableHead>
                    <TableHead className="text-center">Jumlah Field</TableHead>
                    <TableHead className="text-center">Digunakan</TableHead>
                    <TableHead>Terakhir Diubah</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell>
                        <span className="font-medium">{template.nama}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs">
                          {template.fieldCount} field
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {template.linkedKegiatanCount > 0 ? (
                          <Badge variant="outline" className="text-xs">
                            <Link2 className="h-3 w-3 mr-1" />
                            {template.linkedKegiatanCount} kegiatan
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {template.updatedAt
                          ? format(template.updatedAt, "d MMM yyyy", { locale: localeId })
                          : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <p className="mt-4 text-xs text-muted-foreground">
                {templates.length} template · Untuk membuat atau mengedit template, buka detail kegiatan PPL → tab Kuesioner.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
