import { Decimal, money, percentage, roundRupiah, sum } from "@/lib/money";
import type { PayrollPolicyConfig } from "@/modules/payroll/policy";

/**
 * Deterministic payroll computation.
 *
 * Pure function: no database, no network, no AI. All arithmetic uses Decimal and
 * every rate comes from the supplied policy version. Given the same inputs the
 * output is byte-for-byte identical, which is what makes payslips auditable.
 */

export type PayrollComponentInput = {
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  calculation: "FIXED" | "PERCENT_OF_BASE" | "DAILY_RATE" | "OVERTIME_HOUR";
  amount: string | number;
  percent?: string | number | null;
  isTaxable: boolean;
  isStatutory: boolean;
};

export type EmployeePayrollInput = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  basicSalary: string | number;
  ptkpStatus?: string;
  components: { component: PayrollComponentInput; amount: string | number }[];
  attendance: {
    presentDays: number;
    unpaidLeaveDays: number;
    overtimeMinutes: number;
  };
};

export type PayslipLine = {
  code: string;
  name: string;
  type: "EARNING" | "DEDUCTION";
  amount: string;
  taxable: boolean;
  statutory: boolean;
};

export type PayrollComputation = {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  basicSalary: string;
  dailyRate: string;
  attendanceDays: number;
  unpaidLeaveDays: string;
  overtimeHours: string;
  overtimePay: string;
  grossPay: string;
  taxableGross: string;
  totalDeductions: string;
  netPay: string;
  lines: PayslipLine[];
  employerContributions: { code: string; name: string; amount: string }[];
};

function round(value: Decimal): Decimal {
  return roundRupiah(value);
}

function cappedBase(base: Decimal, maxBase?: number): Decimal {
  if (maxBase === undefined || maxBase === null) return base;
  return Decimal.min(base, money(maxBase));
}

/** Annual progressive tax from bracketed policy configuration. */
export function annualIncomeTax(taxableAnnual: Decimal, config: PayrollPolicyConfig): Decimal {
  if (taxableAnnual.lte(0)) return new Decimal(0);
  let remaining = taxableAnnual;
  let previousCap = new Decimal(0);
  let tax = new Decimal(0);

  for (const bracket of config.tax.brackets) {
    const cap = bracket.upTo === null ? null : money(bracket.upTo);
    const slice = cap === null ? remaining : Decimal.min(remaining, Decimal.max(0, cap.minus(previousCap)));
    if (slice.gt(0)) tax = tax.plus(percentage(slice, bracket.rate));
    remaining = remaining.minus(slice);
    if (cap !== null) previousCap = cap;
    if (remaining.lte(0)) break;
  }
  return tax;
}

