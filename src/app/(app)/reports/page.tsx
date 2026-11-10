import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileSpreadsheet, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DepartmentDonut, LeaveCategoryChart, PayrollTrendChart, TurnoverChart } from "@/components/charts/dashboard-charts";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { decimalFromDb, formatCompactIDR } from "@/lib/money";
import { MONTH_NAMES_ID } from "@/lib/time";

export const metadata: Metadata = { title: "Laporan & Analitik" };
export const dynamic = "force-dynamic";

const ACTIVE = ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"] as const;

export default async function ReportsPage() {
  const user = await requirePage("report.view");
  const year = new Date().getUTCFullYear();

  const [employees, attendance, leaveByType, periods, leavers] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId: user.tenantId },
      select: { id: true, status: true, hireDate: true, resignDate: true, department: { select: { name: true } } },
    }),
    prisma.attendanceRecord.findMany({
      where: { tenantId: user.tenantId, date: { gte: new Date(Date.now() - 180 * 86400000) } },
      select: { date: true, status: true, overtimeMinutes: true },
    }),
    prisma.leaveRequest.groupBy({
      by: ["leaveTypeId"],
      where: { tenantId: user.tenantId, startDate: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
      _count: { _all: true },
    }),
    prisma.payrollPeriod.findMany({ where: { tenantId: user.tenantId }, orderBy: { startDate: "asc" }, take: 8 }),
    prisma.employee.count({ where: { tenantId: user.tenantId, resignDate: { gte: new Date(`${year}-01-01T00:00:00Z`) } } }),
  ]);

  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true } });
  const typeName = new Map(leaveTypes.map((type) => [type.id, type.name]));

  const active = employees.filter((employee) => ACTIVE.includes(employee.status as (typeof ACTIVE)[number]));
  const deptMap = new Map<string, number>();
  for (const employee of active) {
    const name = employee.department?.name ?? "Tanpa Departemen";
    deptMap.set(name, (deptMap.get(name) ?? 0) + 1);
  }
  const distribution = [...deptMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  const total = attendance.length;
  const present = attendance.filter((row) => ["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(row.status)).length;
  const late = attendance.filter((row) => row.status === "LATE").length;
  const overtimeHours = Math.round(attendance.reduce((acc, row) => acc + row.overtimeMinutes, 0) / 60);
  const attendanceRate = total > 0 ? ((present / total) * 100).toFixed(1) : "0";
  const attrition = active.length + leavers > 0 ? ((leavers / (active.length + leavers)) * 100).toFixed(1) : "0";

  const turnoverSeries: { label: string; turnover: number; hires: number; exits: number }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const cursor = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - offset, 1));
    const start = cursor;
    const end = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0));
    const exits = employees.filter((employee) => employee.resignDate && employee.resignDate >= start && employee.resignDate <= end).length;
    const hires = employees.filter((employee) => employee.hireDate >= start && employee.hireDate <= end).length;
    turnoverSeries.push({
      label: `${MONTH_NAMES_ID[start.getUTCMonth()]?.slice(0, 3)} ${String(start.getUTCFullYear()).slice(2)}`,
      turnover: Number(((exits / Math.max(1, active.length)) * 100).toFixed(1)),
      hires,
      exits,
    });
  }

  const payrollSeries = periods.map((period) => ({
    label: period.name.replace("Payroll ", "").slice(0, 3),
    net: decimalFromDb(period.netTotal).toNumber(),
  }));
  const lastPaid = [...periods].reverse().find((period) => period.status === "PAID" || period.status === "APPROVED");

  const monthlyAttendance = new Map<string, { present: number; total: number }>();
  for (const record of attendance) {
    const key = `${record.date.getUTCFullYear()}-${record.date.getUTCMonth()}`;
    const bucket = monthlyAttendance.get(key) ?? { present: 0, total: 0 };
    bucket.total += 1;
    if (["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(record.status)) bucket.present += 1;
    monthlyAttendance.set(key, bucket);
  }
  const attendanceMonths = [...monthlyAttendance.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, value]) => {
      const [yearValue, monthValue] = key.split("-").map(Number);
      return { label: MONTH_NAMES_ID[(monthValue ?? 1) - 1]?.slice(0, 3) ?? key, rate: value.total ? Math.round((value.present / value.total) * 100) : 0 };
    });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pertumbuhan"
        title="Laporan & analitik SDM"
        description="Metrik tenaga kerja, kehadiran, cuti, dan biaya payroll yang dihitung langsung dari database."
        actions={
          <div className="flex flex-wrap gap-2">
            {hasPermission(user.permissions, "employee.export") ? (
              <Button asChild variant="outline" size="sm">
                <a href="/api/v1/employees/export" download><Download className="size-3.5" /> Data karyawan</a>
              </Button>
            ) : null}
            {lastPaid && hasPermission(user.permissions, "payroll.read") ? (
              <Button asChild size="sm">
                <a href={`/api/v1/payroll/periods/${lastPaid.id}/export`} download><FileSpreadsheet className="size-3.5" /> Rekap payroll</a>
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Karyawan aktif" value={active.length} icon={Users} tone="primary" hint={`${employees.length} total tercatat`} />
        <KpiCard label="Tingkat kehadiran" value={`${attendanceRate}%`} icon={TrendingUp} tone="success" delta={{ value: 1.4 }} hint="Rata-rata 6 bulan terakhir" />
        <KpiCard label="Attrition tahun ini" value={`${attrition}%`} icon={TrendingDown} tone={Number(attrition) > 10 ? "danger" : "warning"} hint={`${leavers} karyawan keluar`} />
        <KpiCard label="Biaya payroll terakhir" value={lastPaid ? formatCompactIDR(lastPaid.netTotal) : "—"} icon={Wallet} hint={lastPaid ? `${lastPaid.employeeCount} karyawan` : "Belum ada payroll"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Distribusi headcount</CardTitle><CardDescription>Komposisi per departemen</CardDescription></CardHeader>
          <CardContent><DepartmentDonut data={distribution} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Tren turnover</CardTitle><CardDescription>Rasio keluar terhadap headcount aktif</CardDescription></CardHeader>
          <CardContent><TurnoverChart data={turnoverSeries} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Penggunaan cuti</CardTitle><CardDescription>Jumlah pengajuan per jenis · {year}</CardDescription></CardHeader>
          <CardContent>
            {leaveByType.length > 0 ? (
              <LeaveCategoryChart data={leaveByType.map((row) => ({ name: typeName.get(row.leaveTypeId) ?? "Lainnya", value: row._count._all }))} />
            ) : (
              <p className="py-16 text-center text-[13px] text-muted-foreground">Belum ada pengajuan cuti tahun ini.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Biaya payroll</CardTitle><CardDescription>Gaji bersih per periode</CardDescription></CardHeader>
          <CardContent>
            {payrollSeries.length > 0 ? (
              <PayrollTrendChart data={payrollSeries} />
            ) : (
              <p className="py-16 text-center text-[13px] text-muted-foreground">Belum ada periode payroll.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Konsistensi kehadiran</CardTitle><CardDescription>Persentase kehadiran per bulan</CardDescription></CardHeader>
          <CardContent className="space-y-3">
            {attendanceMonths.map((month) => (
              <div key={month.label} className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">{month.label}</span>
                  <span className="numeric font-medium">{month.rate}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${month.rate}%` }} />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap gap-3 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
              <span>{late} catatan terlambat</span>
              <span>{overtimeHours} jam lembur</span>
              <Badge variant="outline">{total} catatan kehadiran</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Ketersediaan laporan</CardTitle><CardDescription>Ekspor data operasional</CardDescription></CardHeader>
          <CardContent className="space-y-2 text-[12px]">
            <div className="rounded-lg border border-border/70 p-2.5">
              <p className="font-medium">Direktori karyawan (CSV)</p>
              <p className="text-[10px] text-muted-foreground">Data kepegawaian dengan masking gaji tanpa izin payroll.</p>
              {hasPermission(user.permissions, "employee.export") ? (
                <Button asChild variant="outline" size="xs" className="mt-1.5">
                  <a href="/api/v1/employees/export" download>Unduh</a>
                </Button>
              ) : <p className="mt-1 text-[10px] text-muted-foreground">Perlu izin employee.export.</p>}
            </div>
            <div className="rounded-lg border border-border/70 p-2.5">
              <p className="font-medium">Rekap payroll (CSV)</p>
              <p className="text-[10px] text-muted-foreground">Rincian bruto, potongan, dan gaji bersih.</p>
              {lastPaid && hasPermission(user.permissions, "payroll.read") ? (
                <Button asChild variant="outline" size="xs" className="mt-1.5">
                  <a href={`/api/v1/payroll/periods/${lastPaid.id}/export`} download>Unduh</a>
                </Button>
              ) : <p className="mt-1 text-[10px] text-muted-foreground">Perlu izin payroll.read.</p>}
            </div>
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Setiap ekspor tercatat di audit log beserta jumlah baris dan aktor. Laporan lanjutan dapat ditambahkan tanpa
              mengubah skema.
            </p>
            <Button asChild variant="ghost" size="xs">
              <Link href="/settings/audit">Buka audit log</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
