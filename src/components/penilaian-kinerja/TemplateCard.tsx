"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Edit, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { TemplateRow } from "@/server/actions/penilaianKinerja";
import { deleteTemplate, duplicateTemplate } from "@/server/actions/penilaianKinerja";
import { TemplateFormDialog } from "./TemplateFormDialog";

interface TemplateCardProps {
  template: TemplateRow;
}

export function TemplateCard({ template }: TemplateCardProps) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteTemplate({ id: template.id });
      toast.success("Template berhasil dihapus");
      router.refresh();
    } catch (err) {
      toast.error("Gagal menghapus template");
    } finally {
      setLoading(false);
      setShowDelete(false);
    }
  }

  async function handleDuplicate() {
    try {
      const result = await duplicateTemplate(template.id);
      if (result.ok) {
        toast.success("Template berhasil diduplikasi");
        router.refresh();
      } else {
        toast.error(result.error ?? "Gagal menduplikasi template");
      }
    } catch {
      toast.error("Gagal menduplikasi template");
    }
  }

  return (
    <>
      <Card
        className="cursor-pointer transition-shadow hover:shadow-md"
        onClick={() =>
          router.push(`/penilaian-kinerja/template/${template.id}`)
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base">{template.nama}</CardTitle>
              <CardDescription>
                {template.jabatan ?? template.divisiNama ?? "Umum"}
              </CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowEdit(true);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDuplicate();
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Duplikasi
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDelete(true);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={template.tipe === "tugas" ? "default" : "secondary"}>
              {template.tipe === "tugas" ? "Tugas" : "Perilaku"}
            </Badge>
            {template.isDefault && (
              <Badge variant="outline">Default</Badge>
            )}
            <span className="ml-auto text-sm text-muted-foreground">
              {template.itemCount} item
            </span>
          </div>
        </CardContent>
      </Card>

      <TemplateFormDialog
        open={showEdit}
        onOpenChange={setShowEdit}
        editData={template}
      />

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Template</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus template &quot;{template.nama}
              &quot;? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
