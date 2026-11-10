import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { requirePage } from "@/lib/page-guard";
import { getPayslip } from "@/modules/payroll/service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatIDR } from "@/lib/money";
import { PrintButton } from "@/components/payroll/print-button";

export const metadata: Metadata = { title: "Slip Gaji" };
export const dynamic = "force-dynamic";

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage(["payroll.read", "payroll.read.self", "payroll.approve"]);
  const { id } = await params;
  const slip = await getPayslip(user, id);

  const earnings = slip.lines.filter((line) => line.type === "EARNING");
  const deductions = slip.lines.filter((line) => line.type === "DEDUCTION");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Button asChild variant="ghost" size="sm">
          <Link href="/payroll"><ArrowLeft className="size-3.5" /> Kembali ke payroll</Link>
        </Button>
        <PrintButton />
      </div>

      <Card className="overflow-hidden print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/30 px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
                <path d="M6 18V6.8L18 17.2V6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <p className="text-[14px] font-semibold">NexaHR</p>
              <p className="text-[10px] text-muted-foreground">Slip gaji resmi</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[12px] font-semibold">{slip.company.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{slip.number}</p>
            <p className="text-[10px] text-muted-foreground">Diterbitkan {formatDateTime(slip.issuedAt)}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-border px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Karyawan</p>
            <p className="mt-1 text-[13px] font-medium">{slip.employee.name}</p>
            <p className="text-[11px] text-muted-foreground">{slip.employee.employeeCode} · {slip.employee.position}</p>
            <p className="text-[11px] text-muted-foreground">{slip.employee.department}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Periode penggajian</p>
            <p className="mt-1 text-[13px] font-medium">{slip.period.name}</p>
            <p className="numeric text-[11px] text-muted-foreground">{formatDate(slip.period.startDate)} – {formatDate(slip.period.endDate)}</p>
            <p className="text-[11px] text-muted-foreground">Tanggal bayar {formatDate(slip.period.payDate)}</p>
          </div>
        </div>

        <div className="grid gap-5 px-6 py-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pendapatan</p>
            <div className="space-y-1.5">
              {earnings.map((line) => (
                <div key={line.code} className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-muted-foreground">{line.name}</span>
                  <span className="numeric font-medium">{formatIDR(line.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[12px] font-semibold">
              <span>Total bruto</span>
              <span className="numeric">{formatIDR(slip.grossPay)}</span>
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Potongan</p>
            <div className="space-y-1.5">
              {deductions.map((line) => (
                <div key={line.code} className="flex items-start justify-between gap-3 text-[12px]">
                  <span className="text-muted-foreground">{line.name}</span>
                  <span className="numeric font-medium text-destructive">−{formatIDR(line.amount)}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[12px] font-semibold">
              <span>Total potongan</span>
              <span className="numeric text-destructive">−{formatIDR(slip.totalDeductions)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-y border-border bg-muted/40 px-6 py-3">
          <p className="text-[12px] font-medium">Gaji bersih diterima</p>
          <p className="numeric text-lg font-semibold">{formatIDR(slip.netPay)}</p>
        </div>

        <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Data kehadiran</p>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <p>Hari hadir: <span className="numeric text-foreground">{slip.attendanceDays} hari</span></p>
              <p>Jam lembur: <span className="numeric text-foreground">{slip.overtimeHours} jam</span></p>
              <p>Penghasilan kena pajak: <span className="numeric text-foreground">{formatIDR(slip.taxableGross)}</span></p>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kontribusi perusahaan</p>
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {slip.employerContributions.map((item) => (
                <div key={item.code} className="flex justify-between">
                  <span>{item.name}</span>
                  <span className="numeric">{formatIDR(item.amount)}</span>
                </div>
              ))}
              {slip.employerContributions.length === 0 ? <p>Tidak ada kontribusi tambahan.</p> : null}
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-3 text-[10px] leading-relaxed text-muted-foreground">
          Slip ini dihasilkan otomatis oleh NexaHR. Perhitungan PPh 21 bersifat estimasi menggunakan kebijakan berversi
          yang dikonfigurasi administrator. Dokumen bukan bukti pembayaran bank.
        </div>
      </Card>
    </div>
  );
}
