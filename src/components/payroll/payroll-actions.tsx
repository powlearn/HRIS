"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Banknote, Download, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PayrollActions({
  periodId,
  status,
  periodName,
  canManage,
  canApprove,
}: {
  periodId: string;
  status: string;
  periodName: string;
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<null | "process" | "approve" | "mark-paid">(null);
  const [pending, setPending] = React.useState(false);

  async function run(action: "process" | "approve" | "mark-paid") {
    setPending(true);
    try {
      const res = await fetch(`/api/v1/payroll/periods/${periodId}/${action}`, {
        method: action === "approve" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Aksi payroll gagal.");
        return;
      }
      toast.success(
        action === "process" ? "Payroll berhasil diproses dan menunggu persetujuan." : action === "approve" ? "Payroll disetujui." : "Payroll ditandai sudah dibayar.",
      );
      setConfirm(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  const labels = {
    process: { title: "Proses payroll", description: `Hitung gaji seluruh karyawan aktif untuk ${periodName}? Perhitungan menggunakan kebijakan aktif dan data kehadiran periode ini.` },
    approve: { title: "Setujui payroll", description: "Setelah disetujui, nilai payroll tidak dapat dihitung ulang. Pastikan Anda sudah memverifikasi rekapitulasi." },
    "mark-paid": { title: "Tandai sudah dibayar", description: "Status akan berubah menjadi dibayar dan seluruh karyawan menerima notifikasi slip gaji." },
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canManage && status === "DRAFT" ? (
        <Button size="sm" onClick={() => setConfirm("process")}>
          <Play className="size-3.5" /> Proses payroll
        </Button>
      ) : null}
      {canApprove && status === "PENDING_APPROVAL" ? (
        <Button size="sm" onClick={() => setConfirm("approve")}>
          <BadgeCheck className="size-3.5" /> Setujui
        </Button>
      ) : null}
      {canManage && status === "APPROVED" ? (
        <Button size="sm" onClick={() => setConfirm("mark-paid")}>
          <Banknote className="size-3.5" /> Tandai dibayar
        </Button>
      ) : null}
      {status !== "DRAFT" ? (
        <Button asChild size="sm" variant="outline">
          <a href={`/api/v1/payroll/periods/${periodId}/export`} download>
            <Download className="size-3.5" /> Ekspor CSV
          </a>
        </Button>
      ) : null}

      <Dialog open={confirm !== null} onOpenChange={(open) => !open && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirm ? labels[confirm].title : ""}</DialogTitle>
            <DialogDescription>{confirm ? labels[confirm].description : ""}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={pending}>Batal</Button>
            <Button onClick={() => confirm && run(confirm)} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null} Lanjutkan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
