/** Shared status labels and tones used across modules (Bahasa Indonesia). */

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

export const EMPLOYEE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PERMANENT: { label: "Karyawan Tetap", tone: "success" },
  CONTRACT: { label: "Kontrak", tone: "info" },
  PROBATION: { label: "Probasi", tone: "warning" },
  INTERN: { label: "Magang", tone: "neutral" },
  RESIGNED: { label: "Mengundurkan Diri", tone: "neutral" },
  TERMINATED: { label: "Diberhentikan", tone: "danger" },
};

export const ATTENDANCE_STATUS: Record<string, { label: string; tone: Tone }> = {
  PRESENT: { label: "Hadir", tone: "success" },
  LATE: { label: "Terlambat", tone: "warning" },
  ABSENT: { label: "Tidak Hadir", tone: "danger" },
  ON_LEAVE: { label: "Cuti", tone: "info" },
  HOLIDAY: { label: "Libur", tone: "neutral" },
  REMOTE: { label: "WFO Remote", tone: "primary" },
  HALF_DAY: { label: "Setengah Hari", tone: "warning" },
};

export const LEAVE_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draf", tone: "neutral" },
  SUBMITTED: { label: "Diajukan", tone: "info" },
  MANAGER_REVIEW: { label: "Review Manajer", tone: "warning" },
  HR_REVIEW: { label: "Review HR", tone: "primary" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
  CANCELLED: { label: "Dibatalkan", tone: "neutral" },
};

export const PAYROLL_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draf", tone: "neutral" },
  PROCESSING: { label: "Diproses", tone: "warning" },
  PENDING_APPROVAL: { label: "Menunggu Persetujuan", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "primary" },
  PAID: { label: "Dibayar", tone: "success" },
  CANCELLED: { label: "Dibatalkan", tone: "neutral" },
};

export const APPLICATION_STAGE: Record<string, { label: string; tone: Tone }> = {
  APPLIED: { label: "Dilamar", tone: "neutral" },
  SCREENING: { label: "Screening", tone: "info" },
  INTERVIEW: { label: "Wawancara", tone: "primary" },
  ASSESSMENT: { label: "Asesmen", tone: "warning" },
  OFFERING: { label: "Penawaran", tone: "warning" },
  HIRED: { label: "Diterima", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

export const RECRUITMENT_STAGES = ["APPLIED", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFERING", "HIRED"] as const;

export const VACANCY_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draf", tone: "neutral" },
  OPEN: { label: "Dibuka", tone: "success" },
  ON_HOLD: { label: "Ditunda", tone: "warning" },
  CLOSED: { label: "Ditutup", tone: "neutral" },
};

export const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  DRAFT: { label: "Draf", tone: "neutral" },
  SELF_ASSESSED: { label: "Penilaian Diri Terkirim", tone: "info" },
  MANAGER_REVIEW: { label: "Review Manajer", tone: "warning" },
  COMPLETED: { label: "Selesai", tone: "success" },
};

export const DOCUMENT_TYPES: Record<string, string> = {
  KTP: "KTP",
  NPWP: "NPWP",
  KARTU_KELUARGA: "Kartu Keluarga",
  IJAZAH: "Ijazah",
  KONTRAK: "Kontrak Kerja",
  SERTIFIKAT: "Sertifikat",
  BPJS: "BPJS",
  LAINNYA: "Lainnya",
};

export const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  company_admin: "Company Admin",
  hr_manager: "HR Manager",
  hr_staff: "HR Staff",
  dept_manager: "Department Manager",
  employee: "Karyawan",
};

export const EMPLOYMENT_TYPE_LABEL: Record<string, string> = {
  PERMANENT: "Tetap",
  FIXED_TERM: "Kontrak (PKWT)",
  PROBATION: "Probasi",
  INTERNSHIP: "Magang",
};

export const CONTRACT_STATUS: Record<string, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Aktif", tone: "success" },
  EXPIRED: { label: "Berakhir", tone: "warning" },
  TERMINATED: { label: "Diakhiri", tone: "danger" },
};

export const CORRECTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  PENDING: { label: "Menunggu", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

export const NOTIFICATION_TYPE: Record<string, { label: string; tone: Tone }> = {
  INFO: { label: "Info", tone: "info" },
  APPROVAL: { label: "Persetujuan", tone: "primary" },
  ALERT: { label: "Peringatan", tone: "warning" },
  SYSTEM: { label: "Sistem", tone: "neutral" },
};
