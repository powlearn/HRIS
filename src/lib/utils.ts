import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function formatNumber(value: number | string, fractionDigits = 0): string {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  }).format(Number(value));
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: fractionDigits }).format(value)}%`;
}

export function truncate(value: string, length = 80): string {
  return value.length > length ? `${value.slice(0, length - 1)}…` : value;
}

export function safeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "Terjadi kesalahan yang tidak diketahui.";
}

export function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function sequenceNumber(prefix: string, year: number, sequence: number): string {
  return `${prefix}/${year}/${String(sequence).padStart(4, "0")}`;
}

export function convertEmptyToNull<T extends Record<string, unknown>>(input: T): T {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, value === "" ? null : value]),
  ) as T;
}
