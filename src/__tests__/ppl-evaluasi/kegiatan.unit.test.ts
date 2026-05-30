/**
 * Unit tests for Kegiatan server actions
 * Validates: Requirements 1.4, 1.6, 1.7, 1.8
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCKS ───────────────────────────────────────────────────────────────────

// vi.hoisted ensures these are available when vi.mock factories run (hoisted)
const { mockDb, createChainableMock } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  /**
   * Creates a chainable mock that mimics drizzle's query builder.
   * The chain is also a thenable (has .then) so it can be awaited at any point.
   * When awaited, it resolves to `resolvedValue`.
   */
  function createChainableMock(resolvedValue: unknown = []) {
    const chain: Record<string, unknown> = {};
    // Make the chain itself thenable so destructuring works at any terminal point
    const thenFn = (resolve: (v: unknown) => void) => resolve(resolvedValue);
    chain.then = thenFn;
    // Also make it iterable for array destructuring
    chain[Symbol.iterator] = function* () {
      if (Array.isArray(resolvedValue)) {
        yield* resolvedValue;
      }
    };
    chain.from = vi.fn().mockReturnValue(chain);
    chain.where = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.innerJoin = vi.fn().mockReturnValue(chain);
    chain.orderBy = vi.fn().mockReturnValue(chain);
    chain.offset = vi.fn().mockReturnValue(chain);
    chain.returning = vi.fn().mockReturnValue(chain);
    chain.set = vi.fn().mockReturnValue(chain);
    chain.values = vi.fn().mockReturnValue(chain);
    return chain;
  }

  return { mockDb, createChainableMock };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/actions/auth", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User" },
  }),
  requirePermission: vi.fn().mockResolvedValue({
    user: { id: "user-1", name: "Test User" },
  }),
}));

vi.mock("@/server/db", () => ({
  db: mockDb,
}));

