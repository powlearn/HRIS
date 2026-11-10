import { z } from "zod";
import { bankAccountSchema, emailSchema, nikSchema, optionalDateKeySchema, phoneSchema } from "@/lib/validation";

export const employeeCreateSchema = z.object({
  firstName: z.string().trim().min(2, "Nama depan minimal 2 karakter").max(80),
  lastName: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  email: emailSchema,
  phone: phoneSchema,
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  birthDate: optionalDateKeySchema,
  birthPlace: z.string().trim().max(80).optional(),
  maritalStatus: z.enum(["BELUM_MENIKAH", "MENIKAH", "CERAI"]).optional(),
  religion: z.string().trim().max(40).optional(),
  address: z.string().trim().max(300).optional(),
  city: z.string().trim().max(80).optional(),
  postalCode: z.string().trim().max(10).optional(),

  departmentId: z.string().min(1, "Departemen wajib dipilih"),
  positionId: z.string().min(1, "Jabatan wajib dipilih"),
  locationId: z.string().min(1, "Lokasi kerja wajib dipilih"),
  managerId: z.string().optional().or(z.literal("").transform(() => undefined)),
  scheduleId: z.string().optional().or(z.literal("").transform(() => undefined)),
  status: z.enum(["PERMANENT", "CONTRACT", "PROBATION", "INTERN"]).default("PROBATION"),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal bergabung wajib diisi"),
  endDate: optionalDateKeySchema,
  basicSalary: z.coerce.number().min(0, "Gaji pokok tidak boleh negatif").max(1_000_000_000),
  contractType: z.enum(["PERMANENT", "FIXED_TERM", "PROBATION", "INTERNSHIP"]).default("PROBATION"),

  bankName: z.string().trim().max(60).optional(),
  bankAccount: bankAccountSchema,
  nik: nikSchema,
  npwp: z.string().trim().max(30).optional(),
  ptkpStatus: z.string().trim().max(10).optional(),

  emergencyName: z.string().trim().max(80).optional(),
  emergencyRelation: z.string().trim().max(40).optional(),
  emergencyPhone: phoneSchema,
});

export const employeeUpdateSchema = employeeCreateSchema.partial().extend({
  id: z.string().min(1),
});

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;
