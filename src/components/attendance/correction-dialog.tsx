"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ClipboardEdit, Loader2 } from "lucide-react";
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

const schema = z.object({
  date: z.string().min(1, "Pilih tanggal"),
  requestedClockIn: z.string().optional(),
  requestedClockOut: z.string().optional(),
  reason: z.string().min(10, "Jelaskan alasan minimal 10 karakter").max(500),
});

export function CorrectionDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { date: new Date().toISOString().slice(0, 10), requestedClockIn: "", requestedClockOut: "", reason: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/attendance/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: values.date,
          requestedClockIn: values.requestedClockIn || undefined,
          requestedClockOut: values.requestedClockOut || undefined,
          reason: values.reason,
        }),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal mengirim koreksi.");
        return;
      }
      toast.success("Permintaan koreksi dikirim ke atasan langsung.");
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
          <Button variant="outline" size="sm">
            <ClipboardEdit className="size-3.5" /> Ajukan koreksi
          </Button>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajukan koreksi kehadiran</DialogTitle>
            <DialogDescription>
              Koreksi harus disetujui atasan langsung. Sertakan alasan yang jelas untuk keperluan audit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="date">Tanggal</Label>
              <Input id="date" type="date" max={new Date().toISOString().slice(0, 10)} {...form.register("date")} />
              <FieldError message={form.formState.errors.date?.message} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="in">Clock-in yang benar</Label>
                <Input id="in" type="time" {...form.register("requestedClockIn")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="out">Clock-out yang benar</Label>
                <Input id="out" type="time" {...form.register("requestedClockOut")} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="reason">Alasan</Label>
              <Textarea id="reason" rows={3} placeholder="Contoh: aplikasi gagal menyimpan clock-in pukul 08.22." {...form.register("reason")} />
              <FieldError message={form.formState.errors.reason?.message} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null} Kirim permintaan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
