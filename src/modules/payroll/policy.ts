import { z } from "zod";

/**
 * Payroll policy configuration schema.
 *
 * No statutory rate is compiled into the application. Every percentage, cap,
 * bracket and threshold below is read from a versioned `PayrollPolicy` row that
 * an administrator maintains (Settings → Kebijakan Payroll). The seeded values
 * are an editable configuration sample, not legal advice.
 */
const rateWithCap = z.object({
  employeePercent: z.number().min(0).max(100).default(0),
  employerPercent: z.number().min(0).max(100).default(0),
  maxBase: z.number().nonnegative().optional(),
});

export const payrollPolicyConfigSchema = z.object({
  currency: z.string().default("IDR"),
  workingDaysPerMonth: z.number().int().min(1).max(31).default(21),
  overtime: z.object({
    weekdayMultiplier: z.number().min(1).default(1.5),
    holidayMultiplier: z.number().min(1).default(2),
    divisorHoursPerMonth: z.number().min(1).default(173),
  }),
  bpjs: z.object({
    kesehatan: rateWithCap,
    jht: rateWithCap,
    jp: rateWithCap,
    jkk: z.object({ employerPercent: z.number().min(0).default(0) }),
    jkm: z.object({ employerPercent: z.number().min(0).default(0) }),
  }),
  tax: z.object({
    method: z.string().default("PROGRESIF_TAHUNAN"),
    ptkp: z.record(z.string(), z.number().nonnegative()),
    brackets: z
      .array(
        z.object({
          upTo: z.number().positive().nullable(),
          rate: z.number().min(0).max(100),
        }),
      )
      .min(1),
  }),
  rounding: z.enum(["NEAREST_RUPIAH", "NONE"]).default("NEAREST_RUPIAH"),
});

export type PayrollPolicyConfig = z.infer<typeof payrollPolicyConfigSchema>;

export function parsePolicyConfig(value: unknown): PayrollPolicyConfig {
  return payrollPolicyConfigSchema.parse(value);
}

export function isPolicyConfigValid(value: unknown): boolean {
  return payrollPolicyConfigSchema.safeParse(value).success;
}
