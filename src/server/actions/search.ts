"use server";

import { db } from "@/server/db";
import {
  suratKeluar,
  suratMasuk,
  disposisi,
  users,
  divisi,
} from "@/server/db/schema";
import { eq, or, and, ilike, gte, lte, sql, desc, type SQL } from "drizzle-orm";
import { getTodayIsoInJakarta, parseIsoDateInJakarta } from "@/lib/utils";
import { requireSession } from "./auth";

export interface SearchFilters {
  query?: string;
  jenisSurat?: string;
  status?: string;
  divisiId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  userId?: string;
}

export interface SearchResult {
  id: string;
  type: "surat_keluar" | "surat_masuk" | "disposisi";
  title: string;
  subtitle: string;
  status: string | null;
  date: Date | null;
  url: string;
}

function toIsoDateForFilter(date: Date): string {
  return getTodayIsoInJakarta(date);
}

export async function globalSearch(
  filters: SearchFilters,
  limit: number = 20
): Promise<SearchResult[]> {
  await requireSession();

  const results: SearchResult[] = [];
  const searchQuery = filters.query?.trim();

  // Search Surat Keluar
  const suratKeluarConditions = [];

  if (searchQuery) {
    suratKeluarConditions.push(
      or(
        ilike(suratKeluar.perihal, `%${searchQuery}%`),
        ilike(suratKeluar.tujuan, `%${searchQuery}%`),
        ilike(suratKeluar.nomorSurat || "", `%${searchQuery}%`),
        ilike(suratKeluar.isiSingkat || "", `%${searchQuery}%`)
      )
    );
  }

  if (filters.jenisSurat) {
    suratKeluarConditions.push(eq(suratKeluar.jenisSurat, filters.jenisSurat as typeof suratKeluar.jenisSurat.enumValues[number]));
  }

  if (filters.status) {
    suratKeluarConditions.push(eq(suratKeluar.status, filters.status as typeof suratKeluar.status.enumValues[number]));
  }

  if (filters.divisiId) {
    suratKeluarConditions.push(eq(suratKeluar.divisiId, filters.divisiId));
  }

  if (filters.dateFrom) {
    const dateStr = toIsoDateForFilter(filters.dateFrom);
    if (dateStr) suratKeluarConditions.push(gte(suratKeluar.tanggalSurat, dateStr));
  }

  if (filters.dateTo) {
    const dateStr = toIsoDateForFilter(filters.dateTo);
    if (dateStr) suratKeluarConditions.push(lte(suratKeluar.tanggalSurat, dateStr));
  }

  if (filters.userId) {
    suratKeluarConditions.push(eq(suratKeluar.dibuatOleh, filters.userId));
  }

  const suratKeluarResults = await db
    .select({
      id: suratKeluar.id,
      perihal: suratKeluar.perihal,
      tujuan: suratKeluar.tujuan,
      nomorSurat: suratKeluar.nomorSurat,
      status: suratKeluar.status,
      tanggalSurat: suratKeluar.tanggalSurat,
    })
    .from(suratKeluar)
    .where(suratKeluarConditions.length > 0 ? and(...(suratKeluarConditions as SQL<unknown>[])) : undefined)
    .orderBy(desc(suratKeluar.createdAt))
    .limit(limit);

  results.push(
    ...suratKeluarResults.map((sk) => ({
      id: sk.id,
      type: "surat_keluar" as const,
      title: sk.perihal,
      subtitle: `Ke: ${sk.tujuan}${sk.nomorSurat ? ` | No: ${sk.nomorSurat}` : ""}`,
      status: sk.status,
      date: sk.tanggalSurat ? parseIsoDateInJakarta(sk.tanggalSurat) : null,
      url: `/surat-keluar/${sk.id}`,
    }))
  );

  // Search Surat Masuk
  const suratMasukConditions = [];

  if (searchQuery) {
    suratMasukConditions.push(
      or(
        ilike(suratMasuk.perihal, `%${searchQuery}%`),
        ilike(suratMasuk.pengirim, `%${searchQuery}%`),
        ilike(suratMasuk.nomorSuratAsal || "", `%${searchQuery}%`),
        ilike(suratMasuk.nomorAgenda || "", `%${searchQuery}%`),
        ilike(suratMasuk.isiSingkat || "", `%${searchQuery}%`)
      )
    );
  }

  if (filters.jenisSurat) {
    suratMasukConditions.push(eq(suratMasuk.jenisSurat, filters.jenisSurat as typeof suratMasuk.jenisSurat.enumValues[number]));
  }

  if (filters.status) {
    suratMasukConditions.push(eq(suratMasuk.status, filters.status as typeof suratMasuk.status.enumValues[number]));
  }

  if (filters.dateFrom) {
    const dateStr = toIsoDateForFilter(filters.dateFrom);
    if (dateStr) suratMasukConditions.push(gte(suratMasuk.tanggalSurat, dateStr));
  }

  if (filters.dateTo) {
    const dateStr = toIsoDateForFilter(filters.dateTo);
    if (dateStr) suratMasukConditions.push(lte(suratMasuk.tanggalSurat, dateStr));
  }

  const suratMasukResults = await db
    .select({
      id: suratMasuk.id,
      perihal: suratMasuk.perihal,
      pengirim: suratMasuk.pengirim,
      nomorSuratAsal: suratMasuk.nomorSuratAsal,
      status: suratMasuk.status,
      tanggalSurat: suratMasuk.tanggalSurat,
    })
    .from(suratMasuk)
    .where(suratMasukConditions.length > 0 ? and(...(suratMasukConditions as SQL<unknown>[])) : undefined)
    .orderBy(desc(suratMasuk.createdAt))
    .limit(limit);

  results.push(
    ...suratMasukResults.map((sm) => ({
      id: sm.id,
      type: "surat_masuk" as const,
      title: sm.perihal,
      subtitle: `Dari: ${sm.pengirim}${sm.nomorSuratAsal ? ` | No: ${sm.nomorSuratAsal}` : ""}`,
      status: sm.status,
      date: sm.tanggalSurat ? parseIsoDateInJakarta(sm.tanggalSurat) : null,
      url: `/surat-masuk/${sm.id}`,
    }))
  );

  // Search Disposisi
  if (!filters.jenisSurat && !filters.status) {
    const disposisiConditions = [];

    if (searchQuery) {
      disposisiConditions.push(
        or(
          ilike(disposisi.catatan || "", `%${searchQuery}%`),
          ilike(disposisi.instruksi || "", `%${searchQuery}%`)
        )
      );
    }

    if (filters.userId) {
      disposisiConditions.push(
        or(
          eq(disposisi.dariUserId, filters.userId),
          eq(disposisi.kepadaUserId, filters.userId)
        )
      );
    }

    if (filters.dateFrom) {
      disposisiConditions.push(gte(disposisi.tanggalDisposisi, filters.dateFrom));
    }

    if (filters.dateTo) {
      disposisiConditions.push(lte(disposisi.tanggalDisposisi, filters.dateTo));
    }

    const disposisiResults = await db
      .select({
        id: disposisi.id,
        catatan: disposisi.catatan,
        instruksi: disposisi.instruksi,
        status: disposisi.status,
        tanggalDisposisi: disposisi.tanggalDisposisi,
        kepadaUserId: disposisi.kepadaUserId,
      })
      .from(disposisi)
      .where(disposisiConditions.length > 0 ? and(...(disposisiConditions as SQL<unknown>[])) : undefined)
      .orderBy(desc(disposisi.tanggalDisposisi))
      .limit(limit);

    results.push(
      ...disposisiResults.map((d) => ({
        id: d.id,
        type: "disposisi" as const,
        title: d.instruksi || d.catatan || "Disposisi",
        subtitle: `Status: ${d.status}`,
        status: d.status,
        date: d.tanggalDisposisi,
        url: `/disposisi`,
      }))
    );
  }

  // Sort by date descending
  return results
    .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))
    .slice(0, limit);
}

export async function getSearchSuggestions(query: string): Promise<string[]> {
  await requireSession();

  if (!query || query.length < 2) return [];

  const suggestions: Set<string> = new Set();

  // Get suggestions from surat keluar
  const skResults = await db
    .select({ perihal: suratKeluar.perihal, tujuan: suratKeluar.tujuan })
    .from(suratKeluar)
    .where(
      or(
        ilike(suratKeluar.perihal, `%${query}%`),
        ilike(suratKeluar.tujuan, `%${query}%`)
      )
    )
    .limit(10);

  skResults.forEach((r) => {
    suggestions.add(r.perihal);
    suggestions.add(r.tujuan);
  });

  // Get suggestions from surat masuk
  const smResults = await db
    .select({ perihal: suratMasuk.perihal, pengirim: suratMasuk.pengirim })
    .from(suratMasuk)
    .where(
      or(
        ilike(suratMasuk.perihal, `%${query}%`),
        ilike(suratMasuk.pengirim, `%${query}%`)
      )
    )
    .limit(10);

  smResults.forEach((r) => {
    suggestions.add(r.perihal);
    suggestions.add(r.pengirim);
  });

  return Array.from(suggestions).slice(0, 10);
}
