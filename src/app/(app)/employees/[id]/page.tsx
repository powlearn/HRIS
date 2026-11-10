import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  CalendarDays,
  Clock,
  FileText,
  IdCard,
  Lock,
  Mail,
  MapPin,
  Phone,
  Pencil,
  Plane,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/primitives";
import { EmployeeDetailTabs } from "@/components/employees/employee-detail-tabs";
import { EmployeeEditButton } from "@/components/employees/employee-edit-button";
import { getSessionUser } from "@/lib/api";
import { ApiError } from "@/lib/api";
import { getEmployeeDetail } from "@/modules/employees/service";
import { EMPLOYEE_STATUS, ATTENDANCE_STATUS, LEAVE_STATUS, CONTRACT_STATUS, EMPLOYMENT_TYPE_LABEL, DOCUMENT_TYPES } from "@/lib/design";
import { formatDate, formatDateTime, formatTime } from "@/lib/time";
import { formatIDR } from "@/lib/money";
import { hasPermission } from "@/lib/rbac";

export const metadata: Metadata = { title: "Detail Karyawan" };
export const dynamic = "force-dynamic";

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-border/50 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[12px] font-medium ${mono ? "font-mono" : ""}`}>{value ?? "—"}</span>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const { id } = await params;
  const { tab } = await searchParams;

  let data: Awaited<ReturnType<typeof getEmployeeDetail>>;
  try {
    data = await getEmployeeDetail(user, id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const employee = data.employee;
  const statusMeta = EMPLOYEE_STATUS[employee.status];
  const activeTab = tab ?? "overview";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Button asChild variant="ghost" size="xs">
          <Link href="/employees"><ArrowLeft className="size-3.5" /> Direktori</Link>
        </Button>
        <span>/</span>
        <span className="text-foreground">{employee.name}</span>
      </div>

      <Card className="overflow-hidden">
        <div className="relative h-20 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--primary)_22%,transparent),transparent_60%)]">
          <div className="absolute inset-0 app-grid-bg opacity-40" />
        </div>
        <div className="px-5 pb-5">
          <div className="-mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-end gap-3">
              <PersonAvatar name={employee.name} className="size-16 rounded-xl border-4 border-card text-base" />
              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-tight">{employee.name}</h1>
                  <Badge variant={statusMeta?.tone ?? "neutral"} dot>{statusMeta?.label ?? employee.status}</Badge>
                </div>
                <p className="text-[12px] text-muted-foreground">
                  {employee.position?.title ?? "—"} · {employee.department?.name ?? "—"} · {employee.employeeCode}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <a href={`mailto:${employee.email}`}><Mail className="size-3.5" /> Email</a>
              </Button>
              {data.permissions.canEdit ? (
                <EmployeeEditButton employeeId={employee.id} />
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-x-6 gap-y-1 border-t border-border/60 pt-3 text-[12px] sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-1.5 text-muted-foreground"><Mail className="size-3.5" /> {employee.email}</div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><Phone className="size-3.5" /> {employee.phone ?? "—"}</div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin className="size-3.5" /> {employee.location?.name ?? "—"}</div>
            <div className="flex items-center gap-1.5 text-muted-foreground"><CalendarDays className="size-3.5" /> Bergabung {formatDate(employee.hireDate)}</div>
          </div>
        </div>
      </Card>

      <EmployeeDetailTabs employeeId={employee.id} active={activeTab} />

      {activeTab === "overview" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Informasi pribadi</CardTitle>
              <CardDescription>Data identitas sesuai catatan kepegawaian</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-x-6 sm:grid-cols-2">
              <div>
                <InfoRow label="Nama lengkap" value={employee.name} />
                <InfoRow label="Jenis kelamin" value={employee.gender === "MALE" ? "Laki-laki" : employee.gender === "FEMALE" ? "Perempuan" : "—"} />
                <InfoRow label="Tempat, tanggal lahir" value={`${employee.birthPlace ?? "—"}, ${formatDate(employee.birthDate)}`} />
                <InfoRow label="Status perkawinan" value={employee.maritalStatus?.replace(/_/g, " ") ?? "—"} />
                <InfoRow label="Agama" value={employee.religion ?? "—"} />
                <InfoRow label="Alamat" value={employee.address ?? "—"} />
                <InfoRow label="Kota" value={employee.city ?? "—"} />
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data sensitif</p>
                  {data.employee.sensitive.masked ? (
                    <Badge variant="outline"><Lock className="size-2.5" /> Terbatas</Badge>
                  ) : (
                    <Badge variant="success"><ShieldCheck className="size-2.5" /> Terbuka</Badge>
                  )}
                </div>
                <InfoRow label="NIK" value={employee.sensitive.nik ?? "—"} mono />
                <InfoRow label="NPWP" value={employee.sensitive.npwp ?? "—"} mono />
                <InfoRow label="Bank" value={employee.bankName ?? "—"} />
                <InfoRow label="No. rekening" value={employee.sensitive.bankAccount ?? "—"} mono />
                <InfoRow label="BPJS Kesehatan" value={employee.sensitive.bpjsKes ?? "—"} mono />
                <InfoRow label="BPJS Ketenagakerjaan" value={employee.sensitive.bpjsTk ?? "—"} mono />
                {data.employee.sensitive.masked ? (
                  <p className="mt-2 flex items-start gap-1.5 rounded-md bg-muted/60 p-2 text-[10px] leading-relaxed text-muted-foreground">
                    <Lock className="mt-px size-3 shrink-0" />
                    Nilai disamarkan. Peran Anda tidak memiliki izin <code className="font-mono">employee.sensitive.read</code>.
                  </p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle>Kontak darurat</CardTitle></CardHeader>
              <CardContent>
                <InfoRow label="Nama" value={employee.emergency.name ?? "—"} />
                <InfoRow label="Hubungan" value={employee.emergency.relation ?? "—"} />
                <InfoRow label="Telepon" value={employee.emergency.phone ?? "—"} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Struktur organisasi</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-[12px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Atasan langsung</span>
                  {employee.manager ? (
                    <Link href={`/employees/${employee.manager.id}`} className="font-medium text-primary hover:underline">
                      {employee.manager.name}
                    </Link>
                  ) : (
                    <span className="font-medium">Top level</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Jadwal kerja</span>
                  <span className="font-medium">{employee.schedule ? `${employee.schedule.startTime}–${employee.schedule.endTime}` : "Default"}</span>
                </div>
                <div className="border-t border-border/60 pt-2">
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Users className="size-3" /> Tim langsung ({employee.reports.length})</p>
                  {employee.reports.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Tidak ada bawahan langsung.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {employee.reports.map((report) => (
                        <Link key={report.id} href={`/employees/${report.id}`} className="flex items-center justify-between rounded-md px-1.5 py-1 transition hover:bg-muted">
                          <span className="text-[12px]">{report.name}</span>
                          <span className="text-[10px] text-muted-foreground">{report.position ?? ""}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}

      {activeTab === "employment" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Riwayat kontrak</CardTitle>
              <CardDescription>Kontrak kerja dan statusnya</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.contracts.map((contract) => {
                    const meta = CONTRACT_STATUS[contract.status];
                    return (
                      <TableRow key={contract.id}>
                        <TableCell className="font-mono text-[11px]">{contract.contractNumber}</TableCell>
                        <TableCell className="text-[12px]">{EMPLOYMENT_TYPE_LABEL[contract.type] ?? contract.type}</TableCell>
                        <TableCell className="numeric text-[11px]">
                          {formatDate(contract.startDate)} – {contract.endDate ? formatDate(contract.endDate) : "Selesai"}
                        </TableCell>
                        <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? contract.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Informasi kepegawaian</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="ID karyawan" value={employee.employeeCode} mono />
              <InfoRow label="Status" value={statusMeta?.label ?? employee.status} />
              <InfoRow label="Tanggal bergabung" value={formatDate(employee.hireDate)} />
              <InfoRow label="Akhir kontrak" value={formatDate(employee.endDate)} />
              <InfoRow label="Departemen" value={employee.department?.name ?? "—"} />
              <InfoRow label="Jabatan" value={employee.position?.title ?? "—"} />
              <InfoRow
                label="Gaji pokok"
                value={employee.basicSalary !== null ? formatIDR(employee.basicSalary) : <span className="text-muted-foreground">Terbatas</span>}
              />
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Riwayat kepegawaian</CardTitle>
              <CardDescription>Perubahan jabatan, status, dan kompensasi</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l border-border pl-4">
                {data.histories.map((history) => (
                  <li key={history.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[12px] font-medium">{history.changeType.replace(/_/g, " ")}</p>
                      <span className="numeric text-[11px] text-muted-foreground">{formatDate(history.effectiveDate)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">{history.notes ?? "—"}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "attendance" ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4">
            {[
              { label: "Hadir (30 hari)", value: data.attendance.filter((row) => ["PRESENT", "LATE", "REMOTE"].includes(row.status)).length, icon: Clock },
              { label: "Terlambat", value: data.attendance.filter((row) => row.status === "LATE").length, icon: Clock },
              { label: "Cuti", value: data.attendance.filter((row) => row.status === "ON_LEAVE").length, icon: Plane },
              { label: "Total lembur", value: `${Math.round(data.attendance.reduce((acc, row) => acc + row.overtimeMinutes, 0) / 60)} jam`, icon: CalendarDays },
            ].map((stat) => (
              <Card key={stat.label} className="p-4">
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                <p className="numeric mt-1 text-xl font-semibold">{stat.value}</p>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader><CardTitle>Riwayat kehadiran</CardTitle><CardDescription>30 catatan terakhir</CardDescription></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Clock-in</TableHead>
                    <TableHead>Clock-out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Terlambat</TableHead>
                    <TableHead>Lembur</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attendance.map((record) => {
                    const meta = ATTENDANCE_STATUS[record.status];
                    return (
                      <TableRow key={record.id}>
                        <TableCell className="numeric text-[12px]">{formatDate(record.date)}</TableCell>
                        <TableCell className="numeric text-[12px]">{formatTime(record.clockIn)}</TableCell>
                        <TableCell className="numeric text-[12px]">{formatTime(record.clockOut)}</TableCell>
                        <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? record.status}</Badge></TableCell>
                        <TableCell className="numeric text-[12px]">{record.lateMinutes > 0 ? `${record.lateMinutes} mnt` : "—"}</TableCell>
                        <TableCell className="numeric text-[12px]">{record.overtimeMinutes > 0 ? `${record.overtimeMinutes} mnt` : "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "leave" ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Saldo cuti</CardTitle><CardDescription>Tahun berjalan</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {data.leaveBalances.map((balance) => {
                const remaining = Math.max(0, balance.entitled - balance.used - balance.pending);
                const percent = balance.entitled > 0 ? Math.min(100, (balance.used / balance.entitled) * 100) : 0;
                return (
                  <div key={balance.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: balance.color }} />{balance.name}</span>
                      <span className="numeric font-medium">{remaining} / {balance.entitled} hari</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${percent}%`, background: balance.color }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>Riwayat pengajuan cuti</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nomor</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Periode</TableHead>
                    <TableHead>Hari</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leaveRequests.map((request) => {
                    const meta = LEAVE_STATUS[request.status];
                    return (
                      <TableRow key={request.id}>
                        <TableCell className="font-mono text-[11px]">{request.requestNumber}</TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5 text-[12px]">
                            <span className="size-1.5 rounded-full" style={{ background: request.color }} />{request.type}
                          </span>
                        </TableCell>
                        <TableCell className="numeric text-[11px]">{formatDate(request.startDate)} – {formatDate(request.endDate)}</TableCell>
                        <TableCell className="numeric text-[12px]">{request.days}</TableCell>
                        <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? request.status}</Badge></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {activeTab === "payroll" ? (
        <Card>
          <CardHeader>
            <CardTitle>Riwayat payroll</CardTitle>
            <CardDescription>Slip gaji karyawan pada periode yang telah diproses</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {data.payrollRecords.length === 0 ? (
              <p className="px-5 pb-6 text-[13px] text-muted-foreground">Belum ada data payroll atau Anda tidak memiliki izin melihatnya.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Periode</TableHead>
                    <TableHead>Bruto</TableHead>
                    <TableHead>Potongan</TableHead>
                    <TableHead>Gaji bersih</TableHead>
                    <TableHead>Slip</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payrollRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-[12px]">{record.period}</TableCell>
                      <TableCell className="numeric text-[12px]">{formatIDR(record.grossPay)}</TableCell>
                      <TableCell className="numeric text-[12px] text-destructive">{formatIDR(record.totalDeductions)}</TableCell>
                      <TableCell className="numeric text-[12px] font-medium">{formatIDR(record.netPay)}</TableCell>
                      <TableCell className="text-[11px] font-mono">{record.payslipNumber ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "documents" ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>Dokumen karyawan</CardTitle><CardDescription>Arsip dokumen pribadi dan kepegawaian</CardDescription></div>
            <Button asChild size="sm" variant="outline"><Link href={`/documents?employeeId=${employee.id}`}><FileText className="size-3.5" /> Kelola dokumen</Link></Button>
          </CardHeader>
          <CardContent className="p-0">
            {data.documents.length === 0 ? (
              <p className="px-5 pb-6 text-[13px] text-muted-foreground">Belum ada dokumen diunggah.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Nama</TableHead><TableHead>Jenis</TableHead><TableHead>Ukuran</TableHead><TableHead>Diunggah</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {data.documents.map((document) => (
                    <TableRow key={document.id}>
                      <TableCell>
                        <a href={`/api/v1/documents/${document.id}/download`} className="flex items-center gap-2 text-[12px] font-medium text-primary hover:underline">
                          <FileText className="size-3.5" /> {document.name}
                        </a>
                      </TableCell>
                      <TableCell className="text-[12px]">{DOCUMENT_TYPES[document.type] ?? document.type}</TableCell>
                      <TableCell className="numeric text-[11px]">{(document.sizeBytes / 1024).toFixed(0)} KB</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">{formatDateTime(document.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {activeTab === "activity" ? (
        <Card>
          <CardHeader><CardTitle>Aktivitas terkait karyawan</CardTitle><CardDescription>Jejak audit untuk entitas ini</CardDescription></CardHeader>
          <CardContent>
            {data.auditTrail.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-muted-foreground">Belum ada aktivitas tercatat.</p>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-4">
                {data.auditTrail.map((activity) => (
                  <li key={activity.id} className="relative">
                    <span className="absolute -left-[21px] top-1 size-2.5 rounded-full border-2 border-card bg-primary" />
                    <p className="text-[12px]"><span className="font-medium">{activity.actorName ?? "Sistem"}</span> · {activity.action.replace(/[._]/g, " ")}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDateTime(activity.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
