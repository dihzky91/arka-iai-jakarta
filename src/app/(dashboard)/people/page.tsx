"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Search, Users, Link2, Unlink } from "lucide-react";
import { toast } from "sonner";
import { PageWrapper } from "@/components/layout/PageWrapper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  detectDuplicates,
  linkPeople,
  listUnifiedPeople,
  unlinkPeople,
} from "@/server/actions/people-directory";
import type {
  DuplicateCandidate,
  UnifiedPerson,
} from "@/server/actions/people-directory";

export default function PeopleDirectoryPage() {
  const [people, setPeople] = useState<UnifiedPerson[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState<"all" | "narasumber" | "instruktur" | "linked">("all");
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ linkId: number; nama: string } | null>(null);

  const loadPeople = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await listUnifiedPeople({
          search: search || undefined,
          role,
        });
        setPeople(result.data);
        setTotal(result.total);
      } catch {
        toast.error("Gagal memuat data");
      } finally {
        setLoading(false);
      }
    });
  }, [search, role]);

  useEffect(() => {
    loadPeople();
  }, [loadPeople]);

  const handleDetectDuplicates = () => {
    startTransition(async () => {
      try {
        const result = await detectDuplicates();
        setDuplicates(result);
        setShowDuplicates(true);
      } catch {
        toast.error("Gagal mendeteksi duplikat");
      }
    });
  };

  const handleLink = (candidate: DuplicateCandidate) => {
    startTransition(async () => {
      const result = await linkPeople(candidate.pplNarasumberId, candidate.instructorId);
      if (result.ok) {
        toast.success(`${candidate.narasumberNama} berhasil di-link`);
        setDuplicates((prev) => prev.filter((d) => d.pplNarasumberId !== candidate.pplNarasumberId));
        loadPeople();
      } else {
        toast.error(result.error ?? "Gagal membuat link");
      }
    });
  };

  const handleUnlink = () => {
    if (!unlinkTarget) return;
    startTransition(async () => {
      const result = await unlinkPeople(unlinkTarget.linkId);
      if (result.ok) {
        toast.success("Link berhasil dihapus");
        setUnlinkTarget(null);
        loadPeople();
      } else {
        toast.error(result.error ?? "Gagal menghapus link");
      }
    });
  };

  return (
    <PageWrapper
      title="Direktori Pengajar"
      description="Unified view narasumber PPL dan instruktur brevet."
    >
      <Card className="rounded-[24px]">
        <CardHeader className="border-b border-border/60">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Direktori Pengajar
              </CardTitle>
              <CardDescription>{total} orang terdaftar</CardDescription>
            </div>
            <Button variant="outline" onClick={handleDetectDuplicates} disabled={isPending}>
              <Link2 className="h-4 w-4 mr-1" />
              Deteksi Duplikat
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Search & Filter */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="narasumber">Narasumber PPL</SelectItem>
                <SelectItem value="instruktur">Instruktur Brevet</SelectItem>
                <SelectItem value="linked">Sudah Di-link</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">Memuat data...</p>
            </div>
          ) : people.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-sm font-medium">Tidak ada data</h3>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Peran</TableHead>
                    <TableHead className="text-center">PPL</TableHead>
                    <TableHead className="text-center">Brevet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((person) => (
                    <TableRow key={person.id}>
                      <TableCell className="font-medium">{person.nama}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {person.email ?? "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {person.isPplNarasumber && (
                            <Badge variant="default" className="text-[10px]">Narasumber</Badge>
                          )}
                          {person.isBrevetInstructor && (
                            <Badge variant="secondary" className="text-[10px]">Instruktur</Badge>
                          )}
                          {person.isPplNarasumber && person.isBrevetInstructor && (
                            <Badge variant="outline" className="text-[10px]">
                              <Link2 className="h-2.5 w-2.5 mr-0.5" />
                              Linked
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {person.pplKegiatanCount > 0 ? `${person.pplKegiatanCount} kegiatan` : "-"}
                      </TableCell>
                      <TableCell className="text-center text-sm">
                        {person.brevetSessionCount > 0 ? `${person.brevetSessionCount} sesi` : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={person.isActive ? "default" : "destructive"} className="text-[10px]">
                          {person.isActive ? "Aktif" : "Nonaktif"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {person.linkId && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => setUnlinkTarget({ linkId: person.linkId!, nama: person.nama })}
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicates} onOpenChange={setShowDuplicates}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Duplikat Terdeteksi</DialogTitle>
            <DialogDescription>
              Orang-orang berikut memiliki email yang sama di modul PPL dan Brevet.
              Klik &quot;Link&quot; untuk menghubungkan mereka.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 overflow-y-auto space-y-3 py-2">
            {duplicates.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Tidak ada duplikat terdeteksi.
              </p>
            ) : (
              duplicates.map((d) => (
                <div key={`${d.pplNarasumberId}-${d.instructorId}`} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{d.narasumberNama}</p>
                    <p className="text-xs text-muted-foreground">{d.narasumberEmail}</p>
                    <div className="mt-1 flex gap-1">
                      <Badge variant="default" className="text-[10px]">Narasumber</Badge>
                      <Badge variant="secondary" className="text-[10px]">Instruktur: {d.instructorName}</Badge>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleLink(d)} disabled={isPending}>
                    <Link2 className="h-3 w-3 mr-1" />
                    Link
                  </Button>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicates(false)}>Tutup</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation */}
      <Dialog open={unlinkTarget !== null} onOpenChange={(o) => !o && setUnlinkTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Link</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus link untuk &quot;{unlinkTarget?.nama}&quot;?
              Data di masing-masing modul tetap ada, hanya hubungannya yang dihapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkTarget(null)}>Batal</Button>
            <Button variant="destructive" onClick={handleUnlink} disabled={isPending}>
              {isPending ? "Menghapus..." : "Hapus Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageWrapper>
  );
}
