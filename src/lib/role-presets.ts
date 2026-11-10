import { PERMISSIONS, type PermissionKey } from "@/lib/rbac";

/**
 * Default role templates seeded per tenant. Administrators can change these at
 * runtime (Settings → Peran & Izin); the presets are only used for bootstrap.
 */
export type RolePreset = {
  slug: string;
  name: string;
  description: string;
  level: number;
  isSystem: boolean;
  permissions: PermissionKey[];
};

const HR_MANAGER: PermissionKey[] = [
  "dashboard.view",
  "org.manage",
  "employee.read",
  "employee.create",
  "employee.update",
  "employee.sensitive.read",
  "employee.export",
  "attendance.read",
  "attendance.manage",
  "attendance.clock",
  "attendance.correction.approve",
  "leave.read",
  "leave.request",
  "leave.manage",
  "leave.approve",
  "payroll.read",
  "payroll.manage",
  "recruitment.read",
  "recruitment.manage",
  "performance.read",
  "performance.manage",
  "performance.review.self",
  "document.read",
  "document.manage",
  "report.view",
  "ai.use",
  "ai.configure",
  "settings.read",
  "audit.view",
];

const HR_STAFF: PermissionKey[] = [
  "dashboard.view",
  "employee.read",
  "employee.create",
  "employee.update",
  "attendance.read",
  "attendance.manage",
  "attendance.clock",
  "leave.read",
  "leave.request",
  "leave.manage",
  "payroll.read",
  "recruitment.read",
  "recruitment.manage",
  "performance.read",
  "document.read",
  "document.manage",
  "report.view",
  "ai.use",
  "settings.read",
];

export const ROLE_PRESETS: RolePreset[] = [
  {
    slug: "super_admin",
    name: "Super Admin",
    description: "Akses platform penuh, termasuk konfigurasi lintas tenant.",
    level: 100,
    isSystem: true,
    permissions: ["*"],
  },
  {
    slug: "company_admin",
    name: "Company Admin",
    description: "Administrator perusahaan dengan kendali penuh atas tenant.",
    level: 90,
    isSystem: true,
    permissions: PERMISSIONS.filter((permission) => permission.key !== "*").map((permission) => permission.key),
  },
  {
    slug: "hr_manager",
    name: "HR Manager",
    description: "Memimpin fungsi SDM: data karyawan, kebijakan, approval, dan payroll.",
    level: 70,
    isSystem: true,
    permissions: [...HR_MANAGER, "payroll.approve", "role.manage", "settings.manage"],
  },
  {
    slug: "hr_staff",
    name: "HR Staff",
    description: "Operasional SDM harian: administrasi karyawan, kehadiran, dan rekrutmen.",
    level: 50,
    isSystem: true,
    permissions: HR_STAFF,
  },
  {
    slug: "dept_manager",
    name: "Department Manager",
    description: "Approval cuti & koreksi tim, penilaian kinerja, dan visibilitas tim.",
    level: 40,
    isSystem: true,
    permissions: [
      "dashboard.view",
      "employee.read.team",
      "attendance.read.team",
      "attendance.clock",
      "leave.read",
      "leave.request",
      "leave.approve",
      "performance.read",
      "performance.manage",
      "performance.review.self",
      "document.read",
      "report.view",
      "ai.use",
    ],
  },
  {
    slug: "employee",
    name: "Karyawan",
    description: "Akses mandiri: absensi, cuti, slip gaji, dan penilaian diri.",
    level: 10,
    isSystem: true,
    permissions: [
      "dashboard.view",
      "attendance.clock",
      "leave.read",
      "leave.request",
      "payroll.read.self",
      "performance.review.self",
      "document.read",
      "ai.use",
    ],
  },
];
