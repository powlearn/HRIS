import { beforeAll, describe, expect, it } from "vitest";
import { hasPermission } from "@/lib/rbac";
import { decryptField, encryptField, maskEmail, maskValue } from "@/lib/crypto";
import { toCsv } from "@/lib/validation";
import { dateOnly, inclusiveDays } from "@/lib/time";

beforeAll(() => {
  process.env.AUTH_SECRET = "test-only-secret-value-with-enough-entropy";
});

describe("RBAC", () => {
  it("grants wildcard access", () => {
    expect(hasPermission(["*"], "payroll.approve")).toBe(true);
  });

  it("denies unknown or empty permission sets", () => {
    expect(hasPermission([], "employee.read")).toBe(false);
    expect(hasPermission(undefined, "employee.read")).toBe(false);
    expect(hasPermission(["leave.read"], "payroll.read")).toBe(false);
  });

  it("accepts any of several required permissions", () => {
    expect(hasPermission(["payroll.read"], ["employee.sensitive.read", "payroll.read"])).toBe(true);
  });
});

describe("field encryption", () => {
  it("round-trips sensitive values", () => {
    const cipher = encryptField("3174012345678901");
    expect(cipher).toBeTruthy();
    expect(cipher).not.toContain("3174012345678901");
    expect(decryptField(cipher)).toBe("3174012345678901");
  });

  it("rejects tampered ciphertext", () => {
    const cipher = encryptField("secret-value")!;
    const parts = cipher.split(":");
    parts[3] = `${parts[3]?.slice(0, -2)}xx`;
    expect(decryptField(parts.join(":"))).toBeNull();
  });

  it("masks values without leaking the prefix", () => {
    const masked = maskValue("1234567890123456");
    expect(masked.endsWith("3456")).toBe(true);
    expect(masked).not.toContain("123456789012");
    expect(maskEmail("sari.hr@nexahr.co.id")).toBe("sa•••••@nexahr.co.id");
  });
});

describe("safe CSV export", () => {
  it("escapes commas, quotes and newlines", () => {
    const csv = toCsv(["Nama", "Catatan"], [['Budi "Bs" Santoso', "baris1\nbaris2"], ["Sari", "a,b"]]);
    expect(csv).toContain('"Budi ""Bs"" Santoso"');
    expect(csv).toContain('"a,b"');
    expect(csv.startsWith("\uFEFF")).toBe(true);
  });
});

describe("timezone-safe dates", () => {
  it("normalizes date keys to UTC midnight", () => {
    expect(dateOnly("2026-11-10").toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });

  it("counts inclusive calendar days", () => {
    expect(inclusiveDays(dateOnly("2026-11-10"), dateOnly("2026-11-12"))).toBe(3);
    expect(inclusiveDays(dateOnly("2026-11-10"), dateOnly("2026-11-10"))).toBe(1);
  });
});
