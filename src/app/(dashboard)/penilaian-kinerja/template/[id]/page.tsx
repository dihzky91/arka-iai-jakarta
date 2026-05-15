import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requirePermission } from "@/server/actions/auth";
import { getTemplate, getTemplateTotalBobot } from "@/server/actions/penilaianKinerja";
import { TemplateItemEditor } from "@/components/penilaian-kinerja/TemplateItemEditor";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function TemplateDetailPage({ params }: Props) {
  await requirePermission("penilaianKinerja", "manage");
  const { id } = await params;
  const templateId = parseInt(id, 10);

  if (isNaN(templateId)) notFound();

  const template = await getTemplate(templateId);
  if (!template) notFound();

  const totalBobot = await getTemplateTotalBobot(templateId);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/penilaian-kinerja/template">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Kembali ke Daftar Template
          </Link>
        </Button>
      </div>

      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <CardTitle>{template.nama}</CardTitle>
          <CardDescription>
            Template {template.tipe === "tugas" ? "Pelaksanaan Tugas" : "Perilaku"}
            {template.jabatan ? ` — ${template.jabatan}` : ""}
            {template.divisiNama ? ` — ${template.divisiNama}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <TemplateItemEditor
            templateId={templateId}
            initialItems={template.items}
            totalBobot={totalBobot}
          />
        </CardContent>
      </Card>
    </div>
  );
}