vi.mock("@/server/db/schema", () => ({
  pplKegiatan: {
    id: "id",
    namaKegiatan: "nama_kegiatan",
    kategoriPpl: "kategori_ppl",
    tipePelaksanaan: "tipe_pelaksanaan",
    statusEvent: "status_event",
    tanggalMulai: "tanggal_mulai",
    tanggalSelesai: "tanggal_selesai",
    lokasi: "lokasi",
    skp: "skp",
    pendaftar: "pendaftar",
    realisasiHadir: "realisasi_hadir",
    createdBy: "created_by",
    createdAt: "created_at",
    updatedAt: "updated_at",
  },
  pplKuesionerLink: {
    id: "id",
    kegiatanId: "kegiatan_id",
    templateId: "template_id",
    accessToken: "access_token",
    isActive: "is_active",
  },
  pplKuesionerResponse: {
    id: "id",
    linkId: "link_id",
    namaResponden: "nama_responden",
    emailResponden: "email_responden",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  count: vi.fn(() => "count"),
  ilike: vi.fn((...args: unknown[]) => ({ type: "ilike", args })),
  sql: vi.fn(),
}));

// ─── IMPORTS (after mocks) ───────────────────────────────────────────────────

import {
  createKegiatan,
  updateKegiatan,
  deleteKegiatan,
} from "@/server/actions/ppl-evaluasi/kegiatan";

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("Kegiatan Server Actions - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Requirement 1.8: Archived kegiatan prevents updates ─────────────────

  describe("updateKegiatan - archived status check", () => {
    it("SHALL reject update when kegiatan status is 'archived'", async () => {
      const selectChain = createChainableMock([
        { id: 1, statusEvent: "archived" },
      ]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await updateKegiatan(1, {
        namaKegiatan: "Updated Name",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe(
        "Kegiatan yang diarsipkan tidak dapat diubah",
      );
    });

    it("SHALL allow update when kegiatan status is 'aktif'", async () => {
      // First call: check status (returns aktif)
      const selectChainStatus = createChainableMock([
        { id: 1, statusEvent: "aktif" },
      ]);
      mockDb.select.mockReturnValue(selectChainStatus);

      const updateChain = createChainableMock();
      mockDb.update.mockReturnValue(updateChain);

      const result = await updateKegiatan(1, {
        namaKegiatan: "Updated Name",
      });

      expect(result.ok).toBe(true);
    });

    it("SHALL return error when kegiatan does not exist", async () => {
      const selectChain = createChainableMock([]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await updateKegiatan(999, {
        namaKegiatan: "Updated Name",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Kegiatan tidak ditemukan");
    });
  });

  // ─── Requirement 1.6: Soft-delete when responses/attendance exist ────────

  describe("deleteKegiatan - soft-delete behavior", () => {
    it("SHALL archive kegiatan when responses exist instead of deleting", async () => {
      // deleteKegiatan makes 3 select calls:
      // 1. Check existence
      // 2. Count responses (innerJoin chain)
      // 3. Get attendance data
      const existsChain = createChainableMock([{ id: 1 }]);
      const responseCountChain = createChainableMock([{ count: 3 }]);
      const attendanceChain = createChainableMock([
        { pendaftar: 0, realisasiHadir: 0 },
      ]);

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existsChain;
        if (selectCallCount === 2) return responseCountChain;
        return attendanceChain;
      });

      const updateChain = createChainableMock();
      mockDb.update.mockReturnValue(updateChain);

      const result = await deleteKegiatan(1);

      expect(result.ok).toBe(true);
      // Should call update (archive) not delete
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("SHALL archive kegiatan when pendaftar > 0", async () => {
      const existsChain = createChainableMock([{ id: 2 }]);
      const responseCountChain = createChainableMock([{ count: 0 }]);
      const attendanceChain = createChainableMock([
        { pendaftar: 50, realisasiHadir: 0 },
      ]);

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existsChain;
        if (selectCallCount === 2) return responseCountChain;
        return attendanceChain;
      });

      const updateChain = createChainableMock();
      mockDb.update.mockReturnValue(updateChain);

      const result = await deleteKegiatan(2);

      expect(result.ok).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("SHALL archive kegiatan when realisasiHadir > 0", async () => {
      const existsChain = createChainableMock([{ id: 3 }]);
      const responseCountChain = createChainableMock([{ count: 0 }]);
      const attendanceChain = createChainableMock([
        { pendaftar: 0, realisasiHadir: 25 },
      ]);

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existsChain;
        if (selectCallCount === 2) return responseCountChain;
        return attendanceChain;
      });

      const updateChain = createChainableMock();
      mockDb.update.mockReturnValue(updateChain);

      const result = await deleteKegiatan(3);

      expect(result.ok).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).not.toHaveBeenCalled();
    });

    it("SHALL hard-delete kegiatan when no responses and no attendance data", async () => {
      const existsChain = createChainableMock([{ id: 4 }]);
      const responseCountChain = createChainableMock([{ count: 0 }]);
      const attendanceChain = createChainableMock([
        { pendaftar: 0, realisasiHadir: 0 },
      ]);

      let selectCallCount = 0;
      mockDb.select.mockImplementation(() => {
        selectCallCount++;
        if (selectCallCount === 1) return existsChain;
        if (selectCallCount === 2) return responseCountChain;
        return attendanceChain;
      });

      const deleteChain = createChainableMock();
      mockDb.delete.mockReturnValue(deleteChain);

      const result = await deleteKegiatan(4);

      expect(result.ok).toBe(true);
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("SHALL return error when kegiatan does not exist", async () => {
      const existsChain = createChainableMock([]);
      mockDb.select.mockReturnValue(existsChain);

      const result = await deleteKegiatan(999);

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Kegiatan tidak ditemukan");
    });
  });

  // ─── Requirement 1.4, 1.7: SKP auto-calculation edge cases ───────────────

  describe("createKegiatan - SKP auto-calculation", () => {
    it("SHALL calculate SKP = 8 for same-day event (1 day × 8)", async () => {
      const insertChain = createChainableMock([{ id: 1 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await createKegiatan({
        namaKegiatan: "Seminar Pajak",
        kategoriPpl: "Perpajakan",
        tipePelaksanaan: "online",
        tanggalMulai: "2024-06-15",
        tanggalSelesai: "2024-06-15",
      });

      expect(result.ok).toBe(true);
      // Verify the values call included skp = 8
      const valuesCall = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(valuesCall?.skp).toBe(8);
    });

    it("SHALL calculate SKP = 16 for 2-day event (2 days × 8)", async () => {
      const insertChain = createChainableMock([{ id: 2 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await createKegiatan({
        namaKegiatan: "Workshop Audit",
        kategoriPpl: "Audit",
        tipePelaksanaan: "offline",
        tanggalMulai: "2024-06-15",
        tanggalSelesai: "2024-06-16",
      });

      expect(result.ok).toBe(true);
      const valuesCall = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(valuesCall?.skp).toBe(16);
    });

    it("SHALL calculate SKP = 40 for 5-day event (5 days × 8)", async () => {
      const insertChain = createChainableMock([{ id: 3 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await createKegiatan({
        namaKegiatan: "Pelatihan Intensif",
        kategoriPpl: "Akuntansi Keuangan",
        tipePelaksanaan: "hybrid",
        tanggalMulai: "2024-06-10",
        tanggalSelesai: "2024-06-14",
      });

      expect(result.ok).toBe(true);
      const valuesCall = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(valuesCall?.skp).toBe(40);
    });

    it("SHALL use manual SKP value when provided (overrides auto-calculation)", async () => {
      const insertChain = createChainableMock([{ id: 4 }]);
      mockDb.insert.mockReturnValue(insertChain);

      const result = await createKegiatan({
        namaKegiatan: "Seminar Khusus",
        kategoriPpl: "Perpajakan",
        tipePelaksanaan: "online",
        tanggalMulai: "2024-06-15",
        tanggalSelesai: "2024-06-16",
        skp: 4, // Manual override (auto would be 16)
      });

      expect(result.ok).toBe(true);
      const valuesCall = (insertChain.values as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(valuesCall?.skp).toBe(4);
    });

    it("SHALL reject creation when tanggalSelesai < tanggalMulai", async () => {
      const result = await createKegiatan({
        namaKegiatan: "Invalid Event",
        kategoriPpl: "Perpajakan",
        tipePelaksanaan: "online",
        tanggalMulai: "2024-06-20",
        tanggalSelesai: "2024-06-15",
      });

      expect(result.ok).toBe(false);
      // Should not attempt to insert
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it("SHALL reject creation when SKP is outside valid range (0)", async () => {
      const result = await createKegiatan({
        namaKegiatan: "Invalid SKP Event",
        kategoriPpl: "Perpajakan",
        tipePelaksanaan: "online",
        tanggalMulai: "2024-06-15",
        tanggalSelesai: "2024-06-15",
        skp: 0,
      });

      expect(result.ok).toBe(false);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