export function computePayroll(input: EmployeePayrollInput, config: PayrollPolicyConfig): PayrollComputation {
  const base = money(input.basicSalary);
  const workingDays = money(config.workingDaysPerMonth);
  const dailyRate = workingDays.gt(0) ? base.div(workingDays) : new Decimal(0);

  const lines: PayslipLine[] = [];
  const earnings: Decimal[] = [];
  const deductions: Decimal[] = [];
  const taxableEarnings: Decimal[] = [];
  const employerContributions: { code: string; name: string; amount: string }[] = [];

  const addEarning = (code: string, name: string, amount: Decimal, taxable: boolean, statutory = false) => {
    const rounded = round(amount);
    if (rounded.lte(0)) return;
    lines.push({ code, name, type: "EARNING", amount: rounded.toFixed(2), taxable, statutory });
    earnings.push(rounded);
    if (taxable) taxableEarnings.push(rounded);
  };

  const addDeduction = (code: string, name: string, amount: Decimal, taxable: boolean, statutory = false) => {
    const rounded = round(amount);
    if (rounded.lte(0)) return;
    lines.push({ code, name, type: "DEDUCTION", amount: rounded.toFixed(2), taxable, statutory });
    deductions.push(rounded);
  };

  // 1. Base salary and prorated absence deduction.
  addEarning("GAJI_POKOK", "Gaji Pokok", base, true);
  const unpaid = money(input.attendance.unpaidLeaveDays);
  if (unpaid.gt(0)) {
    addDeduction("POTONGAN_TIDAK_HADIR", "Potongan cuti tidak berbayar", dailyRate.mul(unpaid), true);
  }

  // 2. Overtime from attendance, priced by the policy divisor & multiplier.
  const overtimeHours = money(input.attendance.overtimeMinutes).div(60);
  const hourly = money(config.overtime.divisorHoursPerMonth).gt(0)
    ? base.div(money(config.overtime.divisorHoursPerMonth))
    : new Decimal(0);
  const overtimePay = hourly.mul(overtimeHours).mul(money(config.overtime.weekdayMultiplier));
  addEarning("UPAH_LEMBUR", "Upah lembur", overtimePay, true);

  // 3. Non-statutory earning components (tunjangan).
  for (const { component, amount } of input.components) {
    if (component.type !== "EARNING" || component.isStatutory) continue;
    let value = new Decimal(0);
    if (component.calculation === "PERCENT_OF_BASE") value = percentage(base, component.percent ?? 0);
    else if (component.calculation === "DAILY_RATE") value = dailyRate.mul(money(amount));
    else value = money(amount);
    addEarning(component.code, component.name, value, component.isTaxable);
  }

  const grossPay = sum(earnings);

  // 4. Statutory employee deductions (BPJS) from policy percentages.
  const bpjs = config.bpjs;
  const bpjsKes = percentage(cappedBase(base, bpjs.kesehatan.maxBase), bpjs.kesehatan.employeePercent);
  addDeduction("BPJS_KES_EE", "BPJS Kesehatan (karyawan)", bpjsKes, false, true);

  const jht = percentage(cappedBase(base, bpjs.jht.maxBase), bpjs.jht.employeePercent);
  addDeduction("BPJS_JHT_EE", "BPJS JHT (karyawan)", jht, false, true);

  const jp = percentage(cappedBase(base, bpjs.jp.maxBase), bpjs.jp.employeePercent);
  addDeduction("BPJS_JP_EE", "BPJS Jaminan Pensiun (karyawan)", jp, false, true);

  // 5. PPh 21 estimate: annualise taxable gross, apply PTKP + brackets, /12.
  const taxableGross = sum(taxableEarnings);
  const ptkpKey = input.ptkpStatus ?? "TK/0";
  const ptkp = money(config.tax.ptkp[ptkpKey] ?? config.tax.ptkp["TK/0"] ?? 0);
  const annualTaxable = Decimal.max(taxableGross.mul(12).minus(ptkp), 0);
  const monthlyTax = annualIncomeTax(annualTaxable, config).div(12);
  addDeduction("PPH21", "PPh 21 (estimasi)", monthlyTax, false, true);

  // 6. Other deduction components configured for the employee.
  for (const { component, amount } of input.components) {
    if (component.type !== "DEDUCTION" || component.isStatutory) continue;
    let value = new Decimal(0);
    if (component.calculation === "PERCENT_OF_BASE") value = percentage(base, component.percent ?? 0);
    else if (component.calculation === "DAILY_RATE") value = dailyRate.mul(money(amount));
    else value = money(amount);
    addDeduction(component.code, component.name, value, component.isTaxable, false);
  }

  // 7. Employer contributions are informational (not deducted from net pay).
  const employerKes = percentage(cappedBase(base, bpjs.kesehatan.maxBase), bpjs.kesehatan.employerPercent);
  const employerJht = percentage(cappedBase(base, bpjs.jht.maxBase), bpjs.jht.employerPercent);
  const employerJp = percentage(cappedBase(base, bpjs.jp.maxBase), bpjs.jp.employerPercent);
  const employerJkk = percentage(base, bpjs.jkk.employerPercent);
  const employerJkm = percentage(base, bpjs.jkm.employerPercent);
  for (const [code, name, amount] of [
    ["BPJS_KES_ER", "BPJS Kesehatan (perusahaan)", employerKes],
    ["BPJS_JHT_ER", "BPJS JHT (perusahaan)", employerJht],
    ["BPJS_JP_ER", "BPJS JP (perusahaan)", employerJp],
    ["BPJS_JKK_ER", "BPJS JKK (perusahaan)", employerJkk],
    ["BPJS_JKM_ER", "BPJS JKM (perusahaan)", employerJkm],
  ] as const) {
    const value = round(amount as Decimal);
    if (value.gt(0)) employerContributions.push({ code, name, amount: value.toFixed(2) });
  }

  const totalDeductions = sum(deductions);
  const netPay = Decimal.max(grossPay.minus(totalDeductions), 0);

  return {
    employeeId: input.employeeId,
    employeeCode: input.employeeCode,
    employeeName: input.employeeName,
    basicSalary: round(base).toFixed(2),
    dailyRate: round(dailyRate).toFixed(2),
    attendanceDays: input.attendance.presentDays,
    unpaidLeaveDays: unpaid.toFixed(1),
    overtimeHours: overtimeHours.toDecimalPlaces(2).toFixed(2),
    overtimePay: round(overtimePay).toFixed(2),
    grossPay: round(grossPay).toFixed(2),
    taxableGross: round(taxableGross).toFixed(2),
    totalDeductions: round(totalDeductions).toFixed(2),
    netPay: round(netPay).toFixed(2),
    lines,
    employerContributions,
  };
}
