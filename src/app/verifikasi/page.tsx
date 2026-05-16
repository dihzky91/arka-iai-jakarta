import type { Metadata } from "next";
import Image from "next/image";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { VerificationSearchForm } from "@/components/sertifikat/VerificationSearchForm";

export const metadata: Metadata = {
  title: "Verifikasi Dokumen | ARKA",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#dbeafe_0%,_#f8fafc_42%,_#ffffff_100%)] px-4 py-8 text-slate-900 md:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center">
        <div className="mb-6 flex h-28 w-28 items-center justify-center">
          <Image
            src="/iai-logo.png"
            alt="Logo IAI"
            width={112}
            height={112}
            className="h-full w-full object-contain"
            priority
          />
        </div>

        <div className="mb-6 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white shadow-md">
          <CheckCircle2 className="h-6 w-6" />
          <h1 className="text-center text-lg font-medium tracking-wide md:text-xl">
            Verifikasi Dokumen
          </h1>
        </div>

        <Card className="w-full overflow-hidden rounded-3xl border-white/70 bg-white/85 py-0 shadow-[0_8px_30px_rgb(15,23,42,0.08)] ring-1 ring-slate-100 backdrop-blur">
          <CardContent className="p-0">
            <div className="border-b border-slate-100 bg-slate-50/70 p-6">
              <VerificationSearchForm />
            </div>
            <div className="p-8 text-center text-slate-600">
              <p className="text-sm leading-6">
                Masukkan nomor sertifikat untuk memastikan dokumen tercatat di
                arsip elektronik IAI Wilayah Jakarta.
              </p>
            </div>
          </CardContent>
        </Card>

        <footer className="mt-20 text-center text-sm font-normal text-slate-500">
          &copy; {new Date().getFullYear()} IAI Wilayah Jakarta.
        </footer>
      </div>
    </main>
  );
}
