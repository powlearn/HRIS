/**
 * Permission catalog. Stored in the database (Permission + RolePermission) so
 * administrators can reconfigure roles per module and action at runtime.
 * `*` is a platform-level wildcard reserved for Super Admin.
 */
export type PermissionKey =
  | "*"
  | "dashboard.view"
  | "org.manage"
  | "employee.read"
  | "employee.read.team"
  | "employee.create"
  | "employee.update"
  | "employee.delete"
  | "employee.sensitive.read"
  | "employee.export"
  | "attendance.read"
  | "attendance.read.team"
  | "attendance.manage"
  | "attendance.clock"
  | "attendance.correction.approve"
  | "leave.read"
  | "leave.request"
  | "leave.manage"
  | "leave.approve"
  | "payroll.read"
  | "payroll.read.self"
  | "payroll.manage"
  | "payroll.approve"
  | "recruitment.read"
  | "recruitment.manage"
  | "performance.read"
  | "performance.review.self"
  | "performance.manage"
  | "document.read"
  | "document.manage"
  | "report.view"
  | "ai.use"
  | "ai.configure"
  | "settings.read"
  | "settings.manage"
  | "role.manage"
  | "audit.view";

export type PermissionDef = {
  key: PermissionKey;
  module: string;
  action: string;
  label: string;
};

export const PERMISSIONS: PermissionDef[] = [
  { key: "*", module: "sistem", action: "*", label: "Akses penuh (Super Admin)" },
  { key: "dashboard.view", module: "dasbor", action: "lihat", label: "Melihat dasbor" },
  { key: "org.manage", module: "organisasi", action: "kelola", label: "Mengelola departemen, jabatan & lokasi" },
  { key: "employee.read", module: "karyawan", action: "lihat", label: "Melihat seluruh data karyawan" },
  { key: "employee.read.team", module: "karyawan", action: "lihat-tim", label: "Melihat data anggota tim sendiri" },
  { key: "employee.create", module: "karyawan", action: "buat", label: "Menambah karyawan" },
  { key: "employee.update", module: "karyawan", action: "ubah", label: "Mengubah data karyawan" },
  { key: "employee.delete", module: "karyawan", action: "hapus", label: "Menonaktifkan karyawan" },
  { key: "employee.sensitive.read", module: "karyawan", action: "lihat-sensitif", label: "Melihat NIK, NPWP & rekening" },
  { key: "employee.export", module: "karyawan", action: "ekspor", label: "Mengekspor data karyawan" },
  { key: "attendance.read", module: "kehadiran", action: "lihat", label: "Melihat seluruh kehadiran" },
  { key: "attendance.read.team", module: "kehadiran", action: "lihat-tim", label: "Melihat kehadiran tim" },
  { key: "attendance.manage", module: "kehadiran", action: "kelola", label: "Mengelola jadwal & koreksi kehadiran" },
  { key: "attendance.clock", module: "kehadiran", action: "absensi", label: "Melakukan clock-in / clock-out" },
  { key: "attendance.correction.approve", module: "kehadiran", action: "setujui-koreksi", label: "Menyetujui koreksi kehadiran" },
  { key: "leave.read", module: "cuti", action: "lihat", label: "Melihat data cuti" },
  { key: "leave.request", module: "cuti", action: "ajukan", label: "Mengajukan cuti" },
  { key: "leave.manage", module: "cuti", action: "kelola", label: "Mengelola jenis & kuota cuti" },
  { key: "leave.approve", module: "cuti", action: "setujui", label: "Menyetujui pengajuan cuti" },
  { key: "payroll.read", module: "payroll", action: "lihat", label: "Melihat seluruh penggajian" },
  { key: "payroll.read.self", module: "payroll", action: "lihat-sendiri", label: "Melihat slip gaji sendiri" },
  { key: "payroll.manage", module: "payroll", action: "kelola", label: "Menjalankan proses payroll" },
  { key: "payroll.approve", module: "payroll", action: "setujui", label: "Menyetujui payroll" },
  { key: "recruitment.read", module: "rekrutmen", action: "lihat", label: "Melihat rekrutmen" },
  { key: "recruitment.manage", module: "rekrutmen", action: "kelola", label: "Mengelola lowongan & pelamar" },
  { key: "performance.read", module: "kinerja", action: "lihat", label: "Melihat data kinerja" },
  { key: "performance.review.self", module: "kinerja", action: "nilai-diri", label: "Mengisi penilaian diri" },
  { key: "performance.manage", module: "kinerja", action: "kelola", label: "Mengelola siklus & penilaian kinerja" },
  { key: "document.read", module: "dokumen", action: "lihat", label: "Melihat dokumen karyawan" },
  { key: "document.manage", module: "dokumen", action: "kelola", label: "Mengunggah & menghapus dokumen" },
  { key: "report.view", module: "laporan", action: "lihat", label: "Melihat laporan & analitik" },
  { key: "ai.use", module: "ai", action: "gunakan", label: "Menggunakan AI HR Copilot" },
  { key: "ai.configure", module: "ai", action: "konfigurasi", label: "Mengonfigurasi AI HR Copilot" },
  { key: "settings.read", module: "pengaturan", action: "lihat", label: "Melihat pengaturan sistem" },
  { key: "settings.manage", module: "pengaturan", action: "kelola", label: "Mengubah pengaturan sistem" },
  { key: "role.manage", module: "pengaturan", action: "kelola-peran", label: "Mengelola peran & izin" },
  { key: "audit.view", module: "pengaturan", action: "lihat-audit", label: "Melihat jejak audit" },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export function hasPermission(permissions: string[] | undefined, required: PermissionKey | PermissionKey[]): boolean {
  if (!permissions?.length) return false;
  if (permissions.includes("*")) return true;
  const list = Array.isArray(required) ? required : [required];
  return list.some((key) => permissions.includes(key));
}

export function hasAnyPermission(permissions: string[] | undefined, required: PermissionKey[]): boolean {
  return hasPermission(permissions, required);
}

export const NAV_PERMISSIONS: Record<string, PermissionKey> = {
  "/dashboard": "dashboard.view",
  "/employees": "employee.read",
  "/attendance": "attendance.read",
  "/leave": "leave.read",
  "/payroll": "payroll.read",
  "/recruitment": "recruitment.read",
  "/performance": "performance.read",
  "/documents": "document.read",
  "/reports": "report.view",
  "/ai": "ai.use",
  "/settings": "settings.read",
};
