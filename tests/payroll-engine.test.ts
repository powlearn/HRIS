import { describe, expect, it } from "vitest";
import { annualIncomeTax, computePayroll, type EmployeePayrollInput } from "@/modules/payroll/engine";
import { payrollPolicyConfigSchema } from "@/modules/payroll/policy";
import { Decimal } from "@/lib/money";

const config = payrollPolicyConfigSchema.parse({
  currency: "IDR",
  workingDaysPerMonth: 21,
  overtime: { weekdayMultiplier: 1.5, holidayMultiplier: 2, divisorHoursPerMonth: 173 },
  bpjs: {
    kesehatan: { employeePercent: 1, employerPercent: 4, maxBase: 12_000_000 },
    jht: { employeePercent: 2, employerPercent: 3.7 },
    jp: { employeePercent: 1, employerPercent: 2, maxBase: 10_042_300 },
    jkk: { employerPercent: 0.24 },
    jkm: { employerPercent: 0.3 },
  },
  tax: {
    method: "PROGRESIF_TAHUNAN",
    ptkp: { "TK/0": 54_000_000, "K/1": 63_000_000 },
    brackets: [
      { upTo: 60_000_000, rate: 5 },
      { upTo: 250_000_000, rate: 15 },
      { upTo: 500_000_000, rate: 25 },
      { upTo: 5_000_000_000, rate: 30 },
      { upTo: null, rate: 35 },
    ],
  },
  rounding: "NEAREST_RUPIAH",
});

const baseInput: EmployeePayrollInput = {
  employeeId: "emp-1",
  employeeCode: "NDG-0001",
  employeeName: "Karyawan Uji",
  basicSalary: 10_000_000,
  ptkpStatus: "TK/0",
  components: [
    {
      component: {
        code: "TUNJ_TRANSPORT",
        name: "Tunjangan Transport",
        type: "EARNING",
        calculation: "FIXED",
        amount: "750000",
        isTaxable: true,
        isStatutory: false,
      },
      amount: "750000",
    },
  ],
  attendance: { presentDays: 21, unpaidLeaveDays: 0, overtimeMinutes: 0 },
};

describe("payroll engine", () => {
  it("is deterministic for identical inputs", () => {
    const a = computePayroll(baseInput, config);
    const b = computePayroll(baseInput, config);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("sums gross pay from base salary, allowances and overtime", () => {
    const result = computePayroll(
      { ...baseInput, attendance: { presentDays: 21, unpaidLeaveDays: 0, overtimeMinutes: 120 } },
      config,
    );
    // base 10jt + transport 750rb + overtime 2h * (10jt/173) * 1.5
    const expectedOvertime = new Decimal(10_000_000).div(173).mul(2).mul(1.5).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);
    expect(new Decimal(result.grossPay).toNumber()).toBe(10_000_000 + 750_000 + expectedOvertime.toNumber());
  });

  it("caps BPJS base at the policy maximum", () => {
    const result = computePayroll({ ...baseInput, basicSalary: 20_000_000, components: [] }, config);
    const kes = result.lines.find((line) => line.code === "BPJS_KES_EE");
    const jp = result.lines.find((line) => line.code === "BPJS_JP_EE");
    expect(Number(kes?.amount)).toBe(120_000); // 1% of capped 12jt
    expect(Number(jp?.amount)).toBe(100_423); // 1% of capped 10.042.300
  });

  it("never produces negative net pay", () => {
    const result = computePayroll(
      {
        ...baseInput,
        basicSalary: 1_000_000,
        components: [
          {
            component: {
              code: "POT_BESAR",
              name: "Potongan besar",
              type: "DEDUCTION",
              calculation: "FIXED",
              amount: "5000000",
              isTaxable: false,
              isStatutory: false,
            },
            amount: "5000000",
          },
        ],
      },
      config,
    );
    expect(new Decimal(result.netPay).gte(0)).toBe(true);
  });

  it("applies progressive tax brackets from configuration", () => {
    // 60jt @5% = 3jt, remaining 40jt @15% = 6jt
    expect(annualIncomeTax(new Decimal(100_000_000), config).toNumber()).toBe(9_000_000);
    expect(annualIncomeTax(new Decimal(0), config).toNumber()).toBe(0);
    expect(annualIncomeTax(new Decimal(-5), config).toNumber()).toBe(0);
  });

  it("deducts daily rate for unpaid leave", () => {
    const result = computePayroll(
      { ...baseInput, attendance: { presentDays: 19, unpaidLeaveDays: 2, overtimeMinutes: 0 } },
      config,
    );
    const line = result.lines.find((item) => item.code === "POTONGAN_TIDAK_HADIR");
    expect(Number(line?.amount)).toBe(Math.round((10_000_000 / 21) * 2));
    expect(new Decimal(result.netPay).lt(result.grossPay)).toBe(true);
  });
});
