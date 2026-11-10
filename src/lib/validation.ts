import { z } from "zod";

export const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD");

export const optionalDateKeySchema = z
  .union([dateKeySchema, z.literal("")])
  .optional()
  .transform((value) => (value ? value : undefined));

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Warna harus berformat hex, misalnya #6366f1");

export const emailSchema = z.string().trim().toLowerCase().email("Format email tidak valid").max(254);

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[\d\s()-]{7,20}$/, "Nomor telepon tidak valid")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const passwordSchema = z
  .string()
  .min(10, "Kata sandi minimal 10 karakter")
  .max(128, "Kata sandi maksimal 128 karakter")
  .regex(/[A-Za-z]/, "Kata sandi harus memuat huruf")
  .regex(/\d/, "Kata sandi harus memuat angka");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(5).max(100).default(20),
});

export const bankAccountSchema = z
  .string()
  .trim()
  .regex(/^\d{6,20}$/, "Nomor rekening harus 6-20 digit")
  .optional()
  .or(z.literal("").transform(() => undefined));

export const nikSchema = z
  .string()
  .trim()
  .regex(/^\d{16}$/, "NIK harus 16 digit")
  .optional()
  .or(z.literal("").transform(() => undefined));

export function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n;]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) lines.push(row.map(csvEscape).join(","));
  // BOM keeps Excel happy with UTF-8 Indonesian characters.
  return `\uFEFF${lines.join("\r\n")}`;
}
