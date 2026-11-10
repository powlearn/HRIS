import type { Metadata } from "next";
import { MapPin, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { DepartmentDialog } from "@/components/settings/department-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const metadata: Metadata = { title: "Organisasi" };
export const dynamic = "force-dynamic";

export default async function OrganizationSettingsPage() {
  const user = await requirePage("settings.read");
  const canManage = hasPermission(user.permissions, "org.manage");

  const [departments, locations, schedules, positions] = await Promise.all([
    prisma.department.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { name: "asc" },
      include: { _count: { select: { employees: true, positions: true } }, head: { select: { firstName: true, lastName: true } } },
    }),
    prisma.workLocation.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" }, include: { _count: { select: { employees: true } } } }),
    prisma.workSchedule.findMany({ where: { tenantId: user.tenantId }, orderBy: { name: "asc" } }),
    prisma.position.count({ where: { tenantId: user.tenantId } }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistem"
        title="Struktur organisasi"
        description="Departemen, jabatan, lokasi kerja dengan geofence, dan jadwal shift."
        actions={canManage ? <DepartmentDialog /> : null}
      />
      <SettingsNav />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Departemen</CardTitle><CardDescription>{departments.length} departemen · {positions} jabatan terdaftar</CardDescription></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Kode</TableHead>
                  <TableHead>Kepala</TableHead>
                  <TableHead>Jabatan</TableHead>
                  <TableHead className="text-right">Karyawan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell>
                      <p className="text-[12px] font-medium">{department.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{department.description ?? "—"}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline">{department.code}</Badge></TableCell>
                    <TableCell className="text-[11px]">{department.head ? `${department.head.firstName} ${department.head.lastName ?? ""}` : "—"}</TableCell>
                    <TableCell className="numeric text-[11px]">{department._count.positions}</TableCell>
                    <TableCell className="numeric text-right text-[12px]">{department._count.employees}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Lokasi kerja</CardTitle><CardDescription>Geofence GPS opsional</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {locations.map((location) => (
                <div key={location.id} className="rounded-lg border border-border/70 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-medium">{location.name}</p>
                    <Badge variant="outline">{location.code}</Badge>
                  </div>
                  <p className="mt-0.5 flex items-start gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="mt-px size-2.5 shrink-0" /> {location.city ?? "—"} · radius {location.radiusMeters} m
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">{location._count.employees} karyawan ditempatkan</p>
                  {location.latitude ? (
                    <p className="mt-0.5 font-mono text-[9px] text-muted-foreground">{location.latitude.toFixed(4)}, {location.longitude?.toFixed(4)}</p>
                  ) : null}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Jadwal kerja</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {schedules.map((schedule) => (
                <div key={schedule.id} className="flex items-center justify-between rounded-md border border-border/60 px-2 py-1.5 text-[11px]">
                  <div>
                    <p className="font-medium">{schedule.name}</p>
                    <p className="text-[9px] text-muted-foreground">Toleransi {schedule.graceMinutes} menit · istirahat {schedule.breakMinutes} menit</p>
                  </div>
                  <span className="numeric text-muted-foreground">{schedule.startTime}–{schedule.endTime}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
            <Users className="mt-px size-3 shrink-0" />
            Lokasi GPS bersifat indikatif. Kebijakan tenant menentukan apakah geofence wajib saat clock-in.
          </p>
        </div>
      </div>
    </div>
  );
}
