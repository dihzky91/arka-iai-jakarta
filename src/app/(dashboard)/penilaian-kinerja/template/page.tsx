import { requirePermission } from "@/server/actions/auth";
import { listTemplates } from "@/server/actions/penilaianKinerja";
import { TemplateManager } from "@/components/penilaian-kinerja/TemplateManager";

export default async function TemplatePenilaianPage() {
  await requirePermission("penilaianKinerja", "manage");
  const templates = await listTemplates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium tracking-tight">
          Template Penilaian Kinerja
        </h1>
        <p className="text-muted-foreground">
          Kelola template kriteria penilaian tugas dan perilaku per jabatan.
        </p>
      </div>

      <TemplateManager initialData={templates} />
    </div>
  );
}
