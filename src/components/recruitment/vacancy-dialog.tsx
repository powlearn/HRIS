"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Briefcase, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  title: z.string().min(3, "Judul minimal 3 karakter"),
  departmentId: z.string().min(1, "Pilih departemen"),
  description: z.string().min(20, "Deskripsi minimal 20 karakter"),
  workMode: z.enum(["ONSITE", "HYBRID", "REMOTE", "FIELD"]),
  status: z.enum(["DRAFT", "OPEN"]),
  openings: z.number().int().min(1).max(50),
  salaryMin: z.number().min(0).optional(),
  salaryMax: z.number().min(0).optional(),
  location: z.string().optional(),
});

export function VacancyDialog({
  departments,
  locationOptions,
}: {
  departments: { id: string; name: string }[];
  locationOptions: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { title: "", departmentId: "", description: "", workMode: "HYBRID", status: "OPEN", openings: 1, salaryMin: undefined, salaryMax: undefined, location: locationOptions[0] ?? "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/recruitment/vacancies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal membuat lowongan.");
        return;
      }
      toast.success("Lowongan berhasil dibuat.");
      setOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <Briefcase className="size-3.5" /> Buat lowongan
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>Buat lowongan baru</DialogTitle>
            <DialogDescription>Lowongan terbuka dapat menerima pelamar melalui kanal rekrutmen.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="title">Judul posisi</Label>
                <Input id="title" placeholder="Senior Software Engineer" {...form.register("title")} />
                <FieldError message={form.formState.errors.title?.message} />
              </div>
              <div className="space-y-1">
                <Label>Departemen</Label>
                <Select value={form.watch("departmentId")} onValueChange={(value) => form.setValue("departmentId", value)}>
                  <SelectTrigger><SelectValue placeholder="Pilih departemen" /></SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={form.formState.errors.departmentId?.message} />
              </div>
              <div className="space-y-1">
                <Label>Mode kerja</Label>
                <Select value={form.watch("workMode")} onValueChange={(value) => form.setValue("workMode", value as z.infer<typeof schema>["workMode"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ONSITE">Onsite</SelectItem>
                    <SelectItem value="HYBRID">Hybrid</SelectItem>
                    <SelectItem value="REMOTE">Remote</SelectItem>
                    <SelectItem value="FIELD">Lapangan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as "DRAFT" | "OPEN")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Draf</SelectItem>
                    <SelectItem value="OPEN">Buka lowongan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="openings">Jumlah kebutuhan</Label>
                <Input id="openings" type="number" min={1} {...form.register("openings", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="location">Lokasi</Label>
                <Input id="location" {...form.register("location")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="salaryMin">Gaji minimum</Label>
                <Input id="salaryMin" type="number" step="500000" {...form.register("salaryMin", { valueAsNumber: true })} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="salaryMax">Gaji maksimum</Label>
                <Input id="salaryMax" type="number" step="500000" {...form.register("salaryMax", { valueAsNumber: true })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Deskripsi pekerjaan</Label>
              <Textarea id="description" rows={4} {...form.register("description")} />
              <FieldError message={form.formState.errors.description?.message} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null} Simpan lowongan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
