import type { Metadata } from "next";
import Link from "next/link";
import { Building2, KeyRound, ShieldCheck, Sparkles, Users, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/time";

export const metadata: Metadata = { title: "Pengaturan" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePage("settings.read");

  const [tenant, roles, departments, employees, settings, policies] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: user.tenantId } }),
    prisma.role.findMany({ where: { OR: [{ tenantId: user.tenantId }, { tenantId: null }] }, include: { _count: { select: { users: true, permissions: true } } } }),
    prisma.department.count({ where: { tenantId: user.tenantId } }),
    prisma.employee.count({ where: { tenantId: user.tenantId } }),
    prisma.systemSetting.findMany({ where: { tenantId: user.tenantId }, orderBy: { key: "asc" } }),
    prisma.payrollPolicy.findMany({ where: { tenantId: user.tenantId }, orderBy: { version: "desc" }, take: 3 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Sistem" title="Pengaturan" description="Konfigurasi tenant, tata kelola akses, kebijakan, dan jejak audit." />
      <SettingsNav />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profil tenant</CardTitle>
            <CardDescription>Informasi organisasi dan zona waktu operasional</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-x-6 gap-y-2 text-[12px] sm:grid-cols-2">
            {[
              ["Nama tenant", tenant?.name ?? "—"],
              ["Badan hukum", tenant?.legalName ?? "—"],
              ["Slug", tenant?.slug ?? "—"],
              ["Industri", tenant?.industry ?? "—"],
              ["Zona waktu", tenant?.timezone ?? "—"],
              ["Mata uang", tenant?.currency ?? "—"],
              ["Prefix ID karyawan", tenant?.employeeCodePrefix ?? "—"],
              ["Status", tenant?.status ?? "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-border/50 py-1.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Kepatuhan & keamanan</CardTitle></CardHeader>
          <CardContent className="space-y-2.5 text-[11px]">
            <div className="flex items-center gap-2"><ShieldCheck className="size-3.5 text-success" /> Isolasi tenant di lapisan server</div>
            <div className="flex items-center gap-2"><KeyRound className="size-3.5 text-success" /> RBAC granular per modul & aksi</div>
            <div className="flex items-center gap-2"><Users className="size-3.5 text-success" /> Data sensitif terenkripsi AES-256-GCM</div>
            <div className="flex items-center gap-2"><Sparkles className="size-3.5 text-muted-foreground" /> AI nonaktif secara default</div>
            <p className="rounded-md bg-muted/50 p-2 leading-relaxed text-muted-foreground">
              Perubahan izin berlaku pada sesi berikutnya. Sesi JWT berlaku maksimal 8 jam dan dapat dicabut dengan
              menaikkan versi sesi pengguna.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/settings/organization" className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/30">
          <div className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-4" /></span>
            <Badge variant="outline">{departments}</Badge>
          </div>
          <p className="mt-3 text-[13px] font-medium">Struktur organisasi</p>
          <p className="text-[11px] text-muted-foreground">Departemen, jabatan, lokasi & geofence</p>
        </Link>
        <Link href="/settings/roles" className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/30">
          <div className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><KeyRound className="size-4" /></span>
            <Badge variant="outline">{roles.length} peran</Badge>
          </div>
          <p className="mt-3 text-[13px] font-medium">Peran & izin</p>
          <p className="text-[11px] text-muted-foreground">Matriks izin per modul dan aksi</p>
        </Link>
        <Link href="/settings/payroll" className="group rounded-xl border border-border bg-card p-4 transition hover:border-primary/30">
          <div className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wallet className="size-4" /></span>
            <Badge variant="outline">v{policies[0]?.version ?? 0}</Badge>
          </div>
          <p className="mt-3 text-[13px] font-medium">Kebijakan payroll</p>
          <p className="text-[11px] text-muted-foreground">Tarif berversi, komponen & PTKP</p>
        </Link>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="size-4" /></span>
            <Badge variant="outline">{employees}</Badge>
          </div>
          <p className="mt-3 text-[13px] font-medium">Karyawan terdaftar</p>
          <p className="text-[11px] text-muted-foreground">Sejak {formatDate(tenant?.createdAt ?? new Date())}</p>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Konfigurasi sistem</CardTitle><CardDescription>Nilai tersimpan di tabel SystemSetting per tenant</CardDescription></CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {settings.map((setting) => (
            <div key={setting.id} className="rounded-lg border border-border/70 p-2.5">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold">{setting.key}</p>
                <Badge variant="outline">{setting.category}</Badge>
              </div>
              <pre className="mt-1 overflow-x-auto text-[10px] leading-relaxed text-muted-foreground">
                {JSON.stringify(setting.value, null, 2)}
              </pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
