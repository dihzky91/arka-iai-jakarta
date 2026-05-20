import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Calendar,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  FolderKanban,
  MapPin,
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getKegiatan } from "@/server/actions/ppl-evaluasi/kegiatan";
import { getProjectByKegiatanId } from "@/server/actions/ppl-evaluasi/project-sync";
import { getEmbeddedProjectData } from "@/server/actions/ppl-evaluasi/project-embedded";
import { SaveKegiatanAsTemaButton } from "@/components/ppl-evaluasi/SaveKegiatanAsTemaButton";
import { EmbeddedProjectView } from "@/components/ppl-evaluasi/EmbeddedProjectView";

export const metadata: Metadata = {
  title: "Detail Kegiatan PPL | ARKA",
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const numericId = Number(id);

  if (Number.isNaN(numericId)) notFound();

  const kegiatan = await getKegiatan(numericId);

  if (!kegiatan) notFound();

  const linkedProject = await getProjectByKegiatanId(numericId).catch(() => null);
  const embeddedProject = linkedProject
    ? await getEmbeddedProjectData(numericId).catch(() => null)
    : null;

  const conversionRateDisplay =
    kegiatan.pendaftar === 0
      ? "N/A"
      : `${kegiatan.conversionRate?.toFixed(1)}%`;

  const showWarningBadge = kegiatan.realisasiHadir > kegiatan.pendaftar;

  return (
    <PageWrapper
      title={kegiatan.namaKegiatan}
      description={`Kategori: ${kegiatan.kategoriPpl}`}
    >
      {/* Back button */}
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href="/ppl-evaluasi">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Kegiatan
          </Link>
        </Button>
      </div>

      {/* Kegiatan Details */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Info Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informasi Kegiatan</CardTitle>
            <CardDescription>Detail lengkap kegiatan PPL</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Nama Kegiatan
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {kegiatan.namaKegiatan}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Kategori PPL
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {kegiatan.kategoriPpl}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Tipe Pelaksanaan
                </dt>
                <dd className="mt-1">
                  <Badge variant="secondary" className="capitalize">
                    {kegiatan.tipePelaksanaan}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Status
                </dt>
                <dd className="mt-1">
                  <Badge
                    variant={
                      kegiatan.statusEvent === "aktif"
                        ? "default"
                        : "destructive"
                    }
                  >
                    {kegiatan.statusEvent === "aktif" ? "Aktif" : "Diarsipkan"}
                  </Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Tanggal Mulai
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {format(parseISO(kegiatan.tanggalMulai), "d MMMM yyyy", {
                    locale: localeId,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Tanggal Selesai
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {format(parseISO(kegiatan.tanggalSelesai), "d MMMM yyyy", {
                    locale: localeId,
                  })}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  Lokasi
                </dt>
                <dd className="mt-1 text-sm text-foreground">
                  {kegiatan.lokasi ?? "-"}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  SKP
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {kegiatan.skp} SKP
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {/* Attendance Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Kehadiran
            </CardTitle>
            <CardDescription>Registrasi &amp; realisasi hadir</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Pendaftar
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-foreground">
                  {kegiatan.pendaftar.toLocaleString("id-ID")}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Realisasi Hadir
                </dt>
                <dd className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-semibold text-foreground">
                    {kegiatan.realisasiHadir.toLocaleString("id-ID")}
                  </span>
                  {showWarningBadge && (
                    <Badge
                      variant="destructive"
                      className="flex items-center gap-1"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Melebihi pendaftar
                    </Badge>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-muted-foreground">
                  Conversion Rate
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-foreground">
                  {conversionRateDisplay}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Simpan sebagai Tema */}
      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Bank Tema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Simpan sebagai Tema</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Simpan kegiatan ini ke Bank Tema untuk digunakan kembali di masa depan.
              </p>
            </div>
            <SaveKegiatanAsTemaButton kegiatanId={kegiatan.id} />
          </div>
        </CardContent>
      </Card>

      {/* Project Kolaborasi — Embedded View */}
      {embeddedProject && (
        <div className="mt-4">
          <EmbeddedProjectView data={embeddedProject} />
        </div>
      )}

      {/* Fallback: simple link if embedded data failed but project exists */}
      {!embeddedProject && linkedProject && (
        <Card className="mt-4">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderKanban className="h-4 w-4" />
              Project Kolaborasi
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{linkedProject.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Koordinasi tim, tasks, dan dokumen kegiatan ini
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${linkedProject.id}`}>
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />
                  Buka Project
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for sub-pages */}
      <Tabs defaultValue="kuesioner" className="mt-6">
        <TabsList>
          <TabsTrigger value="kuesioner" asChild>
            <Link href={`/ppl-evaluasi/${kegiatan.id}/kuesioner`}>
              <ClipboardList className="h-4 w-4 mr-1" />
              Kuesioner
            </Link>
          </TabsTrigger>
          <TabsTrigger value="responses" asChild>
            <Link href={`/ppl-evaluasi/${kegiatan.id}/responses`}>
              Responses
            </Link>
          </TabsTrigger>
          <TabsTrigger value="attendance" asChild>
            <Link href={`/ppl-evaluasi/${kegiatan.id}/attendance`}>
              Attendance
            </Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </PageWrapper>
  );
}
