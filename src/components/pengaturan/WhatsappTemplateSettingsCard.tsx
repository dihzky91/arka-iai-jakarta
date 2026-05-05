"use client";

import { useState, useTransition } from "react";
import { MessageSquareText, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { updateWhatsappMessageTemplate, type WhatsappTemplateRow } from "@/server/actions/jadwal-otomatis/whatsapp";

interface WhatsappTemplateSettingsCardProps {
  templates: WhatsappTemplateRow[];
  isAdmin: boolean;
}

export function WhatsappTemplateSettingsCard({
  templates,
  isAdmin,
}: WhatsappTemplateSettingsCardProps) {
  const [isPending, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(templates.map((item) => [item.templateKey, item.content])),
  );

  function updateDraft(templateKey: string, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [templateKey]: value,
    }));
  }

  function handleSave(templateKey: string, templateName: string) {
    if (!isAdmin) return;
    const content = (drafts[templateKey] ?? "").trim();

    startTransition(async () => {
      const result = await updateWhatsappMessageTemplate({
        templateKey,
        content,
      });
      if (!result.ok) {
        toast.error(result.error ?? "Gagal menyimpan template pesan.");
        return;
      }
      toast.success(`Template "${templateName}" berhasil disimpan.`);
    });
  }

  return (
    <Card className="rounded-[24px]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <MessageSquareText className="h-5 w-5" />
          </div>
          <div>
            <CardTitle>Template Pesan WhatsApp</CardTitle>
            <CardDescription>
              Ubah isi template untuk tombol WA di detail kelas.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {templates.map((template) => (
          <div key={template.templateKey} className="rounded-2xl border border-border p-4">
            <div className="mb-2">
              <p className="font-medium">{template.templateName}</p>
              <p className="text-xs text-muted-foreground">{template.description}</p>
            </div>
            <Textarea
              value={drafts[template.templateKey] ?? ""}
              onChange={(event) => updateDraft(template.templateKey, event.target.value)}
              className="min-h-[160px]"
              disabled={!isAdmin}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Placeholder umum: <code>{"{{nama_kelas}}"}</code>,{" "}
              <code>{"{{nama_program}}"}</code>, <code>{"{{periode_kelas}}"}</code>,{" "}
              <code>{"{{nama_instruktur}}"}</code>, <code>{"{{estimasi_honor}}"}</code>.
            </p>
            {isAdmin ? (
              <div className="mt-3 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSave(template.templateKey, template.templateName)}
                  disabled={isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Simpan Template
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
