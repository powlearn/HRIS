import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/primitives";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";
import { ROLE_LABEL } from "@/lib/design";
import { formatDate, formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Profil Saya" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requirePage();

  const [account, employee, activity] = await Promise.all([
    prisma.user.findUnique({
      where: { id: user.id },
      include: { role: { include: { permissions: { include: { permission: true } } } }, tenant: { select: { name: true } } },
    }),
    user.employeeId
      ? prisma.employee.findFirst({
          where: { id: user.employeeId, tenantId: user.tenantId },
          include: { department: { select: { name: true } }, position: { select: { title: true } }, manager: { select: { firstName: true, lastName: true } } },
        })
      : null,
    prisma.auditLog.findMany({ where: { tenantId: user.tenantId, actorId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  const permissionLabels = new Map(PERMISSIONS.map((permission) => [permission.key, permission.label]));
  const permissions = account?.role?.permissions.map((rp) => rp.permission.key) ?? [];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow="Akun" title="Profil saya" description="Informasi akun, peran, izin efektif, dan aktivitas terbaru." />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <PersonAvatar name={user.name} className="size-16 rounded-xl text-base" />
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{user.name}</h2>
                <Badge variant="primary">{ROLE_LABEL[user.roleSlug] ?? user.roleName}</Badge>
              </div>
              <p className="text-[12px] text-muted-foreground">{user.email}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Mail className="size-3" /> {account?.tenant?.name}</span>
                {employee ? <span className="flex items-center gap-1"><UserRound className="size-3" /> {employee.employeeCode} · {employee.position?.title}</span> : null}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 text-[11px]">
              {employee ? <Button asChild size="sm" variant="outline"><Link href={`/employees/${employee.id}`}>Buka profil karyawan</Link></Button> : null}
              <Button asChild size="sm" variant="ghost"><Link href="/forgot-password"><KeyRound className="size-3.5" /> Ubah kata sandi</Link></Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Keamanan sesi</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-[11px]">
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Status akun</span><Badge variant={account?.status === "ACTIVE" ? "success" : "danger"}>{account?.status ?? "—"}</Badge></div>
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Login terakhir</span><span>{formatDateTime(account?.lastLoginAt)}</span></div>
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Versi sesi</span><span className="numeric">{account?.sessionVersion ?? 0}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Dibuat</span><span>{formatDate(account?.createdAt)}</span></div>
            <p className="rounded-md bg-muted/50 p-2 leading-relaxed text-muted-foreground">
              Sesi kedaluwarsa otomatis setelah 8 jam. Perubahan kata sandi mencabut seluruh sesi lain.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4 text-muted-foreground" /> Izin efektif</CardTitle>
            <CardDescription>{permissions.includes("*") ? "Akses penuh (wildcard)" : `${permissions.length} izin dari peran ${account?.role?.name}`}</CardDescription>
          </CardHeader>
          <CardContent>
            {permissions.includes("*") ? (
              <div className="rounded-lg border border-success/25 bg-success/5 p-3 text-[12px]">
                Peran Anda memiliki akses penuh ke seluruh modul tenant.
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {permissions.map((key) => (
                  <Badge key={key} variant="outline" className="font-normal">
                    {permissionLabels.get(key as never) ?? key}
                  </Badge>
                ))}
                {permissions.length === 0 ? <p className="text-[12px] text-muted-foreground">Belum ada izin yang diberikan.</p> : null}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><BadgeCheck className="size-4 text-muted-foreground" /> Aktivitas saya</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {activity.length === 0 ? (
              <p className="text-[12px] text-muted-foreground">Belum ada aktivitas.</p>
            ) : (
              activity.map((log) => (
                <div key={log.id} className="border-b border-border/50 pb-1.5 last:border-0">
                  <p className="text-[11px] font-medium">{log.action.replace(/[._]/g, " ")}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDateTime(log.createdAt)} · {log.module}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
