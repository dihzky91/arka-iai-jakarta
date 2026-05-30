"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Save,
  ArrowLeft,
  Power,
  Monitor,
  Smartphone,
  History,
  Download,
  HelpCircle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  updateTemplate,
  toggleTemplateActive,
} from "@/server/actions/mail-templates/templates";
import { exportTemplate } from "@/server/actions/mail-templates/import-export";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BlockCanvas } from "./BlockCanvas";
import { BlockPalette } from "./BlockPalette";
import { VariablePanel } from "./VariablePanel";
import { TemplatePreview } from "./TemplatePreview";
import { SubjectEditor } from "./SubjectEditor";
import { TestSendDialog } from "./TestSendDialog";
import { SampleDataEditor } from "./SampleDataEditor";
import type { EmailTemplate, EmailLayout } from "@/server/db/schema";
import type { TemplateBlock } from "@/lib/email/template-engine/types";
import type { VariableDefinition } from "@/lib/email/template-engine/types";

interface Props {
  template: EmailTemplate;
  layouts: EmailLayout[];
  variables: VariableDefinition[];
}

export function TemplateEditor({ template, layouts, variables }: Props) {
  const router = useRouter();
  const [subject, setSubject] = useState(template.subject);
  const [blocks, setBlocks] = useState<TemplateBlock[]>(
    template.bodyBlocks as TemplateBlock[],
  );
  const [layoutId, setLayoutId] = useState<string | null>(template.layoutId);
  const [changeNote, setChangeNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [customSampleData, setCustomSampleData] = useState<Record<string, string>>({});

  // Filter variables relevant to this template's category
  const relevantVariables = useMemo(
    () =>
      variables.filter(
        (v) => v.category === "global" || v.category === template.category,
      ),
    [variables, template.category],
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      await updateTemplate(template.id, {
        subject,
        bodyBlocks: blocks,
        layoutId,
        changeNote: changeNote || undefined,
      });
      toast.success("Template berhasil disimpan");
      setChangeNote("");
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan template",
      );
    } finally {
      setIsSaving(false);
    }
  }, [template.id, subject, blocks, layoutId, changeNote, router]);

  const handleToggleActive = useCallback(async () => {
    const result = await toggleTemplateActive(template.id);
    if (result) {
      toast.success(
        result.isActive ? "Template diaktifkan" : "Template dinonaktifkan",
      );
      router.refresh();
    }
  }, [template.id, router]);

  const handleAddBlock = useCallback((type: TemplateBlock["type"]) => {
    const id = crypto.randomUUID();
    let newBlock: TemplateBlock;

    switch (type) {
      case "paragraph":
        newBlock = { id, type: "paragraph", content: "" };
        break;
      case "heading":
        newBlock = { id, type: "heading", level: 2, content: "" };
        break;
      case "button":
        newBlock = { id, type: "button", label: "Klik di sini", url: "", color: "#1d4ed8" };
        break;
      case "divider":
        newBlock = { id, type: "divider" };
        break;
      case "spacer":
        newBlock = { id, type: "spacer", height: 16 };
        break;
      case "image":
        newBlock = { id, type: "image", src: "", alt: "" };
        break;
      case "alert":
        newBlock = { id, type: "alert", variant: "info", content: "" };
        break;
      case "table":
        newBlock = { id, type: "table", headers: ["Kolom 1", "Kolom 2"], rows: [["", ""]] };
        break;
      case "list":
        newBlock = { id, type: "list", items: ["Item 1"] };
        break;
      case "columns":
        newBlock = {
          id,
          type: "columns",
          columns: [
            { width: "1/2", blocks: [] },
            { width: "1/2", blocks: [] },
          ],
        };
        break;
      case "signature":
        newBlock = { id, type: "signature" };
        break;
      default:
        return;
    }

    setBlocks((prev) => [...prev, newBlock]);
  }, []);

  // Keyboard shortcut: Ctrl+S to save
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p") {
        e.preventDefault();
        // Preview is always visible in split pane — no toggle needed
        toast.info("Preview selalu aktif di panel kanan");
      }
    },
    [handleSave],
  );

  const handleExport = useCallback(async () => {
    const data = await exportTemplate(template.id);
    if (!data) {
      toast.error("Gagal export template");
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${template.templateKey}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template di-export");
  }, [template.id, template.templateKey]);

  return (
    <div className="space-y-3" onKeyDown={handleKeyDown} tabIndex={-1}>
      {/* Top Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pengaturan/mail-templates">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Kembali
          </Link>
        </Button>
        <div className="flex-1" />
        <Badge variant={template.isActive ? "default" : "secondary"}>
          {template.isActive ? "Aktif" : "Nonaktif"}
        </Badge>
        <Button variant="outline" size="sm" onClick={handleToggleActive}>
          <Power className="mr-1 h-4 w-4" />
          {template.isActive ? "Nonaktifkan" : "Aktifkan"}
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/pengaturan/mail-templates/${template.id}/versions`}>
            <History className="mr-1 h-4 w-4" />
            Riwayat
          </Link>
        </Button>
        <TestSendDialog
          templateId={template.id}
          templateName={template.templateName}
          customVariables={Object.keys(customSampleData).length > 0 ? customSampleData : undefined}
        />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-4 w-4" />
                Export
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export template sebagai JSON</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button size="sm" onClick={handleSave} disabled={isSaving}>
          <Save className="mr-1 h-4 w-4" />
          {isSaving ? "Menyimpan..." : "Simpan"}
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              <p className="font-medium mb-1">Shortcuts:</p>
              <p>Ctrl+S — Simpan template</p>
              <p className="mt-1 font-medium">Tips:</p>
              <p>Ketik {"{{" } di input untuk autocomplete variabel</p>
              <p>Drag block untuk mengubah urutan</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Main Editor: Split Pane */}
      <div className="grid gap-4 lg:grid-cols-[1fr_400px]">
        {/* Left: Editor */}
        <div className="space-y-3 min-w-0">
          {/* Subject + Layout */}
          <div className="rounded-xl border border-border/60 bg-card shadow-sm p-4 space-y-3">
            <SubjectEditor
              value={subject}
              onChange={setSubject}
              variables={relevantVariables}
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Layout</Label>
                <Select
                  value={layoutId ?? "default"}
                  onValueChange={(v) => setLayoutId(v === "default" ? null : v)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default Layout</SelectItem>
                    {layouts.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Catatan Perubahan</Label>
                <Input
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="Apa yang diubah..."
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Block Canvas (dnd-kit sortable) */}
          <BlockCanvas
            blocks={blocks}
            onBlocksChange={setBlocks}
            variables={relevantVariables}
          />

          {/* Block Palette */}
          <BlockPalette onAddBlock={handleAddBlock} />
        </div>

        {/* Right: Preview + Variables */}
        <div className="space-y-3">
          {/* Preview Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Live Preview</span>
            <div className="flex rounded-md border overflow-hidden">
              <button
                onClick={() => setPreviewMode("desktop")}
                className={`p-1.5 transition-colors ${previewMode === "desktop" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                title="Desktop (600px)"
              >
                <Monitor className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setPreviewMode("mobile")}
                className={`p-1.5 transition-colors ${previewMode === "mobile" ? "bg-primary text-primary-foreground" : "hover:bg-accent"}`}
                title="Mobile (320px)"
              >
                <Smartphone className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Live Preview */}
          <TemplatePreview
            blocks={blocks}
            subject={subject}
            mode={previewMode}
            category={template.category}
            customSampleData={customSampleData}
          />

          {/* Sample Data Editor */}
          <SampleDataEditor
            variables={relevantVariables}
            sampleData={customSampleData}
            onSampleDataChange={setCustomSampleData}
          />

          {/* Variable Panel */}
          <VariablePanel variables={relevantVariables} />
        </div>
      </div>
    </div>
  );
}
