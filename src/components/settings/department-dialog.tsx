"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";

const schema = z.object({
  name: z.string().min(2, "Minimal 2 karakter"),
  code: z.string().min(2, "Minimal 2 karakter").max(10).regex(/^[A-Z0-9-]+$/, "Gunakan huruf kapital/angka"),
  description: z.string().max(300).optional(),
});

export function DepartmentDialog() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { name: "", code: "", description: "" } });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal membuat departemen.");
        return;
      }
      toast.success("Departemen ditambahkan.");
      setOpen(false);
      form.reset();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}><Building2 className="size-3.5" /> Departemen</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah departemen</DialogTitle>
            <DialogDescription>Departemen baru dapat langsung digunakan untuk penempatan karyawan.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="space-y-1">
              <Label htmlFor="name">Nama departemen</Label>
              <Input id="name" placeholder="Contoh: Layanan Pelanggan" {...form.register("name")} />
              <FieldError message={form.formState.errors.name?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Kode</Label>
              <Input id="code" placeholder="CS" maxLength={10} {...form.register("code")} />
              <FieldError message={form.formState.errors.code?.message} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="description">Deskripsi</Label>
              <Textarea id="description" rows={2} {...form.register("description")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : null} Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
