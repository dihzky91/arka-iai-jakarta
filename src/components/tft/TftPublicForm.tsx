"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { submitPendaftaranTft } from "@/server/actions/tft/pendaftar";

interface TftPublicFormProps {
  periode: {
    id: string;
    judul: string;
    slug: string;
    deskripsi: string | null;
    tanggalMulai: string;
    tanggalSelesai: string;
    waktuMulai: string | null;
    waktuSelesai: string | null;
    lokasi: string | null;
    program: "brevet_ab" | "brevet_c" | "all";
  };
  isClosed: boolean;
  materiAb: string[];
  materiC: string[];
}

export function TftPublicForm({ periode, isClosed, materiAb, materiC }: TftPublicFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [namaLengkap, setNamaLengkap] = useState("");
  const [email, setEmail] = useState("");
  const [noHp, setNoHp] = useState("");
  const [pekerjaan, setPekerjaan] = useState("");
  const [alamatPekerjaan, setAlamatPekerjaan] = useState("");
  const [alamatDomisili, setAlamatDomisili] = useState("");
  const [selectedMateriAb, setSelectedMateriAb] = useState<string[]>([]);
  const [selectedMateriC, setSelectedMateriC] = useState<string[]>([]);
  const [bersediaHadir, setBersediaHadir] = useState<boolean | null>(null);
  const [cvFile, setCvFile] = useState<File | null>(null);

  function toggleMateri(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter((m) => m !== item) : [...list, item]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Client-side validation
    if (!namaLengkap.trim()) { toast.error("Nama lengkap wajib diisi."); return; }
    if (!email.trim()) { toast.error("Email wajib diisi."); return; }
    if (!noHp.trim()) { toast.error("No HP wajib diisi."); return; }
    if (!pekerjaan.trim()) { toast.error("Pekerjaan wajib diisi."); return; }
    if (!alamatPekerjaan.trim()) { toast.error("Alamat pekerjaan wajib diisi."); return; }
    if (!alamatDomisili.trim()) { toast.error("Alamat domisili wajib diisi."); return; }
    if (bersediaHadir === null) { toast.error("Pilih kesediaan hadir."); return; }

    if (periode.program === "brevet_ab" && selectedMateriAb.length === 0) {
      toast.error("Pilih minimal satu materi Brevet AB.");
      return;
    }
    if (periode.program === "brevet_c" && selectedMateriC.length === 0) {
      toast.error("Pilih minimal satu materi Brevet C.");
      return;
    }
    if (periode.program === "all" && selectedMateriAb.length === 0 && selectedMateriC.length === 0) {
      toast.error("Pilih minimal satu materi yang dikuasai.");
      return;
    }

    startTransition(async () => {
      // Prepare CV file data
      let cvData: { body: Buffer; fileName: string; contentType: string } | undefined;
      if (cvFile) {
        const arrayBuffer = await cvFile.arrayBuffer();
        cvData = {
          body: Buffer.from(arrayBuffer),
          fileName: cvFile.name,
          contentType: cvFile.type || "application/pdf",
        };
      }

      const res = await submitPendaftaranTft(
        {
          periodeId: periode.id,
          namaLengkap,
          email,
          noHp,
          pekerjaan,
          alamatPekerjaan,
          alamatDomisili,
          materiBrevetAb: selectedMateriAb,
          materiBrevetC: selectedMateriC,
          bersediaHadir: bersediaHadir!,
        },
        cvData,
      );

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      setSubmitted(true);
    });
  }

  // ─── CLOSED STATE ──────────────────────────────────────────────────────────
  if (isClosed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-gray-900">Pendaftaran Ditutup</h1>
          <p className="mt-2 text-sm text-gray-600">
            Pendaftaran untuk <strong>{periode.judul}</strong> telah ditutup. Terima kasih atas minat Anda.
          </p>
        </div>
      </div>
    );
  }

  // ─── SUCCESS STATE ─────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-xl font-semibold text-gray-900">Pendaftaran Berhasil!</h1>
          <p className="mt-2 text-sm text-gray-600">
            Terima kasih telah mendaftar di <strong>{periode.judul}</strong>. Kami akan menghubungi Anda melalui email atau WhatsApp untuk informasi selanjutnya.
          </p>
        </div>
      </div>
    );
  }

  // ─── FORM ──────────────────────────────────────────────────────────────────
  const showAb = periode.program === "brevet_ab" || periode.program === "all";
  const showC = periode.program === "brevet_c" || periode.program === "all";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900">{periode.judul}</h1>
            <p className="mt-1 text-sm text-gray-500">IAI Wilayah DKI Jakarta</p>
          </div>

          {periode.deskripsi && (
            <div
              className="mt-6 prose prose-sm max-w-none text-gray-700"
              dangerouslySetInnerHTML={{ __html: periode.deskripsi }}
            />
          )}

          <div className="mt-4 space-y-1 text-sm text-gray-600">
            <p>
              <strong>Hari/Tanggal:</strong> {periode.tanggalMulai}
              {periode.tanggalSelesai !== periode.tanggalMulai && ` s/d ${periode.tanggalSelesai}`}
            </p>
            {periode.waktuMulai && periode.waktuSelesai && (
              <p><strong>Waktu:</strong> {periode.waktuMulai} – {periode.waktuSelesai} WIB</p>
            )}
            {periode.lokasi && <p><strong>Lokasi:</strong> {periode.lokasi}</p>}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Nama */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              Nama Lengkap <span className="text-red-500">*</span>
            </label>
            <Input
              className="mt-2"
              placeholder="Masukkan nama lengkap"
              value={namaLengkap}
              onChange={(e) => setNamaLengkap(e.target.value)}
              required
            />
          </div>

          {/* No HP */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              No. HP (aktif WhatsApp) <span className="text-red-500">*</span>
            </label>
            <Input
              className="mt-2"
              placeholder="08123456789"
              value={noHp}
              onChange={(e) => setNoHp(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              E-mail <span className="text-red-500">*</span>
            </label>
            <Input
              className="mt-2"
              type="email"
              placeholder="email@contoh.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Pekerjaan */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              Pekerjaan <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-2"
              placeholder="Contoh: Konsultan Pajak, Dosen Akuntansi, ..."
              value={pekerjaan}
              onChange={(e) => setPekerjaan(e.target.value)}
              rows={2}
              required
            />
          </div>

          {/* Alamat Pekerjaan */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              Alamat Pekerjaan <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-2"
              placeholder="Alamat kantor/tempat kerja"
              value={alamatPekerjaan}
              onChange={(e) => setAlamatPekerjaan(e.target.value)}
              rows={2}
              required
            />
          </div>

          {/* Alamat Domisili */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              Alamat Domisili <span className="text-red-500">*</span>
            </label>
            <Input
              className="mt-2"
              placeholder="Alamat tempat tinggal"
              value={alamatDomisili}
              onChange={(e) => setAlamatDomisili(e.target.value)}
              required
            />
          </div>

          {/* Materi Brevet AB */}
          {showAb && materiAb.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <label className="text-sm font-medium text-gray-900">
                Materi Brevet AB yang dikuasai? <span className="text-red-500">*</span>
              </label>
              <div className="mt-3 space-y-2">
                {materiAb.map((m) => (
                  <div key={m} className="flex items-center gap-2">
                    <Checkbox
                      id={`ab-${m}`}
                      checked={selectedMateriAb.includes(m)}
                      onCheckedChange={() => toggleMateri(selectedMateriAb, setSelectedMateriAb, m)}
                    />
                    <label htmlFor={`ab-${m}`} className="text-sm cursor-pointer select-none">
                      {m}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Materi Brevet C */}
          {showC && materiC.length > 0 && (
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <label className="text-sm font-medium text-gray-900">
                Materi Brevet C yang dikuasai? <span className="text-red-500">*</span>
              </label>
              <div className="mt-3 space-y-2">
                {materiC.map((m) => (
                  <div key={m} className="flex items-center gap-2">
                    <Checkbox
                      id={`c-${m}`}
                      checked={selectedMateriC.includes(m)}
                      onCheckedChange={() => toggleMateri(selectedMateriC, setSelectedMateriC, m)}
                    />
                    <label htmlFor={`c-${m}`} className="text-sm cursor-pointer select-none">
                      {m}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bersedia hadir */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              Apakah bapak/ibu bersedia hadir mengikuti TFT? <span className="text-red-500">*</span>
            </label>
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="hadir-ya"
                  name="bersediaHadir"
                  checked={bersediaHadir === true}
                  onChange={() => setBersediaHadir(true)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="hadir-ya" className="text-sm cursor-pointer">Ya</label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  id="hadir-tidak"
                  name="bersediaHadir"
                  checked={bersediaHadir === false}
                  onChange={() => setBersediaHadir(false)}
                  className="h-4 w-4 text-blue-600"
                />
                <label htmlFor="hadir-tidak" className="text-sm cursor-pointer">Tidak</label>
              </div>
            </div>
          </div>

          {/* Upload CV */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <label className="text-sm font-medium text-gray-900">
              Lampirkan CV Terupdate <span className="text-red-500">*</span>
            </label>
            <div className="mt-2">
              <input
                type="file"
                accept=".pdf"
                onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Format PDF, maksimal 10 MB</p>
              {cvFile && (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-700">
                  <FileText className="h-4 w-4" />
                  {cvFile.name}
                </div>
              )}
            </div>
          </div>

          {/* Submit */}
          <div className="rounded-2xl bg-white p-6 shadow-sm">
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending}
            >
              {isPending ? "Mengirim..." : "Kirim Pendaftaran"}
            </Button>
          </div>
        </form>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} IAI Wilayah DKI Jakarta
        </p>
      </div>
    </div>
  );
}
