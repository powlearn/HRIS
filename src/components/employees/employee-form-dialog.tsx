"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";
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
import { Label, FieldError, FieldHint } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Options = {
  departments: { id: string; name: string }[];
  positions: { id: string; title: string; departmentId: string | null }[];
  locations: { id: string; name: string }[];
  managers: { id: string; firstName: string; lastName: string | null; employeeCode: string }[];
  schedules: { id: string; name: string }[];
};

const formSchema = z.object({
  firstName: z.string().min(2, "Minimal 2 karakter"),
  lastName: z.string().optional(),
  email: z.string().email("Email tidak valid"),
  phone: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE"]).optional(),
  birthDate: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  departmentId: z.string().min(1, "Pilih departemen"),
  positionId: z.string().min(1, "Pilih jabatan"),
  locationId: z.string().min(1, "Pilih lokasi"),
  managerId: z.string().optional(),
  scheduleId: z.string().optional(),
  status: z.enum(["PERMANENT", "CONTRACT", "PROBATION", "INTERN"]),
  hireDate: z.string().min(1, "Tanggal bergabung wajib diisi"),
  endDate: z.string().optional(),
  contractType: z.enum(["PERMANENT", "FIXED_TERM", "PROBATION", "INTERNSHIP"]),
  basicSalary: z.number({ error: "Masukkan nominal yang valid" }).min(0, "Tidak boleh negatif"),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  nik: z.string().optional(),
  npwp: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyRelation: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const DEFAULTS: FormValues = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  gender: undefined,
  birthDate: "",
  address: "",
  city: "",
  departmentId: "",
  positionId: "",
  locationId: "",
  managerId: "",
  scheduleId: "",
  status: "PROBATION",
  hireDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  contractType: "PROBATION",
  basicSalary: 0,
  bankName: "",
  bankAccount: "",
  nik: "",
  npwp: "",
  emergencyName: "",
  emergencyRelation: "",
  emergencyPhone: "",
};

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employeeId,
  options,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employeeId?: string;
  options?: Options;
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [directory, setDirectory] = React.useState<Options | null>(options ?? null);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const form = useForm<FormValues>({ resolver: zodResolver(formSchema), defaultValues: DEFAULTS });
  const departmentId = form.watch("departmentId");

  React.useEffect(() => {
    if (!open) return;
    async function load() {
      setLoading(true);
      try {
        const [directoryRes, detailRes] = await Promise.all([
          directory
            ? Promise.resolve(null)
            : fetch("/api/v1/employees/options", { cache: "no-store" }),
          mode === "edit" && employeeId ? fetch(`/api/v1/employees/${employeeId}`, { cache: "no-store" }) : Promise.resolve(null),
        ]);

        if (directoryRes) {
          const payload = (await directoryRes.json()) as { data?: Options };
          if (payload.data) setDirectory(payload.data);
        }

        if (detailRes) {
          const payload = (await detailRes.json()) as {
            data?: {
              employee: {
                firstName: string;
                lastName: string | null;
                email: string;
                phone: string | null;
                gender: string | null;
                birthDate: string | null;
                address: string | null;
                city: string | null;
                status: FormValues["status"];
                hireDate: string;
                endDate: string | null;
                bankName: string | null;
                department: { id: string } | null;
                position: { id: string } | null;
                location: { id: string } | null;
                schedule: { id: string } | null;
                manager: { id: string } | null;
                basicSalary: number | null;
                emergency: { name: string | null; relation: string | null; phone: string | null };
              };
            };
          };
          const employee = payload.data?.employee;
          if (employee) {
            form.reset({
              ...DEFAULTS,
              firstName: employee.firstName,
              lastName: employee.lastName ?? "",
              email: employee.email,
              phone: employee.phone ?? "",
              gender: (employee.gender as "MALE" | "FEMALE" | null) ?? undefined,
              birthDate: employee.birthDate?.slice(0, 10) ?? "",
              address: employee.address ?? "",
              city: employee.city ?? "",
              departmentId: employee.department?.id ?? "",
              positionId: employee.position?.id ?? "",
              locationId: employee.location?.id ?? "",
              managerId: employee.manager?.id ?? "",
              scheduleId: employee.schedule?.id ?? "",
              status: employee.status,
              hireDate: employee.hireDate.slice(0, 10),
              endDate: employee.endDate?.slice(0, 10) ?? "",
              basicSalary: employee.basicSalary ?? 0,
              bankName: employee.bankName ?? "",
              emergencyName: employee.emergency.name ?? "",
              emergencyRelation: employee.emergency.relation ?? "",
              emergencyPhone: employee.emergency.phone ?? "",
            });
          }
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, employeeId]);

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const res = await fetch(mode === "create" ? "/api/v1/employees" : `/api/v1/employees/${employeeId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await res.json()) as { error?: { message: string; details?: { fieldErrors?: Record<string, string[]> } } };
      if (!res.ok) {
        const fieldErrors = payload.error?.details?.fieldErrors;
        if (fieldErrors) {
          for (const [field, messages] of Object.entries(fieldErrors)) {
            form.setError(field as keyof FormValues, { message: messages?.[0] });
          }
        }
        toast.error(payload.error?.message ?? "Gagal menyimpan karyawan.");
        return;
      }
      toast.success(mode === "create" ? "Karyawan berhasil ditambahkan." : "Data karyawan diperbarui.");
      onOpenChange(false);
      if (mode === "create") form.reset(DEFAULTS);
      onSaved?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const positions = (directory?.positions ?? []).filter(
    (position) => !departmentId || position.departmentId === departmentId,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent wide className="max-h-[92vh]">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah karyawan" : "Ubah data karyawan"}</DialogTitle>
          <DialogDescription>
            ID karyawan dibuat otomatis. Data sensitif dienkripsi dan hanya terlihat oleh peran berwenang.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-3 py-6">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="shimmer h-9 rounded-lg" />
            ))}
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5" noValidate>
            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Data pribadi</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="firstName">Nama depan</Label>
                  <Input id="firstName" {...form.register("firstName")} />
                  <FieldError message={form.formState.errors.firstName?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName">Nama belakang</Label>
                  <Input id="lastName" {...form.register("lastName")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email perusahaan</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  <FieldError message={form.formState.errors.email?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Telepon</Label>
                  <Input id="phone" placeholder="+62 812-3456-7890" {...form.register("phone")} />
                </div>
                <div className="space-y-1">
                  <Label>Jenis kelamin</Label>
                  <Select
                    value={form.watch("gender") ?? ""}
                    onValueChange={(value) => form.setValue("gender", value as "MALE" | "FEMALE")}
                  >
                    <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE">Laki-laki</SelectItem>
                      <SelectItem value="FEMALE">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="birthDate">Tanggal lahir</Label>
                  <Input id="birthDate" type="date" {...form.register("birthDate")} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="address">Alamat</Label>
                  <Textarea id="address" rows={2} className="min-h-16" {...form.register("address")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="city">Kota</Label>
                  <Input id="city" {...form.register("city")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="nik">NIK</Label>
                  <Input id="nik" inputMode="numeric" maxLength={16} {...form.register("nik")} />
                  <FieldHint>16 digit · dienkripsi di database.</FieldHint>
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Kepegawaian</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Departemen</Label>
                  <Select value={departmentId} onValueChange={(value) => { form.setValue("departmentId", value); form.setValue("positionId", ""); }}>
                    <SelectTrigger><SelectValue placeholder="Pilih departemen" /></SelectTrigger>
                    <SelectContent>
                      {(directory?.departments ?? []).map((department) => (
                        <SelectItem key={department.id} value={department.id}>{department.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.departmentId?.message} />
                </div>
                <div className="space-y-1">
                  <Label>Jabatan</Label>
                  <Select value={form.watch("positionId")} onValueChange={(value) => form.setValue("positionId", value)}>
                    <SelectTrigger><SelectValue placeholder="Pilih jabatan" /></SelectTrigger>
                    <SelectContent>
                      {positions.map((position) => (
                        <SelectItem key={position.id} value={position.id}>{position.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.positionId?.message} />
                </div>
                <div className="space-y-1">
                  <Label>Lokasi kerja</Label>
                  <Select value={form.watch("locationId")} onValueChange={(value) => form.setValue("locationId", value)}>
                    <SelectTrigger><SelectValue placeholder="Pilih lokasi" /></SelectTrigger>
                    <SelectContent>
                      {(directory?.locations ?? []).map((location) => (
                        <SelectItem key={location.id} value={location.id}>{location.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError message={form.formState.errors.locationId?.message} />
                </div>
                <div className="space-y-1">
                  <Label>Atasan langsung</Label>
                  <Select value={form.watch("managerId") || "none"} onValueChange={(value) => form.setValue("managerId", value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Tanpa atasan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa atasan langsung</SelectItem>
                      {(directory?.managers ?? [])
                        .filter((manager) => manager.id !== employeeId)
                        .map((manager) => (
                          <SelectItem key={manager.id} value={manager.id}>
                            {manager.firstName} {manager.lastName ?? ""} · {manager.employeeCode}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Jadwal kerja</Label>
                  <Select value={form.watch("scheduleId") || "none"} onValueChange={(value) => form.setValue("scheduleId", value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Gunakan jadwal default" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Jadwal default tenant</SelectItem>
                      {(directory?.schedules ?? []).map((schedule) => (
                        <SelectItem key={schedule.id} value={schedule.id}>{schedule.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Status kepegawaian</Label>
                  <Select value={form.watch("status")} onValueChange={(value) => form.setValue("status", value as FormValues["status"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERMANENT">Karyawan Tetap</SelectItem>
                      <SelectItem value="CONTRACT">Kontrak</SelectItem>
                      <SelectItem value="PROBATION">Probasi</SelectItem>
                      <SelectItem value="INTERN">Magang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="hireDate">Tanggal bergabung</Label>
                  <Input id="hireDate" type="date" {...form.register("hireDate")} />
                  <FieldError message={form.formState.errors.hireDate?.message} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="endDate">Akhir kontrak</Label>
                  <Input id="endDate" type="date" {...form.register("endDate")} />
                </div>
                <div className="space-y-1">
                  <Label>Jenis kontrak</Label>
                  <Select value={form.watch("contractType")} onValueChange={(value) => form.setValue("contractType", value as FormValues["contractType"])}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PERMANENT">PKWTT (Tetap)</SelectItem>
                      <SelectItem value="FIXED_TERM">PKWT (Kontrak)</SelectItem>
                      <SelectItem value="PROBATION">Probasi</SelectItem>
                      <SelectItem value="INTERNSHIP">Magang</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="basicSalary">Gaji pokok (IDR)</Label>
                  <Input id="basicSalary" type="number" step="1000" min="0" {...form.register("basicSalary", { valueAsNumber: true })} />
                  <FieldError message={form.formState.errors.basicSalary?.message} />
                </div>
              </div>
            </section>

            <section className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Bank & darurat</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="bankName">Nama bank</Label>
                  <Input id="bankName" placeholder="Bank Central Asia" {...form.register("bankName")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="bankAccount">Nomor rekening</Label>
                  <Input id="bankAccount" inputMode="numeric" {...form.register("bankAccount")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="npwp">NPWP</Label>
                  <Input id="npwp" {...form.register("npwp")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emergencyName">Kontak darurat</Label>
                  <Input id="emergencyName" {...form.register("emergencyName")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emergencyRelation">Hubungan</Label>
                  <Input id="emergencyRelation" placeholder="Pasangan / Orang Tua" {...form.register("emergencyRelation")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="emergencyPhone">Telepon darurat</Label>
                  <Input id="emergencyPhone" {...form.register("emergencyPhone")} />
                </div>
              </div>
            </section>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                {mode === "create" ? "Simpan karyawan" : "Simpan perubahan"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
