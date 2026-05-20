import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  BookOpen,
  Calendar,
  ChevronLeft,
  Clock,
  List,
  Target,
  Users,
} from "lucide-react";
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
import { getTema } from "@/server/actions/ppl-evaluasi/tema-bank";

export const metadata: Metadata = {
  title: "Detail Tema | ARKA",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TemaDetailPage({ params }: Props) {
  const { id } = await params;
  const numericId = Number(id);
  if (Number.isNaN(numericId)) notFound();

  const tema = await getTema(numericId);
  if (!tema) notFound();

  return (
    <PageWrapper
      title={tema.namaTema}
      description={`Kategori: ${tema.kategoriPpl}`}
    >
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/ppl-evaluasi/tema">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Bank Tema
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {/* Main Info */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Informasi Tema</CardTitle>
            <CardDescription>Detail lengkap tema kegiatan PPL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <Badge>{tema.kategoriPpl}</Badge>
              {tema.tipePelaksanaanDefault && (
                <Badge variant="secondary" className="capitalize">
                  {tema.tipePelaksanaanDefault}
                </Badge>
              )}
              <Badge variant="outline">
                <Clock className="h-3 w-3 mr-1" />
                {tema.durasiHari} hari
              </Badge>
              <Badge variant="outline">
                Digunakan {tema.usageCount}x
              </Badge>
            </div>

            {tema.latarBelakang && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1">Latar Belakang</h3>
                <p className="text-sm whitespace-pre-wrap">{tema.latarBelakang}</p>
              </div>
            )}

            {tema.targetPeserta && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-1">
                  <Target className="h-3.5 w-3.5" />
                  Target Peserta
                </h3>
                <p className="text-sm">{tema.targetPeserta}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-medium text-muted-foreground">Dibuat</h4>
                <p className="text-sm">
                  {tema.createdAt
                    ? format(tema.createdAt, "d MMM yyyy", { locale: localeId })
                    : "-"}
                </p>
              </div>
              <div>
                <h4 className="text-xs font-medium text-muted-foreground">Terakhir Diubah</h4>
                <p className="text-sm">
                  {tema.updatedAt
                    ? format(tema.updatedAt, "d MMM yyyy", { locale: localeId })
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Statistik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <List className="h-3 w-3" />
                Susunan Materi
              </p>
              <p className="text-2xl font-semibold">{tema.susunanMateri.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <BookOpen className="h-3 w-3" />
                Benefit
              </p>
              <p className="text-2xl font-semibold">{tema.benefit.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                Narasumber Rekomendasi
              </p>
              <p className="text-2xl font-semibold">{tema.rekomendasiNarasumberIds.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Template Evaluasi
              </p>
              <p className="text-2xl font-semibold">{tema.defaultTemplateIds.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Susunan Materi */}
      {tema.susunanMateri.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Susunan Materi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tema.susunanMateri
                .sort((a, b) => a.urutan - b.urutan)
                .map((materi, idx) => (
                  <div key={idx} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                      {materi.urutan}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{materi.judul}</p>
                      {materi.deskripsi && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{materi.deskripsi}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {materi.durasiMenit} menit
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Benefit */}
      {tema.benefit.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Benefit</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tema.benefit.map((b, idx) => (
                <li key={idx} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 text-green-600">✓</span>
                  {b}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Tags */}
      {tema.tags.length > 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-base">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tema.tags.map((tag, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </PageWrapper>
  );
}
