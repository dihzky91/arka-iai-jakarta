import { cn } from "@/lib/utils";

describe("vitest setup", () => {
  it("runs tests", () => {
    expect(true).toBe(true);
  });

  it("resolves the @ path alias", () => {
    expect(cn).toBeDefined();
    expect(cn("text-sm", false && "hidden")).toBe("text-sm");
  });
});
