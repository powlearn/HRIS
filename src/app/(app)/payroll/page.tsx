import type { Metadata } from "next";
import Link from "next/link";
import { Banknote, Calculator, FileText, Receipt, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { PayrollActions } from "@/components/payroll/payroll-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { requirePage } from "@/lib/page-guard";
import { getPayrollOverview } from "@/modules/payroll/service";
import { PAYROLL_STATUS } from "@/lib/design";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatIDR } from "@/lib/money";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Payroll" };
export const dynamic = "force-dynamic";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const user = await requirePage(["payroll.read", "payroll.read.self", "payroll.manage"]);
  const params = await searchParams;
  const data = await getPayrollOverview(user, params.period);
  const selected = data.selected;
  const statusMeta = selected ? PAYROLL_STATUS[selected.status] : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Keuangan"
        title="Payroll"
        description="Perhitungan gaji deterministik berbasis kebijakan berversi. Persetujuan dilakukan manusia; AI tidak memiliki akses ke proses payroll."
        actions={
          selected && (data.permissions.canManage || data.permissions.canApprove) ? (
            <PayrollActions
              periodId={selected.id}
              status={selected.status}
              periodName={selected.name}
              canManage={data.permissions.canManage}
              canApprove={data.permissions.canApprove}
            />
          ) : null
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {data.periods.map((period) => (
          <Link
            key={period.id}
            href={`/payroll?period=${period.id}`}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] transition",
              selected?.id === period.id ? "border-primary/30 bg-primary/8 text-foreground" : "border-border bg-card text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="font-medium">{period.name}</span>
            <Badge variant={PAYROLL_STATUS[period.status]?.tone ?? "neutral"} className="scale-90">
              {PAYROLL_STATUS[period.status]?.label ?? period.status}
            </Badge>
          </Link>
        ))}
      </div>

      {!selected ? (
        <EmptyState icon={Wallet} title="Belum ada periode payroll" description="Buat periode payroll melalui pengaturan atau seed data." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard label="Gaji bruto" value={formatIDR(selected.grossTotal)} icon={Banknote} tone="primary" hint={selected.name} />
            <KpiCard label="Total potongan" value={formatIDR(selected.deductionTotal)} icon={Receipt} tone="warning" hint="BPJS, PPh 21, lainnya" />
            <KpiCard label="Gaji bersih" value={formatIDR(selected.netTotal)} icon={Wallet} tone="success" hint="Ditransfer ke karyawan" />
            <KpiCard
              label="Status periode"
              value={statusMeta?.label ?? selected.status}
              icon={Calculator}
              hint={selected.processedAt ? `Diproses ${formatDateTime(selected.processedAt)}` : "Belum diproses"}
              footer={<div className="flex items-center justify-between text-[11px]"><span className="text-muted-foreground">{selected.employeeCount} karyawan</span><span className="numeric">{formatDate(selected.payDate)}</span></div>}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Rekap payroll karyawan</CardTitle>
                <CardDescription>Nilai bersih per karyawan pada periode terpilih</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {!data.permissions.canReadAll ? (
                  <p className="px-5 pb-5 text-[13px] text-muted-foreground">Anda hanya memiliki akses ke slip gaji sendiri.</p>
                ) : data.records.length === 0 ? (
                  <EmptyState icon={Calculator} title="Payroll belum diproses" description="Jalankan proses payroll untuk menghitung gaji periode ini." />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Karyawan</TableHead>
                        <TableHead>Bruto</TableHead>
                        <TableHead>Potongan</TableHead>
                        <TableHead>Bersih</TableHead>
                        <TableHead>Slip</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.records.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell>
                            <p className="text-[12px] font-medium">{record.employeeName}</p>
                            <p className="text-[10px] text-muted-foreground">{record.employeeCode} · {record.department ?? "—"}</p>
                          </TableCell>
                          <TableCell className="numeric text-[12px]">{formatIDR(record.grossPay)}</TableCell>
                          <TableCell className="numeric text-[12px] text-destructive">−{formatIDR(record.totalDeductions)}</TableCell>
                          <TableCell className="numeric text-[12px] font-medium">{formatIDR(record.netPay)}</TableCell>
                          <TableCell>
                            {record.payslipId ? (
                              <Link href={`/payroll/slip/${record.payslipId}`} className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline">
                                <FileText className="size-3" /> {record.payslipNumber}
                              </Link>
                            ) : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Kebijakan aktif</CardTitle><CardDescription>Tarif tidak di-hardcode di kode</CardDescription></CardHeader>
                <CardContent className="space-y-2 text-[12px]">
                  {data.policy ? (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Versi</span>
                        <Badge variant="outline">v{data.policy.version}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Berlaku sejak</span>
                        <span className="font-medium">{formatDate(data.policy.effectiveFrom)}</span>
                      </div>
                      <p className="rounded-md bg-muted/50 p-2 text-[10px] leading-relaxed text-muted-foreground">
                        {data.policy.notes ?? "Konfigurasi mengikuti kebijakan perusahaan."}
                      </p>
                      <Link href="/settings/payroll" className="inline-flex text-[11px] text-primary hover:underline">
                        Kelola kebijakan & komponen
                      </Link>
                    </>
                  ) : (
                    <p className="text-muted-foreground">Belum ada kebijakan payroll.</p>
                  )}
                </CardContent>
              </Card>

              {data.components.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle>Komponen gaji</CardTitle></CardHeader>
                  <CardContent className="space-y-1.5">
                    {data.components.slice(0, 6).map((component) => (
                      <div key={component.id} className="flex items-center justify-between text-[12px]">
                        <span className="flex items-center gap-1.5">
                          <span className={cn("size-1.5 rounded-full", component.type === "EARNING" ? "bg-success" : "bg-destructive")} />
                          {component.name}
                        </span>
                        <span className="numeric text-muted-foreground">
                          {component.calculation === "FIXED" ? formatIDR(component.amount) : `${component.calculation.replace(/_/g, " ").toLowerCase()}`}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}

              {data.myRecords.length > 0 ? (
                <Card>
                  <CardHeader><CardTitle>Slip gaji saya</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    {data.myRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between gap-2 text-[12px]">
                        <div>
                          <p className="font-medium">{record.period}</p>
                          <p className="text-[10px] text-muted-foreground">Dibayar {formatDate(record.payDate)}</p>
                        </div>
                        <div className="text-right">
                          <p className="numeric font-medium">{formatIDR(record.netPay)}</p>
                          {record.payslipId ? (
                            <Link href={`/payroll/slip/${record.payslipId}`} className="text-[10px] text-primary hover:underline">Lihat slip</Link>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
