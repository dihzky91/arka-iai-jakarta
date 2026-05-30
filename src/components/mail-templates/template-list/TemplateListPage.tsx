"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  MoreVertical,
  Copy,
  Trash2,
  Power,
  Mail,
  Upload,
  Layout,
  ScrollText,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  deleteTemplate,
  duplicateTemplate,
  toggleTemplateActive,
} from "@/server/actions/mail-templates/templates";
import { importTemplate } from "@/server/actions/mail-templates/import-export";
import type { EmailTemplate, EmailLayout } from "@/server/db/schema";

const CATEGORIES = [
  { value: "all", label: "Semua" },
  { value: "persuratan", label: "Persuratan" },
  { value: "akademik", label: "Akademik" },
  { value: "keuangan", label: "Keuangan" },
  { value: "auth", label: "Auth" },
  { value: "sistem", label: "Sistem" },
  { value: "ppl", label: "PPL" },
  { value: "custom", label: "Custom" },
] as const;

interface Props {
  initialTemplates: EmailTemplate[];
  layouts: EmailLayout[];
}

export function TemplateListPage({ initialTemplates, layouts }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [templates, setTemplates] = useState(initialTemplates);

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      const matchCategory =
        category === "all" || t.category === category;
      const matchSearch =
        !search ||
        t.templateName.toLowerCase().includes(search.toLowerCase()) ||
        t.templateKey.toLowerCase().includes(search.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [templates, category, search]);

  async function handleToggleActive(id: string) {
    const result = await toggleTemplateActive(id);
    if (result) {
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isActive: result.isActive } : t)),
      );
      toast.success(result.isActive ? "Template diaktifkan" : "Template dinonaktifkan");
    }
  }

  async function handleDuplicate(id: string) {
    const result = await duplicateTemplate(id);
    if (result) {
      setTemplates((prev) => [...prev, result]);
      toast.success("Template berhasil diduplikasi");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      toast.success("Template berhasil dihapus");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal menghapus template");
    }
  }

  return (
    <div className="space-y-4">
      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/pengaturan/mail-templates/layouts">
            <Layout className="mr-1 h-4 w-4" />
            Layouts
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/pengaturan/mail-templates/logs">
            <ScrollText className="mr-1 h-4 w-4" />
            Send Logs
          </Link>
        </Button>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari template..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <ImportButton
            onImported={(t) => {
              setTemplates((prev) => [...prev, t]);
            }}
          />
          <Button asChild>
            <Link href="/pengaturan/mail-templates/create">
              <Plus className="mr-2 h-4 w-4" />
              Template Baru
            </Link>
          </Button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setCategory(cat.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              category === cat.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
            <Mail className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {search || category !== "all"
                ? "Tidak ada template yang cocok dengan filter."
                : "Belum ada template. Buat template pertama Anda."}
            </p>
          </div>
        ) : (
          filtered.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onToggleActive={() => handleToggleActive(template.id)}
              onDuplicate={() => handleDuplicate(template.id)}
              onDelete={() => handleDelete(template.id)}
            />
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Menampilkan {filtered.length} dari {templates.length} template
      </p>
    </div>
  );
}

// ─── TEMPLATE CARD ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onToggleActive,
  onDuplicate,
  onDelete,
}: {
  template: EmailTemplate;
  onToggleActive: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="group flex items-start justify-between rounded-xl border border-border/60 bg-card shadow-sm p-4 transition-colors hover:bg-accent/50">
      <Link
        href={`/pengaturan/mail-templates/${template.id}`}
        className="flex-1 min-w-0"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-foreground truncate">
            {template.templateName}
          </h3>
          {template.isSystem && (
            <Badge variant="secondary" className="text-[10px] shrink-0">
              System
            </Badge>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{template.templateKey}</span>
          <span>•</span>
          <Badge variant="outline" className="text-[10px]">
            {template.category}
          </Badge>
          <span>•</span>
          <span>v{template.version}</span>
        </div>
        {template.description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1">
            {template.description}
          </p>
        )}
      </Link>

      <div className="flex items-center gap-2 shrink-0 ml-4">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            template.isActive ? "bg-green-500" : "bg-gray-300"
          }`}
        />
        <span className="text-xs text-muted-foreground">
          {template.isActive ? "Aktif" : "Nonaktif"}
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onToggleActive}>
              <Power className="mr-2 h-4 w-4" />
              {template.isActive ? "Nonaktifkan" : "Aktifkan"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />
              Duplikasi
            </DropdownMenuItem>
            {!template.isSystem && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

// ─── IMPORT BUTTON ────────────────────────────────────────────────────────────

function ImportButton({ onImported }: { onImported: (t: EmailTemplate) => void }) {
  const router = useRouter();

  async function handleImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const result = await importTemplate(data);

        if (result.success) {
          toast.success("Template berhasil di-import");
          router.refresh();
        } else {
          toast.error(result.error ?? "Gagal import");
        }
      } catch {
        toast.error("File JSON tidak valid");
      }
    };
    input.click();
  }

  return (
    <Button variant="outline" size="sm" onClick={handleImport}>
      <Upload className="mr-1 h-4 w-4" />
      Import
    </Button>
  );
}
