import {
  addDaysToIsoDate,
  formatBulanRomawi,
  formatTanggal,
  getTodayIsoInJakarta,
  parseIsoDateTimeInJakarta,
} from "@/lib/utils";

describe("formatBulanRomawi", () => {
  it("formats the first and last month", () => {
    expect(formatBulanRomawi(1)).toBe("I");
    expect(formatBulanRomawi(12)).toBe("XII");
  });

  it("throws for months outside 1-12", () => {
    expect(() => formatBulanRomawi(0)).toThrow("Bulan harus 1-12");
    expect(() => formatBulanRomawi(13)).toThrow("Bulan harus 1-12");
  });
});

describe("getTodayIsoInJakarta", () => {
  it("returns YYYY-MM-DD in Asia/Jakarta for the provided date", () => {
    const date = new Date("2024-01-31T18:00:00.000Z");

    expect(getTodayIsoInJakarta(date)).toBe("2024-02-01");
  });
});

describe("addDaysToIsoDate", () => {
  it("handles month overflow", () => {
    expect(addDaysToIsoDate("2024-01-30", 3)).toBe("2024-02-02");
  });
});

describe("formatTanggal", () => {
  it("returns a dash for empty values", () => {
    expect(formatTanggal(null)).toBe("-");
    expect(formatTanggal(undefined)).toBe("-");
  });

  it("formats a valid ISO string", () => {
    expect(formatTanggal("2024-02-01T00:00:00.000Z")).not.toBe("");
    expect(formatTanggal("2024-02-01T00:00:00.000Z")).not.toBe("-");
  });
});

describe("parseIsoDateTimeInJakarta", () => {
  it("throws for an invalid time", () => {
    expect(() => parseIsoDateTimeInJakarta("2024-02-01", "25:00")).toThrow(
      "Format jam tidak valid",
    );
  });
});
