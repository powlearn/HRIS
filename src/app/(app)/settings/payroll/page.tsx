import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { PolicyEditor } from "@/components/settings/policy-editor";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { formatDate } from "@/lib/time";
import { formatIDR } from "@/lib/money";

export const metadata: Metadata = { title: "Kebijakan Payroll" };
export const dynamic = "force-dynamic";

export default async function PayrollSettingsPage() {
  const user = await requirePage("settings.read");
  const canManage = hasPermission(user.permissions, "payroll.manage");

  const [policies, components] = await Promise.all([
    prisma.payrollPolicy.findMany({ where: { tenantId: user.tenantId }, orderBy: { version: "desc" } }),
    prisma.payrollComponent.findMany({ where: { tenantId: user.tenantId }, orderBy: { sortOrder: "asc" } }),
  ]);
  const active = policies.find((policy) => policy.isActive) ?? policies[0] ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistem"
        title="Kebijakan payroll"
        description="Semua tarif dan parameter diatur sebagai konfigurasi berversi. Perubahan menghasilkan versi baru, bukan menimpa histori."
      />
      <SettingsNav />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Versi kebijakan</CardTitle><CardDescription>Riwayat perubahan</CardDescription></div>
              {active ? <Badge variant="success">v{active.version} aktif</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Versi</TableHead><TableHead>Nama</TableHead><TableHead>Berlaku</TableHead><TableHead>Status</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {policies.map((policy) => (
                  <TableRow key={policy.id}>
                    <TableCell className="numeric text-[12px]">v{policy.version}</TableCell>
                    <TableCell className="text-[11px]">{policy.name}</TableCell>
                    <TableCell className="text-[11px]">{formatDate(policy.effectiveFrom)}</TableCell>
                    <TableCell><Badge variant={policy.isActive ? "success" : "outline"}>{policy.isActive ? "Aktif" : "Arsip"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {active ? (
              <div className="border-t border-border/60 p-4">
                <p className="mb-2 text-[11px] font-semibold">Konfigurasi aktif</p>
                <pre className="max-h-64 overflow-auto rounded-md bg-muted/50 p-2 text-[10px] leading-relaxed">
                  {JSON.stringify(active.config, null, 2)}
                </pre>
                <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                  {active.notes ?? "Nilai contoh; sesuaikan dengan regulasi yang berlaku di yurisdiksi Anda."}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{canManage ? "Buat versi kebijakan baru" : "Akses terbatas"}</CardTitle>
            <CardDescription>
              {canManage ? "Menyimpan akan menonaktifkan versi sebelumnya dan mengaktifkan versi baru." : "Perlu izin payroll.manage untuk mengubah kebijakan."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {canManage && active ? (
              <PolicyEditor initialConfig={active.config} initialName={active.name} />
            ) : (
              <p className="text-[12px] text-muted-foreground">Anda dapat melihat konfigurasi tetapi tidak mengubahnya.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Komponen gaji</CardTitle><CardDescription>Pendapatan dan potongan non-statutori</CardDescription></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Komponen</TableHead>
                <TableHead>Kode</TableHead>
                <TableHead>Tipe</TableHead>
                <TableHead>Perhitungan</TableHead>
                <TableHead className="text-right">Nilai</TableHead>
                <TableHead>Kena pajak</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {components.map((component) => (
                <TableRow key={component.id}>
                  <TableCell className="text-[12px]">{component.name}</TableCell>
                  <TableCell className="font-mono text-[10px]">{component.code}</TableCell>
                  <TableCell><Badge variant={component.type === "EARNING" ? "success" : "danger"}>{component.type === "EARNING" ? "Pendapatan" : "Potongan"}</Badge></TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">{component.calculation.replace(/_/g, " ").toLowerCase()}</TableCell>
                  <TableCell className="numeric text-right text-[12px]">{formatIDR(component.amount)}</TableCell>
                  <TableCell className="text-[11px]">{component.isTaxable ? "Ya" : "Tidak"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
