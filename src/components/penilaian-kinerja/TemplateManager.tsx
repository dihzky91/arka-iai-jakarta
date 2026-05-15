"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TemplateRow } from "@/server/actions/penilaianKinerja";
import { TemplateCard } from "./TemplateCard";
import { TemplateFormDialog } from "./TemplateFormDialog";

interface TemplateManagerProps {
  initialData: TemplateRow[];
}

export function TemplateManager({ initialData }: TemplateManagerProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"tugas" | "perilaku">("tugas");

  const tugasTemplates = initialData.filter((t) => t.tipe === "tugas");
  const perilakuTemplates = initialData.filter((t) => t.tipe === "perilaku");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "tugas" | "perilaku")}
        >
          <TabsList>
            <TabsTrigger value="tugas">
              Tugas ({tugasTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="perilaku">
              Perilaku ({perilakuTemplates.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Buat Template
        </Button>
      </div>

      {activeTab === "tugas" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tugasTemplates.length === 0 ? (
            <div className="col-span-full rounded-lg border bg-card p-8 text-center text-muted-foreground">
              Belum ada template penilaian tugas.
            </div>
          ) : (
            tugasTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))
          )}
        </div>
      )}

      {activeTab === "perilaku" && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {perilakuTemplates.length === 0 ? (
            <div className="col-span-full rounded-lg border bg-card p-8 text-center text-muted-foreground">
              Belum ada template penilaian perilaku.
            </div>
          ) : (
            perilakuTemplates.map((template) => (
              <TemplateCard key={template.id} template={template} />
            ))
          )}
        </div>
      )}

      <TemplateFormDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        defaultTipe={activeTab}
      />
    </div>
  );
}
