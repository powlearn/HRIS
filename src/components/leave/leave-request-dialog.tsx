"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type LeaveType = {
  id: string;
  name: string;
  annualQuota: number;
  minNoticeDays: number;
  maxConsecutiveDays: number;
  requiresDocument: boolean;
};

const schema = z.object({
  leaveTypeId: z.string().min(1, "Pilih jenis cuti"),
  startDate: z.string().min(1, "Tanggal mulai wajib diisi"),
  endDate: z.string().min(1, "Tanggal selesai wajib diisi"),
  reason: z.string().min(10, "Alasan minimal 10 karakter").max(500),
});

export function LeaveRequestDialog({
  types,
  balances,
  trigger,
}: {
  types: LeaveType[];
  balances: { code: string; remaining: number; name: string }[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [selectedType, setSelectedType] = React.useState(types[0]?.id ?? "");
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { leaveTypeId: types[0]?.id ?? "", startDate: "", endDate: "", reason: "" },
  });

  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const days =
    startDate && endDate && new Date(endDate) >= new Date(startDate)
      ? Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1
      : 0;
  const type = types.find((item) => item.id === selectedType);
  const balance = balances.find((item) => types.find((t) => t.id === selectedType)?.name === item.name);

  async function onSubmit(values: z.infer<typeof schema>) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/leave/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal mengirim pengajuan cuti.");
        return;
      }
      toast.success("Pengajuan cuti terkirim ke atasan langsung.");
      setOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm">
            <CalendarPlus className="size-3.5" /> Ajukan cuti
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan cuti</DialogTitle>
            <DialogDescription>
              Pengajuan diteruskan ke atasan langsung lalu verifikasi HR. Pastikan pekerjaan sudah didelegasikan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label>Jenis cuti</Label>
              <Select
                value={selectedType}
                onValueChange={(value) => {
                  setSelectedType(value);
                  form.setValue("leaveTypeId", value);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Pilih jenis cuti" /></SelectTrigger>
                <SelectContent>
                  {types.map((item) => (
                    <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={form.formState.errors.leaveTypeId?.message} />
              {type ? (
                <p className="text-[11px] text-muted-foreground">
                  Kuota {type.annualQuota} hari · minimal {type.minNoticeDays} hari sebelumnya
                  {balance ? ` · sisa ${balance.remaining} hari` : ""}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="startDate">Mulai</Label>
                <Input id="startDate" type="date" {...form.register("startDate")} />
                <FieldError message={form.formState.errors.startDate?.message} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">Selesai</Label>
                <Input id="endDate" type="date" {...form.register("endDate")} />
                <FieldError message={form.formState.errors.endDate?.message} />
              </div>
            </div>

            {days > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-[12px]">
                <span className="text-muted-foreground">Total hari</span>
                <span className="numeric font-semibold">{days} hari</span>
              </div>
            ) : null}

            <div className="space-y-1">
              <Label htmlFor="reason">Alasan / keterangan</Label>
              <Textarea id="reason" rows={3} placeholder="Jelaskan keperluan cuti Anda." {...form.register("reason")} />
              <FieldError message={form.formState.errors.reason?.message} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null} Kirim pengajuan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
