/**
 * Unit tests for Attendance server actions
 * Validates: Requirements 5.3, 5.4, 5.5, 5.7
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCKS ───────────────────────────────────────────────────────────────────

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
    const thenFn = (resolve: (v: unknown) => void) => resolve(resolvedValue);
    chain.then = thenFn;
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
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  count: vi.fn(() => "count"),
  sql: vi.fn(),
}));

// ─── IMPORTS (after mocks) ───────────────────────────────────────────────────

import { updateAttendance } from "@/server/actions/ppl-evaluasi/attendance";
import { computeConversionRate } from "@/lib/ppl-conversion-rate";

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("Attendance Server Actions - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Requirement 5.7: Archived kegiatan rejection ──────────────────────────

  describe("updateAttendance - archived status check", () => {
    it("SHALL reject update when kegiatan status is 'archived'", async () => {
      const selectChain = createChainableMock([
        { id: 1, statusEvent: "archived" },
      ]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await updateAttendance(1, {
        pendaftar: 50,
        realisasiHadir: 40,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe(
        "Kegiatan yang diarsipkan tidak dapat diubah",
      );
    });

    it("SHALL succeed when kegiatan status is 'aktif'", async () => {
      const selectChain = createChainableMock([
        { id: 1, statusEvent: "aktif" },
      ]);
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = createChainableMock();
      mockDb.update.mockReturnValue(updateChain);

      const result = await updateAttendance(1, {
        pendaftar: 50,
        realisasiHadir: 40,
      });

      expect(result.ok).toBe(true);
    });

    it("SHALL return error when kegiatan does not exist", async () => {
      const selectChain = createChainableMock([]);
      mockDb.select.mockReturnValue(selectChain);

      const result = await updateAttendance(999, {
        pendaftar: 50,
        realisasiHadir: 40,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Kegiatan tidak ditemukan");
    });
  });

  // ─── Requirement 5.1, 5.2: Input validation ───────────────────────────────

  describe("updateAttendance - input validation", () => {
    it("SHALL reject negative pendaftar value", async () => {
      const result = await updateAttendance(1, {
        pendaftar: -1,
        realisasiHadir: 10,
      });

      expect(result.ok).toBe(false);
      // Should not reach the DB query
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("SHALL reject negative realisasiHadir value", async () => {
      const result = await updateAttendance(1, {
        pendaftar: 10,
        realisasiHadir: -5,
      });

      expect(result.ok).toBe(false);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("SHALL reject pendaftar value exceeding 99999", async () => {
      const result = await updateAttendance(1, {
        pendaftar: 100000,
        realisasiHadir: 10,
      });

      expect(result.ok).toBe(false);
      expect(mockDb.select).not.toHaveBeenCalled();
    });

    it("SHALL reject realisasiHadir value exceeding 99999", async () => {
      const result = await updateAttendance(1, {
        pendaftar: 10,
        realisasiHadir: 100000,
      });

      expect(result.ok).toBe(false);
      expect(mockDb.select).not.toHaveBeenCalled();
    });
  });

  // ─── Requirement 5.3, 5.4: Conversion rate computation ────────────────────

  describe("computeConversionRate - edge cases", () => {
    it("SHALL return null when pendaftar is 0 (Requirement 5.4)", () => {
      const result = computeConversionRate(0, 50);
      expect(result).toBeNull();
    });

    it("SHALL return null when pendaftar is 0 and realisasiHadir is 0", () => {
      const result = computeConversionRate(0, 0);
      expect(result).toBeNull();
    });

    it("SHALL return rate > 100% when realisasiHadir > pendaftar (Requirement 5.5)", () => {
      // 60 hadir out of 50 pendaftar = 120%
      const result = computeConversionRate(50, 60);
      expect(result).not.toBeNull();
      expect(result!).toBeGreaterThan(100);
      expect(result).toBe(120.0);
    });

    it("SHALL calculate correct rate: (realisasiHadir / pendaftar) × 100 rounded to 1 decimal", () => {
      // 33 / 100 = 33.0%
      const result = computeConversionRate(100, 33);
      expect(result).toBe(33.0);
    });

    it("SHALL round to 1 decimal place correctly", () => {
      // 1 / 3 = 33.333...% → 33.3
      const result = computeConversionRate(3, 1);
      expect(result).toBe(33.3);
    });

    it("SHALL return 100.0 when all pendaftar attend", () => {
      const result = computeConversionRate(50, 50);
      expect(result).toBe(100.0);
    });

    it("SHALL return 0.0 when no one attends but pendaftar > 0", () => {
      const result = computeConversionRate(50, 0);
      expect(result).toBe(0.0);
    });
  });

  // ─── Requirement 5.5: realisasiHadir > pendaftar accepted ─────────────────

  describe("updateAttendance - realisasiHadir > pendaftar", () => {
    it("SHALL accept realisasiHadir greater than pendaftar (shows warning in UI)", async () => {
      const selectChain = createChainableMock([
        { id: 1, statusEvent: "aktif" },
      ]);
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = createChainableMock();
      mockDb.update.mockReturnValue(updateChain);

      const result = await updateAttendance(1, {
        pendaftar: 30,
        realisasiHadir: 50, // More attendees than registrants
      });

      expect(result.ok).toBe(true);
    });
  });
});
