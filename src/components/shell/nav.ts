import {
  BarChart3,
  Briefcase,
  CalendarDays,
  Clock,
  FileText,
  LayoutDashboard,
  Settings,
  Sparkles,
  Target,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PermissionKey } from "@/lib/rbac";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey;
  badgeKey?: "pendingApprovals" | "unreadNotifications";
  description: string;
};

export type NavGroup = { label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ringkasan",
    items: [
      {
        label: "Dasbor",
        href: "/dashboard",
        icon: LayoutDashboard,
        permission: "dashboard.view",
        description: "Metrik tenaga kerja & aktivitas terbaru",
      },
    ],
  },
  {
    label: "Tenaga Kerja",
    items: [
      {
        label: "Karyawan",
        href: "/employees",
        icon: Users,
        permission: "employee.read",
        description: "Direktori, profil & riwayat karyawan",
      },
      {
        label: "Kehadiran",
        href: "/attendance",
        icon: Clock,
        permission: "attendance.read",
        description: "Clock-in, jadwal & koreksi kehadiran",
      },
      {
        label: "Cuti & Izin",
        href: "/leave",
        icon: CalendarDays,
        permission: "leave.read",
        badgeKey: "pendingApprovals",
        description: "Pengajuan, saldo & kalender cuti",
      },
      {
        label: "Kinerja",
        href: "/performance",
        icon: Target,
        permission: "performance.read",
        description: "Siklus penilaian, KPI & tujuan",
      },
    ],
  },
  {
    label: "Keuangan",
    items: [
      {
        label: "Payroll",
        href: "/payroll",
        icon: Wallet,
        permission: "payroll.read",
        description: "Periode gaji, komponen & slip",
      },
    ],
  },
  {
    label: "Pertumbuhan",
    items: [
      {
        label: "Rekrutmen",
        href: "/recruitment",
        icon: Briefcase,
        permission: "recruitment.read",
        description: "Lowongan, pipeline & onboarding",
      },
      {
        label: "Dokumen",
        href: "/documents",
        icon: FileText,
        permission: "document.read",
        description: "Arsip dokumen karyawan",
      },
      {
        label: "Laporan",
        href: "/reports",
        icon: BarChart3,
        permission: "report.view",
        description: "Analitik SDM & ekspor data",
      },
      {
        label: "AI Copilot",
        href: "/ai",
        icon: Sparkles,
        permission: "ai.use",
        description: "Asisten HR berbasis kebijakan tenant",
      },
    ],
  },
  {
    label: "Sistem",
    items: [
      {
        label: "Pengaturan",
        href: "/settings",
        icon: Settings,
        permission: "settings.read",
        description: "Organisasi, peran, kebijakan & audit",
      },
    ],
  },
];

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export function findNavItem(pathname: string): NavItem | undefined {
  return [...ALL_NAV_ITEMS]
    .sort((a, b) => b.href.length - a.href.length)
    .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}
