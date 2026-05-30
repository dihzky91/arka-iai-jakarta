import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── MOCKS ───────────────────────────────────────────────────────────────────

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/server/actions/auth", () => ({
  requireSession: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", role: "admin" },
  }),
  requirePermission: vi.fn().mockResolvedValue({
    user: { id: "test-user-id", role: "admin" },
  }),
}));

vi.mock("@/server/db/schema", () => ({
  pplNarasumber: { id: "id", email: "email", nama: "nama", isActive: "is_active", feePerSkp: "fee_per_skp", noTelepon: "no_telepon" },
  pplKegiatanNarasumber: { id: "id", kegiatanId: "kegiatan_id", narasumberId: "narasumber_id", topik: "topik", totalHonorarium: "total_honorarium" },
  pplKegiatan: { id: "id", skp: "skp", statusEvent: "status_event" },
}));

vi.mock("@/lib/ppl-honorarium", () => ({
  calculateHonorarium: (feePerSkp: number, skp: number) => feePerSkp * skp,
}));

/**
 * Creates a select chain mock that resolves queries in sequence.
 * Each call to a terminal method (.limit() or .where() without .limit()) resolves the next value.
 */
function createSelectChainMock(results: unknown[][]) {
  let callIndex = 0;

  function makeChain(): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    chain.from = vi.fn(() => chain);
    chain.where = vi.fn(() => {
      // .where() can be terminal (no .limit() after it) — make it thenable
      const nextResult = results[callIndex] ?? [];
      const thenableChain = {
        ...chain,
        limit: vi.fn(() => {
          const res = results[callIndex] ?? [];
          callIndex++;
          return Promise.resolve(res);
        }),
        then: (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
          const res = results[callIndex] ?? [];
          callIndex++;
          return Promise.resolve(res).then(resolve, reject);
        },
      };
      return thenableChain;
    });
    chain.limit = vi.fn(() => {
      const res = results[callIndex] ?? [];
      callIndex++;
      return Promise.resolve(res);
    });
    return chain;
  }

  return { select: vi.fn(() => makeChain()) };
}

function createInsertChainMock(returnValue: unknown = [{ id: 1 }]) {
  const valuesMock = vi.fn();
  const insertMock = vi.fn(() => ({ values: valuesMock }));
  valuesMock.mockReturnValue({
    returning: vi.fn().mockResolvedValue(returnValue),
    then: (resolve: (v: unknown) => void) => Promise.resolve(undefined).then(resolve),
  });
  return { insert: insertMock, values: valuesMock };
}

function createUpdateChainMock() {
  const setMock = vi.fn();
  const updateMock = vi.fn(() => ({ set: setMock }));
  setMock.mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  });
  return { update: updateMock, set: setMock };
}

// The mock db object that will be mutated per test
const mockDb: Record<string, unknown> = {};

vi.mock("@/server/db", () => ({
  get db() {
    return mockDb;
  },
}));

// Import after mocks
import {
  createNarasumber,
  updateNarasumber,
  deactivateNarasumber,
  assignNarasumberToKegiatan,
} from "@/server/actions/ppl-evaluasi/narasumber";

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function setupMocks(opts: {
  selectResults: unknown[][];
  insertReturn?: unknown;
}) {
  const selectMock = createSelectChainMock(opts.selectResults);
  const insertMock = createInsertChainMock(opts.insertReturn);
  const updateMock = createUpdateChainMock();

  Object.assign(mockDb, {
    select: selectMock.select,
    insert: insertMock.insert,
    update: updateMock.update,
  });

  return { selectMock, insertMock, updateMock };
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("Narasumber Server Actions - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Requirement 2.8: Duplicate email rejection ────────────────────────────

  describe("createNarasumber - duplicate email rejection", () => {
    it("returns error when email already exists", async () => {
      setupMocks({
        selectResults: [
          // Email uniqueness check: existing record found
          [{ id: 99 }],
        ],
      });

      const result = await createNarasumber({
        nama: "John Doe",
        email: "john@example.com",
        feePerSkp: 500000,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Email sudah digunakan oleh narasumber lain");
    });
  });

  describe("updateNarasumber - duplicate email rejection", () => {
    it("returns error when updating to an email that belongs to another narasumber", async () => {
      setupMocks({
        selectResults: [
          // First: narasumber exists
          [{ id: 1 }],
          // Second: email uniqueness check finds duplicate
          [{ id: 2 }],
        ],
      });

      const result = await updateNarasumber(1, {
        email: "duplicate@example.com",
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Email sudah digunakan oleh narasumber lain");
    });
  });

  // ─── Requirement 2.7: Deactivation instead of deletion ─────────────────────

  describe("deactivateNarasumber - soft delete when referenced", () => {
    it("sets isActive=false when narasumber has kegiatan assignments", async () => {
      const { updateMock } = setupMocks({
        selectResults: [
          // First: narasumber exists
          [{ id: 1 }],
          // Second: count of assignments > 0
          [{ count: 3 }],
        ],
      });

      const result = await deactivateNarasumber(1);

      expect(result.ok).toBe(true);
      expect(updateMock.update).toHaveBeenCalled();
      expect(updateMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it("sets isActive=false even when narasumber has no assignments", async () => {
      const { updateMock } = setupMocks({
        selectResults: [
          // First: narasumber exists
          [{ id: 1 }],
          // Second: count of assignments = 0
          [{ count: 0 }],
        ],
      });

      const result = await deactivateNarasumber(1);

      expect(result.ok).toBe(true);
      expect(updateMock.update).toHaveBeenCalled();
      expect(updateMock.set).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });
  });

  // ─── Requirement 2.5: Honorarium calculation ───────────────────────────────

  describe("assignNarasumberToKegiatan - honorarium calculation", () => {
    it("calculates totalHonorarium as feePerSkp × SKP", async () => {
      const { insertMock } = setupMocks({
        selectResults: [
          // First: narasumber exists and is active
          [{ id: 1, feePerSkp: 500000, isActive: true }],
          // Second: kegiatan exists
          [{ id: 10, skp: 16, statusEvent: "aktif" }],
        ],
      });

      const result = await assignNarasumberToKegiatan({
        kegiatanId: 10,
        narasumberId: 1,
        topik: "Perpajakan Dasar",
      });

      expect(result.ok).toBe(true);
      expect(insertMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          totalHonorarium: 500000 * 16, // 8_000_000
          kegiatanId: 10,
          narasumberId: 1,
          topik: "Perpajakan Dasar",
        }),
      );
    });

    it("returns error when assigning an inactive narasumber", async () => {
      setupMocks({
        selectResults: [
          // Narasumber exists but is inactive
          [{ id: 1, feePerSkp: 500000, isActive: false }],
        ],
      });

      const result = await assignNarasumberToKegiatan({
        kegiatanId: 10,
        narasumberId: 1,
      });

      expect(result.ok).toBe(false);
      expect(result.error).toBe("Narasumber tidak aktif");
    });
  });
});
