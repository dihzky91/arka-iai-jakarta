import type { Metadata } from "next";
import Image from "next/image";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationSearchForm } from "@/components/sertifikat/VerificationSearchForm";
import { verifyByNoSertifikat } from "@/server/actions/sertifikat/verifikasi";

export const metadata: Metadata = {
  title: "Hasil Verifikasi Dokumen | ARKA",
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ noSertifikat: string }>;
};

function formatDateIndo(date: string) {
  return format(new Date(`${date}T00:00:00+07:00`), "d MMMM yyyy", {
    locale: localeId,
  });
}

function formatDateRange(start: string, end: string) {
  if (start === end) return formatDateIndo(start);
  return `${formatDateIndo(start)} - ${formatDateIndo(end)}`;
}

export default async function Page({ params }: PageProps) {
  const { noSertifikat } = await params;
  const result = await verifyByNoSertifikat(noSertifikat);
  const decodedNo = decodeURIComponent(noSertifikat);

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#dbeafe_0%,_#f8fafc_42%,_#ffffff_100%)] px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <header className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/iai-logo.png"
            alt="Logo IAI"
            width={112}
            height={112}
            className="h-28 w-28 object-contain"
            priority
          />
        </header>

        <div className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white shadow-md">
          <CheckCircle2 className="h-6 w-6" />
          <h1 className="text-center text-lg font-medium tracking-wide md:text-xl">
            Verifikasi Dokumen
          </h1>
        </div>

        {result.found ? (
          <p className="mb-6 text-center text-slate-600">
            Manajemen Eksekutif Ikatan Akuntan Indonesia Wilayah Jakarta
            menyatakan bahwa:
          </p>
        ) : null}

        <Card className="w-full overflow-hidden rounded-3xl border-white/70 bg-white/85 py-0 shadow-[0_8px_30px_rgb(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-slate-50/70 p-6">
              <VerificationSearchForm initialValue={decodedNo} />
            </div>

            {result.found ? (
              <div className="bg-slate-50 p-4 md:p-8">
                <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-2 bg-linear-to-r from-blue-600 to-blue-400" />
                  <div className="space-y-8 p-6 md:p-8">
                    <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="mb-2 text-sm font-normal tracking-wider text-slate-400 uppercase">
                          Pemilik Sertifikat
                        </p>
                        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                          {result.data.nama}
                        </h2>
                        <p className="mt-2 font-mono text-lg font-medium text-blue-600">
                          {result.data.noSertifikat}
                        </p>
                      </div>
                      <div className="inline-flex w-fit flex-col items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 p-3">
                        <CheckCircle2 className="mb-1 h-8 w-8 text-emerald-600" />
                        <span className="text-xs font-medium tracking-wide text-emerald-700 uppercase">
                          Terverifikasi
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100" />

                    <div className="grid grid-cols-1 gap-x-12 gap-y-6 md:grid-cols-2">
                      <div className="space-y-6">
                        <Detail
                          label="Kegiatan"
                          value={result.data.kegiatan.namaKegiatan}
                          strong
                        />
                        <div>
                          <p className="mb-2 text-xs font-normal tracking-wide text-slate-400 uppercase">
                            Kategori
                          </p>
                          <Badge className="border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                            {result.data.kegiatan.kategori}
                          </Badge>
                        </div>
                        <div>
                          <p className="mb-2 text-xs font-normal tracking-wide text-slate-400 uppercase">
                            Sebagai
                          </p>
                          <Badge variant="secondary" className="px-3 py-1">
                            {result.data.role || "Peserta"}
                          </Badge>
                        </div>
                      </div>

                      <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                          <Detail
                            label="Tanggal"
                            value={formatDateRange(
                              result.data.kegiatan.tanggalMulai,
                              result.data.kegiatan.tanggalSelesai,
                            )}
                            strong
                          />
                          <Detail
                            label="Jumlah SKP"
                            value={
                              result.data.kegiatan.skp
                                ? `${result.data.kegiatan.skp} SKP`
                                : "-"
                            }
                            strong
                          />
                        </div>
                        <Detail
                          label="Lokasi"
                          value={result.data.kegiatan.lokasi ?? "-"}
                          strong
                        />
                      </div>
                    </div>

                    <section className="border-t border-slate-100 pt-6">
                      <p className="mb-4 text-xs font-normal tracking-wide text-slate-400 uppercase">
                        Penandatangan
                      </p>
                      {result.data.signatories.length > 0 ? (
                        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                          {result.data.signatories.map((signatory) => (
                            <div key={signatory.id}>
                              <p className="inline-block min-w-48 border-b-2 border-slate-200 pb-1 text-lg font-medium leading-tight text-slate-950">
                                {signatory.nama}
                              </p>
                              {signatory.jabatan ? (
                                <p className="mt-2 text-sm font-medium text-slate-500">
                                  {signatory.jabatan}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">-</p>
                      )}
                    </section>

                    {result.data.kegiatan.keterangan ? (
                      <div className="rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                        <span className="font-medium">Keterangan:</span>{" "}
                        {result.data.kegiatan.keterangan}
                      </div>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : (
              <div className="p-10 text-center text-slate-500">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
                <h2 className="text-lg font-medium text-slate-700">
                  Dokumen tidak ditemukan
                </h2>
                <p className="mt-2">
                  Mohon periksa kembali nomor sertifikat Anda.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {result.found ? (
          <div className="mt-6 w-full rounded-lg border border-emerald-200 bg-emerald-50 px-6 py-4 text-center font-medium italic text-emerald-800">
            Adalah benar dan tercatat dalam arsip dokumen elektronik kami.
          </div>
        ) : null}

        <footer className="mt-20 mb-8 text-center text-sm font-medium text-slate-500">
          &copy; {new Date().getFullYear()} IAI Wilayah Jakarta.
        </footer>
      </div>
    </main>
  );
}

function Detail({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-normal tracking-wide text-slate-400 uppercase">
        {label}
      </p>
      <p
        className={
          strong ? "text-lg font-medium text-slate-950" : "text-slate-800"
        }
      >
        {value}
      </p>
    </div>
  );
}
