import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  Cake,
  CalendarCheck2,
  CircleDollarSign,
  Clock4,
  FileWarning,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard, MiniStat } from "@/components/kpi-card";
import { AttendanceClock } from "@/components/attendance-clock";
import { DashboardFilters } from "@/components/dashboard-filters";
import { AttendanceTrendChart, DepartmentDonut, TurnoverChart } from "@/components/charts/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/primitives";
import { getSessionUser } from "@/lib/api";
import { getDashboardData } from "@/modules/dashboard/service";
import { formatCompactIDR, formatIDR } from "@/lib/money";
import { formatDate, formatDateTime, MONTH_NAMES_ID } from "@/lib/time";
import { PAYROLL_STATUS } from "@/lib/design";
import { hasPermission } from "@/lib/rbac";
import { relativeLabel } from "@/lib/client-format";

export const metadata: Metadata = { title: "Dasbor" };
export const dynamic = "force-dynamic";

const ACTION_LABELS: Record<string, string> = {
  "auth.login_success": "masuk ke sistem",
  "auth.login_failed": "gagal masuk",
  "auth.password_reset_requested": "meminta reset kata sandi",
  "auth.password_reset_completed": "mengatur ulang kata sandi",
  "employee.viewed_sensitive": "melihat data sensitif karyawan",
  "leave.approved": "menyetujui pengajuan cuti",
  "leave.rejected": "menolak pengajuan cuti",
  "role.permissions_updated": "memperbarui izin peran",
  "attendance.correction_approved": "menyetujui koreksi kehadiran",
  "attendance.clock_in": "melakukan clock-in",
  "attendance.clock_out": "melakukan clock-out",
  "payroll.approved": "menyetujui payroll",
  "payroll.processed": "memproses payroll",
  "payroll.policy_updated": "memperbarui kebijakan payroll",
  "document.uploaded": "mengunggah dokumen",
};

