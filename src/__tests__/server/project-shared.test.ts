vi.mock("@/server/db", () => ({
  db: {
    insert: vi.fn(),
    select: vi.fn(),
  },
}));

vi.mock("@/server/db/schema", () => ({
  notifications: {},
  projectActivityLog: {},
  projectComments: {},
  projectFiles: {},
  projectLabels: {},
  projectMembers: {},
  projects: {},
  projectToLabels: {},
  users: {},
}));

vi.mock("@/server/actions/notifications", () => ({
  createNotification: vi.fn(),
}));

vi.mock("@/server/actions/notificationPreferences", () => ({
  checkNotificationPreference: vi.fn(),
}));

vi.mock("@/server/actions/auth", () => ({
  requireSession: vi.fn(),
}));

vi.mock("@/lib/html/announcementHtml", () => ({
  sanitizeAnnouncementHtml: (value: string) => value,
}));

vi.mock("@/lib/skp-calculator", () => ({
  calculateSKP: vi.fn(),
}));

import {
  canWrite,
  mapProjectBase,
  minutesBetween,
  normalizeError,
  normalizeOptionalText,
  numberToNumeric,
  projectSchema,
} from "@/server/actions/_project-shared";

describe("project shared utilities", () => {
  it("normalizes blank optional text to null", () => {
    expect(normalizeOptionalText("  ")).toBeNull();
    expect(normalizeOptionalText(null)).toBeNull();
    expect(normalizeOptionalText("  Project note  ")).toBe("Project note");
  });

  it("converts nullable numbers to database numeric strings", () => {
    expect(numberToNumeric(125000)).toBe("125000");
    expect(numberToNumeric(null)).toBeNull();
    expect(numberToNumeric(undefined)).toBeNull();
  });

  it("allows only admin, owner, and manager roles to write", () => {
    expect(canWrite("admin")).toBe(true);
    expect(canWrite("owner")).toBe(true);
    expect(canWrite("manager")).toBe(true);
    expect(canWrite("member")).toBe(false);
    expect(canWrite("viewer")).toBe(false);
  });

  it("normalizes forbidden errors to a localized message", () => {
    expect(normalizeError(new Error("Forbidden"), "Gagal")).toBe(
      "Anda tidak memiliki izin untuk aksi ini.",
    );
    expect(normalizeError(new Error("DB down"), "Gagal")).toBe("Gagal: DB down");
  });

  it("never returns negative durations", () => {
    expect(
      minutesBetween(
        new Date("2024-02-01T00:00:00.000Z"),
        new Date("2024-02-01T01:30:00.000Z"),
      ),
    ).toBe(90);
    expect(
      minutesBetween(
        new Date("2024-02-01T01:30:00.000Z"),
        new Date("2024-02-01T00:00:00.000Z"),
      ),
    ).toBe(0);
  });

  it("rejects project end dates before start dates", () => {
    const result = projectSchema.safeParse({
      title: "Seminar Pajak",
      type: "Seminar",
      startDate: "2024-02-02",
      endDate: "2024-02-01",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    );
  });

  it("maps raw project rows to typed project rows without changing values", () => {
    const createdAt = new Date("2024-02-01T00:00:00.000Z");
    const updatedAt = new Date("2024-02-02T00:00:00.000Z");

    expect(
      mapProjectBase({
        id: "project-1",
        title: "Seminar Pajak",
        type: "Seminar",
        status: "in_progress",
        description: null,
        startDate: "2024-02-01",
        endDate: "2024-02-02",
        price: "100000",
        priceMember: null,
        priceNonMember: null,
        tipePelaksanaan: "offline",
        waktuMulai: "09:00",
        waktuSelesai: "12:00",
        lokasi: "Jakarta",
        maxPeserta: 100,
        isWaitlistEnabled: false,
        skp: "4",
        skpMode: "manual",
        halfDaySkp: null,
        progress: 30,
        kelasUjianId: null,
        isTemplate: false,
        templateSourceId: null,
        createdBy: "user-1",
        createdByName: "Admin",
        createdAt,
        updatedAt,
      }),
    ).toMatchObject({
      id: "project-1",
      type: "Seminar",
      status: "in_progress",
      tipePelaksanaan: "offline",
      createdAt,
      updatedAt,
    });
  });
});
