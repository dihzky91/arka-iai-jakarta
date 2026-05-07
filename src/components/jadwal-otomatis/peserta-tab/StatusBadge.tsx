import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status, alasan }: { status: string | null; alasan: string | null }) {
  if (status === "lulus") return <Badge variant="default" className="bg-green-600">Lulus</Badge>;
  if (status === "telah_mengikuti") {
    const label = alasan === "kehadiran" ? "Telah Mengikuti (hadir)" : "Telah Mengikuti (nilai)";
    return <Badge variant="destructive">{label}</Badge>;
  }
  return <Badge variant="secondary">Dalam Proses</Badge>;
}
