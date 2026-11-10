import Decimal from "decimal.js";

// Deterministic money arithmetic: all payroll math runs in Decimal, never float.
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export { Decimal };

export type MoneyInput = Decimal | number | string;

export function money(value: MoneyInput): Decimal {
  return new Decimal(value ?? 0);
}

export const ZERO = new Decimal(0);

export function sum(values: MoneyInput[]): Decimal {
  return values.reduce<Decimal>((acc, value) => acc.plus(money(value)), new Decimal(0));
}

export function percentage(base: MoneyInput, percent: MoneyInput): Decimal {
  return money(base).mul(money(percent)).div(100);
}

export function roundRupiah(value: MoneyInput): Decimal {
  return money(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
}

export function formatIDR(value: MoneyInput, options: { withSymbol?: boolean } = {}): string {
  const amount = money(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
  const formatted = new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount.toNumber());
  return options.withSymbol === false ? formatted : `Rp ${formatted}`;
}

export function formatCompactIDR(value: MoneyInput): string {
  const amount = money(value);
  const abs = amount.abs();
  const localize = (input: MoneyInput, fractionDigits: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: fractionDigits }).format(money(input).toNumber());
  if (abs.gte(1_000_000_000)) return `Rp ${localize(amount.div(1_000_000_000), 1)} M`;
  if (abs.gte(1_000_000)) return `Rp ${localize(amount.div(1_000_000), 1)} jt`;
  if (abs.gte(1_000)) return `Rp ${localize(amount.div(1_000), 0)} rb`;
  return formatIDR(amount);
}

export function toNumber(value: MoneyInput | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return money(value).toNumber();
}

export function decimalFromDb(value: unknown): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  return new Decimal(value as string);
}
