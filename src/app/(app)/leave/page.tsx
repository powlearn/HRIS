import type { Metadata } from "next";
import { CalendarDays, CheckCircle2, Clock3, Hourglass, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { LeaveRequestDialog } from "@/components/leave/leave-request-dialog";
import { LeaveApprovalActions } from "@/components/leave/leave-approval-actions";
import { LeaveCalendar } from "@/components/leave/leave-calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { requirePage } from "@/lib/page-guard";
import { getLeaveOverview } from "@/modules/leave/service";
import { LEAVE_STATUS } from "@/lib/design";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Cuti & Izin" };
export const dynamic = "force-dynamic";

export default async function LeavePage() {
  const user = await requirePage(["leave.read", "leave.request", "leave.approve", "leave.manage"]);
  const data = await getLeaveOverview(user);
  const annual = data.balances.find((balance) => balance.code === "ANNUAL");
  const annualRemaining = annual?.remaining ?? 0;
  const pendingMine = data.myRequests.filter((request) => ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW"].includes(request.status)).length;
  const approvedMine = data.myRequests.filter((request) => request.status === "APPROVED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenaga Kerja"
        title="Cuti & izin"
        description="Kelola saldo cuti, pengajuan, dan persetujuan berjenjang dengan jejak audit lengkap."
        actions={
          user.employeeId ? (
            <LeaveRequestDialog types={data.types} balances={data.balances} />
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Sisa cuti tahunan" value={`${annualRemaining} hari`} icon={CalendarDays} tone="primary" hint={annual ? `Dari ${annual.entitled} hari · tahun 2026` : "Belum ada saldo cuti tahunan"} />
        <KpiCard label="Menunggu persetujuan" value={pendingMine} icon={Hourglass} tone={pendingMine > 0 ? "warning" : "default"} hint="Pengajuan Anda" />
        <KpiCard label="Disetujui" value={approvedMine} icon={CheckCircle2} tone="success" hint="Sepanjang tahun ini" />
        <KpiCard label="Antrean approval" value={data.approvals.length} icon={Users} tone={data.approvals.length > 0 ? "warning" : "default"} hint="Menunggu tindakan Anda" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {data.approvals.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Menunggu persetujuan Anda</CardTitle>
                <CardDescription>Urut berdasarkan waktu pengajuan (SLA: 2 hari kerja)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {data.approvals.map((request) => {
                  const statusMeta = LEAVE_STATUS[request.status];
                  return (
                    <div key={request.id} className="rounded-lg border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="flex items-start gap-2.5">
                          <PersonAvatar name={request.employeeName} className="size-8" />
                          <div>
                            <p className="text-[13px] font-medium">{request.employeeName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {request.employeeCode} · {request.department ?? "—"} · {request.type}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={statusMeta?.tone ?? "neutral"}>{statusMeta?.label ?? request.status}</Badge>
                          <p className="numeric mt-1 text-[10px] text-muted-foreground">Tahap {request.currentStep} dari {request.approvals.length}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="flex items-center gap-1"><CalendarDays className="size-3" /> {formatDate(request.startDate)} – {formatDate(request.endDate)}</span>
                        <span className="flex items-center gap-1"><Clock3 className="size-3" /> {request.days} hari</span>
                        <span>Diajukan {formatDateTime(request.submittedAt)}</span>
                      </div>
                      <p className="mt-1.5 rounded-md bg-muted/50 px-2 py-1.5 text-[11px] leading-relaxed">{request.reason}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {request.approvals.map((step) => (
                            <span
                              key={step.stepOrder}
                              className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-medium ${
                                step.status === "APPROVED"
                                  ? "bg-success/10 text-success"
                                  : step.status === "REJECTED"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {step.stepOrder}. {step.role.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                        <LeaveApprovalActions requestId={request.id} employeeName={request.employeeName} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Pengajuan saya</CardTitle>
                <CardDescription>Riwayat pengajuan cuti dan izin</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {data.myRequests.length === 0 ? (
                <EmptyState icon={CalendarDays} title="Belum ada pengajuan" description="Pengajuan cuti yang Anda buat akan tampil di sini." />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nomor</TableHead>
                      <TableHead>Jenis</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Hari</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tahap</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.myRequests.map((request) => {
                      const meta = LEAVE_STATUS[request.status];
                      return (
                        <TableRow key={request.id}>
                          <TableCell className="font-mono text-[11px]">{request.requestNumber}</TableCell>
                          <TableCell>
                            <span className="flex items-center gap-1.5 text-[12px]">
                              <span className="size-1.5 rounded-full" style={{ background: request.color }} />
                              {request.type}
                            </span>
                          </TableCell>
                          <TableCell className="numeric text-[11px]">{formatDate(request.startDate)} – {formatDate(request.endDate)}</TableCell>
                          <TableCell className="numeric text-[12px]">{request.days}</TableCell>
                          <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? request.status}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {request.approvals.map((step) => (
                                <span
                                  key={step.stepOrder}
                                  title={`${step.role}: ${step.status}`}
                                  className={`size-1.5 rounded-full ${
                                    step.status === "APPROVED" ? "bg-success" : step.status === "REJECTED" ? "bg-destructive" : "bg-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Saldo cuti</CardTitle><CardDescription>Tahun {new Date().getUTCFullYear()}</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {data.balances.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Akun Anda belum memiliki profil karyawan.</p>
              ) : (
                data.balances.map((balance) => {
                  const usedPercent = balance.entitled > 0 ? Math.min(100, ((balance.used + balance.pending) / balance.entitled) * 100) : 0;
                  return (
                    <div key={balance.id} className="space-y-1">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-1.5">
                          <span className="size-2 rounded-full" style={{ background: balance.color }} />
                          {balance.name}
                        </span>
                        <span className="numeric font-medium">{balance.remaining}/{balance.entitled}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full" style={{ width: `${usedPercent}%`, background: balance.color }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">{balance.used} terpakai · {balance.pending} menunggu</p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Kalender cuti</CardTitle><CardDescription>Tim Anda · cuti disetujui</CardDescription></CardHeader>
            <CardContent>
              <LeaveCalendar
                leaves={data.calendar.map((item) => ({ ...item, start: item.start.toISOString(), end: item.end.toISOString() }))}
                holidays={data.holidays.map((holiday) => ({ ...holiday, date: holiday.date.toISOString() }))}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
