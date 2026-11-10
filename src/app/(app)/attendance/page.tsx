import type { Metadata } from "next";
import { Clock, CalendarCheck2, Timer, Plane, ClipboardList } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { AttendanceClock } from "@/components/attendance-clock";
import { CorrectionDialog } from "@/components/attendance/correction-dialog";
import { CorrectionReview } from "@/components/attendance/correction-review";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { getMyAttendance } from "@/modules/attendance/service";
import { hasPermission } from "@/lib/rbac";
import { ATTENDANCE_STATUS, CORRECTION_STATUS } from "@/lib/design";
import { dateKey, dateOnly, formatDate, formatDateTime, formatTime, monthRange, MONTH_NAMES_ID } from "@/lib/time";
import { formatNumber } from "@/lib/utils";
import { decimalFromDb } from "@/lib/money";

export const metadata: Metadata = { title: "Kehadiran" };
export const dynamic = "force-dynamic";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requirePage(["attendance.read", "attendance.read.team", "attendance.clock"]);
  const params = await searchParams;
  const now = new Date();
  let year = now.getUTCFullYear();
  let month = now.getUTCMonth() + 1;
  if (params.month && /^\d{4}-\d{1,2}$/.test(params.month)) {
    const [y, m] = params.month.split("-").map(Number);
    if (y && m && m >= 1 && m <= 12) {
      year = y;
      month = m;
    }
  }
  const { start, end } = monthRange(year, month);
  const canReadAll = hasPermission(user.permissions, "attendance.read");
  const canApprove = hasPermission(user.permissions, "attendance.correction.approve");
  const today = dateOnly(dateKey(now, user.timezone));

  const [mine, teamRecords, pendingCorrections, schedules, monthlyByStatus] = await Promise.all([
    user.employeeId ? getMyAttendance(user, new Date(today.getTime() - 27 * 86400000), today) : null,
    canReadAll
      ? prisma.attendanceRecord.findMany({
          where: { tenantId: user.tenantId, date: { gte: start, lte: end } },
          orderBy: [{ date: "desc" }, { employee: { firstName: "asc" } }],
          take: 300,
          include: {
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                department: { select: { name: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    canApprove
      ? prisma.attendanceCorrection.findMany({
          where: { tenantId: user.tenantId, status: "PENDING" },
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            employee: { select: { id: true, firstName: true, lastName: true } },
            attendance: { select: { date: true, clockIn: true, clockOut: true } },
          },
        })
      : Promise.resolve([]),
    hasPermission(user.permissions, "attendance.manage")
      ? prisma.workSchedule.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
    canReadAll
      ? prisma.attendanceRecord.groupBy({
          by: ["status"],
          where: { tenantId: user.tenantId, date: { gte: start, lte: end } },
          _count: { _all: true },
        })
      : Promise.resolve([]),
  ]);

  const totals = monthlyByStatus.reduce(
    (acc, row) => {
      acc[row.status] = row._count._all;
      acc.all += row._count._all;
      return acc;
    },
    { all: 0 } as Record<string, number>,
  );
  const present = (totals.PRESENT ?? 0) + (totals.LATE ?? 0) + (totals.REMOTE ?? 0) + (totals.HALF_DAY ?? 0);
  const attendanceRate = totals.all > 0 ? ((present / totals.all) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenaga Kerja"
        title="Kehadiran"
        description="Absensi dengan verifikasi lokasi, rekap bulanan, serta alur koreksi yang dapat diaudit."
        actions={
          user.employeeId ? (
            <CorrectionDialog trigger={<span className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium"><ClipboardList className="size-3.5" /> Ajukan koreksi</span>} />
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label={`Hadir ${MONTH_NAMES_ID[month - 1]}`} value={present} icon={CalendarCheck2} tone="success" hint={`${attendanceRate}% dari catatan`} />
            <KpiCard label="Terlambat" value={totals.LATE ?? 0} icon={Clock} tone="warning" hint="Melewati toleransi jadwal" />
            <KpiCard label="Tidak hadir" value={totals.ABSENT ?? 0} icon={Timer} tone="danger" hint="Tanpa catatan clock-in" />
            <KpiCard label="Cuti" value={totals.ON_LEAVE ?? 0} icon={Plane} tone="primary" hint="Hari cuti tercatat" />
          </div>

          {mine ? (
            <Card>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>Absensi saya</CardTitle>
                  <CardDescription>28 hari terakhir · {mine.employee.employeeCode}</CardDescription>
                </div>
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span>{mine.summary.presentDays} hadir</span>
                  <span>{mine.summary.lateDays} terlambat</span>
                  <span>{Math.round(mine.summary.overtimeMinutes / 60)} jam lembur</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Clock-in</TableHead>
                      <TableHead>Clock-out</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Lembur</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mine.records.slice(0, 12).map((record) => {
                      const meta = ATTENDANCE_STATUS[record.status];
                      return (
                        <TableRow key={record.id}>
                          <TableCell className="numeric text-[12px]">{formatDate(record.date)}</TableCell>
                          <TableCell className="numeric text-[12px]">{formatTime(record.clockIn)}</TableCell>
                          <TableCell className="numeric text-[12px]">{formatTime(record.clockOut)}</TableCell>
                          <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? record.status}</Badge></TableCell>
                          <TableCell className="text-[11px] text-muted-foreground">
                            {record.locationVerified === true ? `Terverifikasi · ${record.distanceMeters} m` : record.locationVerified === false ? "Di luar area" : "Tidak tersedia"}
                          </TableCell>
                          <TableCell className="numeric text-[12px]">{record.overtimeMinutes > 0 ? `${record.overtimeMinutes} mnt` : "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {canReadAll ? (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Rekap kehadiran karyawan</CardTitle>
                  <CardDescription>{MONTH_NAMES_ID[month - 1]} {year} · {teamRecords.length} catatan terbaru</CardDescription>
                </div>
                <form className="flex items-center gap-2" action="/attendance">
                  <input
                    type="month"
                    name="month"
                    defaultValue={`${year}-${String(month).padStart(2, "0")}`}
                    className="h-8 rounded-md border border-input bg-card px-2 text-[12px]"
                    aria-label="Pilih bulan"
                  />
                  <button type="submit" className="h-8 rounded-md border border-border px-2.5 text-[12px] hover:bg-muted">Terapkan</button>
                </form>
              </CardHeader>
              <CardContent className="p-0">
                {teamRecords.length === 0 ? (
                  <EmptyState icon={Clock} title="Belum ada catatan kehadiran" description="Data akan muncul setelah karyawan melakukan clock-in." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead>Masuk</TableHead>
                        <TableHead>Keluar</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Terlambat</TableHead>
                        <TableHead className="text-right">Durasi kerja</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {teamRecords.map((record) => {
                        const meta = ATTENDANCE_STATUS[record.status];
                        const name = `${record.employee.firstName} ${record.employee.lastName ?? ""}`.trim();
                        return (
                          <TableRow key={record.id}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <PersonAvatar name={name} className="size-7" />
                                <div>
                                  <p className="text-[12px] font-medium">{name}</p>
                                  <p className="text-[10px] text-muted-foreground">{record.employee.department?.name ?? "—"}</p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="numeric text-[12px]">{formatDate(record.date)}</TableCell>
                            <TableCell className="numeric text-[12px]">{formatTime(record.clockIn)}</TableCell>
                            <TableCell className="numeric text-[12px]">{formatTime(record.clockOut)}</TableCell>
                            <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? record.status}</Badge></TableCell>
                            <TableCell className="numeric text-[12px]">{record.lateMinutes > 0 ? `${record.lateMinutes} mnt` : "—"}</TableCell>
                            <TableCell className="numeric text-right text-[12px]">{record.workedMinutes > 0 ? `${formatNumber(record.workedMinutes / 60, 1)} jam` : "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-4">
          {user.employeeId && hasPermission(user.permissions, "attendance.clock") ? <AttendanceClock /> : null}

          {mine ? (
            <Card>
              <CardHeader><CardTitle>Saldo cuti</CardTitle><CardDescription>Tahun {now.getUTCFullYear()}</CardDescription></CardHeader>
              <CardContent className="space-y-2.5">
                {mine.leaveBalances.slice(0, 4).map((balance) => (
                  <div key={balance.name} className="flex items-center justify-between text-[12px]">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: balance.color }} />
                      {balance.name}
                    </span>
                    <span className="numeric font-medium">{balance.remaining} hari</span>
                  </div>
                ))}
                {mine.leaveBalances.length === 0 ? <p className="text-[12px] text-muted-foreground">Belum ada saldo cuti.</p> : null}
              </CardContent>
            </Card>
          ) : null}

          {canApprove ? (
            <Card>
              <CardHeader>
                <CardTitle>Koreksi menunggu</CardTitle>
                <CardDescription>{pendingCorrections.length} permintaan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pendingCorrections.length === 0 ? (
                  <p className="py-3 text-[12px] text-muted-foreground">Tidak ada koreksi yang menunggu.</p>
                ) : (
                  pendingCorrections.map((correction) => (
                    <div key={correction.id} className="space-y-1.5 rounded-lg border border-border/70 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-medium">{correction.employee.firstName} {correction.employee.lastName ?? ""}</p>
                          <p className="numeric text-[10px] text-muted-foreground">{formatDate(correction.attendance.date)}</p>
                        </div>
                        <Badge variant={CORRECTION_STATUS[correction.status]?.tone ?? "neutral"}>
                          {CORRECTION_STATUS[correction.status]?.label ?? correction.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{correction.reason}</p>
                      <p className="numeric text-[10px] text-muted-foreground">
                        Diajukan {formatDateTime(correction.createdAt)}
                      </p>
                      <CorrectionReview correctionId={correction.id} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          {schedules.length > 0 ? (
            <Card>
              <CardHeader><CardTitle>Jadwal kerja</CardTitle><CardDescription>Konfigurasi shift tenant</CardDescription></CardHeader>
              <CardContent className="space-y-2">
                {schedules.map((schedule) => (
                  <div key={schedule.id} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-[12px]">
                    <span className="font-medium">{schedule.name}</span>
                    <span className="numeric text-[11px] text-muted-foreground">{schedule.startTime}–{schedule.endTime}</span>
                  </div>
                ))}
                <p className="pt-1 text-[10px] leading-relaxed text-muted-foreground">
                  Toleransi keterlambatan {schedules[0]?.graceMinutes ?? 15} menit. Lokasi GPS bersifat indikatif, bukan bukti anti-manipulasi.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