function greeting(timezone: string) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hour12: false }).format(new Date()));
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 19) return "Selamat sore";
  return "Selamat malam";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; departmentId?: string; locationId?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.permissions, "dashboard.view")) redirect("/profile");

  const params = await searchParams;
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  if (params.month && /^\d{4}-\d{1,2}$/.test(params.month)) {
    const [parsedYear, parsedMonth] = params.month.split("-").map(Number);
    if (parsedYear && parsedMonth && parsedMonth >= 1 && parsedMonth <= 12) {
      year = parsedYear;
      month = parsedMonth;
    }
  }

  const data = await getDashboardData(user, {
    month,
    year,
    departmentId: params.departmentId,
    locationId: params.locationId,
  });

  const firstName = user.name.split(" ")[0];
  const payrollMeta = data.payroll ? PAYROLL_STATUS[data.payroll.status] : null;
  const canSeePayroll = hasPermission(user.permissions, ["payroll.read", "payroll.read.self"]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${MONTH_NAMES_ID[month - 1]} ${year}`}
        title={`${greeting(user.timezone)}, ${firstName}`}
        description="Ringkasan tenaga kerja, kehadiran, dan operasional HR hari ini."
        actions={
          <DashboardFilters
            month={month}
            year={year}
            departmentId={params.departmentId}
            locationId={params.locationId}
            departments={data.filters.departments}
            locations={data.filters.locations}
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Karyawan aktif"
          value={data.metrics.headcount}
          icon={Users}
          tone="primary"
          delta={{ value: data.metrics.newHiresThisMonth > 0 ? Math.round((data.metrics.newHiresThisMonth / Math.max(1, data.metrics.headcount)) * 100) : 0 }}
          hint={`${data.metrics.newHiresThisMonth} bergabung bulan ini`}
          footer={<MiniStat label="Kontrak berakhir ≤45 hari" value={String(data.metrics.contractExpiring)} />}
        />
        <KpiCard
          label="Hadir hari ini"
          value={data.metrics.presentToday}
          icon={UserCheck}
          tone="success"
          hint={`${data.metrics.attendanceRate}% dari kehadiran tercatat`}
          footer={
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Tidak hadir</span>
              <span className="font-medium text-destructive">{data.metrics.absentToday}</span>
            </div>
          }
        />
        <KpiCard
          label="Terlambat"
          value={data.metrics.lateToday}
          icon={Clock4}
          tone="warning"
          hint="Melewati batas toleransi jadwal"
          footer={<MiniStat label="Cuti hari ini" value={String(data.metrics.onLeaveToday)} />}
        />
        <KpiCard
          label="Menunggu persetujuan"
          value={data.metrics.pendingApprovals}
          icon={CalendarCheck2}
          tone={data.metrics.pendingApprovals > 0 ? "warning" : "default"}
          hint={`${data.metrics.pendingLeave} cuti · ${data.metrics.pendingCorrections} koreksi`}
          footer={
            <Link href="/leave" className="flex items-center justify-between text-[11px] text-primary hover:underline">
              Tinjau pengajuan <ArrowRight className="size-3" />
            </Link>
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>Tren kehadiran</CardTitle>
              <CardDescription>Catatan harian {data.filters.monthLabel} · hanya hari kerja</CardDescription>
            </div>
            <Badge variant="outline">{data.attendanceSeries.length} hari kerja</Badge>
          </CardHeader>
          <CardContent className="pl-2">
            {data.attendanceSeries.length > 0 ? (
              <AttendanceTrendChart data={data.attendanceSeries} />
            ) : (
              <p className="py-16 text-center text-[13px] text-muted-foreground">Belum ada catatan kehadiran pada periode ini.</p>
            )}
          </CardContent>
        </Card>

        {hasPermission(user.permissions, "attendance.clock") ? <AttendanceClock /> : null}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Distribusi departemen</CardTitle>
            <CardDescription>Komposisi karyawan aktif</CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentDonut data={data.distribution} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Turnover 6 bulan</CardTitle>
            <CardDescription>Rasio karyawan keluar terhadap headcount</CardDescription>
          </CardHeader>
          <CardContent>
            <TurnoverChart data={data.turnoverSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Ringkasan payroll</CardTitle>
              <CardDescription>{data.payroll?.name ?? "Belum ada periode payroll"}</CardDescription>
            </div>
            {payrollMeta ? <Badge variant={payrollMeta.tone}>{payrollMeta.label}</Badge> : null}
          </CardHeader>
          <CardContent className="space-y-3">
            {data.payroll && canSeePayroll ? (
              <>
                <div>
                  <p className="text-[11px] text-muted-foreground">Total gaji bersih</p>
                  <p className="numeric text-[22px] font-semibold tracking-tight">{formatIDR(data.payroll.netTotal)}</p>
                </div>
                <div className="space-y-1.5 rounded-lg border border-border/70 bg-muted/30 p-2.5">
                  <MiniStat label="Bruto" value={formatCompactIDR(data.payroll.grossTotal)} />
                  <MiniStat label="Karyawan" value={String(data.payroll.employeeCount)} />
                  <MiniStat label="Tanggal bayar" value={formatDate(data.payroll.payDate)} />
                </div>
                <Button asChild variant="outline" size="sm" className="w-full">
                  <Link href="/payroll">
                    Buka payroll <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <CircleDollarSign className="size-6 text-muted-foreground" />
                <p className="text-[12px] text-muted-foreground">Anda tidak memiliki akses ke ringkasan payroll tenant.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Aktivitas terbaru</CardTitle>
              <CardDescription>Jejak audit sistem untuk tenant Anda</CardDescription>
            </div>
            {hasPermission(user.permissions, "audit.view") ? (
              <Button asChild variant="ghost" size="xs">
                <Link href="/settings/audit">Lihat semua</Link>
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="space-y-1">
            {data.recentActivity.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-muted-foreground">Belum ada aktivitas tercatat.</p>
            ) : (
              data.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 rounded-lg px-1 py-2 transition hover:bg-muted/40">
                  <PersonAvatar name={activity.actorName ?? "Sistem"} className="mt-0.5 size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug">
                      <span className="font-medium">{activity.actorName ?? "Sistem"}</span>{" "}
                      <span className="text-muted-foreground">{ACTION_LABELS[activity.action] ?? activity.action.replace(/[._]/g, " ")}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {relativeLabel(activity.createdAt)} · modul {activity.module}
                    </p>
                  </div>
                  <Badge variant="outline" className="hidden sm:inline-flex">
                    {activity.entityType ?? "Sistem"}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-primary/20 bg-[color-mix(in_oklch,var(--primary)_4%,var(--card))]">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-primary/12 text-primary">
                  <Sparkles className="size-3.5" />
                </span>
                <CardTitle>AI HR Copilot</CardTitle>
              </div>
              <CardDescription>
                Copilot belum diaktifkan. Administrator dapat menambahkan API key melalui variabel lingkungan untuk
                mengaktifkan ringkasan tren dan tanya jawab kebijakan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button asChild size="sm" variant="outline" className="w-full justify-between">
                <Link href="/ai">
                  Buka copilot <ArrowRight className="size-3.5" />
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cake className="size-4 text-muted-foreground" /> Ulang tahun bulan ini
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.birthdays.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Tidak ada ulang tahun pada bulan ini.</p>
              ) : (
                data.birthdays.map((person) => (
                  <div key={person.name} className="flex items-center gap-2.5">
                    <PersonAvatar name={person.name} className="size-7" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">{person.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{person.department}</p>
                    </div>
                    <span className="numeric text-[11px] text-muted-foreground">{person.day} {MONTH_NAMES_ID[month - 1]?.slice(0, 3)}</span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Perlu perhatian</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[12px]">
              <div className="flex items-start gap-2 rounded-lg border border-warning/25 bg-[color-mix(in_oklch,var(--warning)_8%,transparent)] p-2.5">
                <FileWarning className="mt-0.5 size-3.5 text-warning" />
                <div>
                  <p className="font-medium">{data.metrics.contractExpiring} kontrak berakhir ≤45 hari</p>
                  <Link href="/employees?status=CONTRACT" className="text-[11px] text-primary hover:underline">
                    Tinjau karyawan kontrak
                  </Link>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                <UserPlus className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{data.metrics.newHiresThisMonth} karyawan baru</p>
                  <p className="text-[11px] text-muted-foreground">Pastikan onboarding selesai.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                <BadgeCheck className="mt-0.5 size-3.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Terakhir diperbarui</p>
                  <p className="text-[11px] text-muted-foreground">{formatDateTime(new Date())} WIB</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
