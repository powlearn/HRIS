import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Audit Log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 30;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; module?: string; page?: string }>;
}) {
  const user = await requirePage("audit.view");
  const params = await searchParams;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const q = params.q?.trim();

  const where = {
    tenantId: user.tenantId,
    ...(params.module && params.module !== "all" ? { module: params.module } : {}),
    ...(q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { actorName: { contains: q, mode: "insensitive" as const } },
            { entityType: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [total, logs, modules] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditLog.groupBy({ by: ["module"], where: { tenantId: user.tenantId }, _count: { _all: true } }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistem"
        title="Audit log"
        description="Jejak aktivitas append-only untuk investigasi keamanan dan kepatuhan."
      />
      <SettingsNav />

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-2">
          <div>
            <CardTitle>Aktivitas tenant</CardTitle>
            <CardDescription>{total} catatan · halaman {page} dari {pageCount}</CardDescription>
          </div>
          <form className="flex flex-wrap items-center gap-2" action="/settings/audit">
            <Input name="q" defaultValue={q} placeholder="Cari aktor atau aksi…" className="h-8 w-48 text-[12px]" />
            <select name="module" defaultValue={params.module ?? "all"} className="h-8 rounded-md border border-input bg-card px-2 text-[12px]" aria-label="Modul">
              <option value="all">Semua modul</option>
              {modules.map((module) => (
                <option key={module.module} value={module.module}>{module.module} ({module._count._all})</option>
              ))}
            </select>
            <button type="submit" className="h-8 rounded-md border border-border px-2.5 text-[12px] hover:bg-muted">Filter</button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <EmptyState icon={ScrollText} title="Tidak ada catatan" description="Aktivitas akan tercatat otomatis setelah tindakan pengguna." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Waktu</TableHead>
                  <TableHead>Aktor</TableHead>
                  <TableHead>Aksi</TableHead>
                  <TableHead>Modul</TableHead>
                  <TableHead>Entitas</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="numeric whitespace-nowrap text-[11px]">{formatDateTime(log.createdAt)}</TableCell>
                    <TableCell className="text-[11px]">{log.actorName ?? "Sistem"}</TableCell>
                    <TableCell className="font-mono text-[10px]">{log.action}</TableCell>
                    <TableCell><Badge variant="outline">{log.module}</Badge></TableCell>
                    <TableCell className="text-[10px] text-muted-foreground">
                      {log.entityType ?? "—"}
                      {log.entityId ? <span className="block truncate font-mono text-[9px]">{log.entityId}</span> : null}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground">{log.ipAddress ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px]">
            <span className="text-muted-foreground">{total} catatan</span>
            <div className="flex gap-2">
              {page > 1 ? <Link href={`/settings/audit?page=${page - 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${params.module ? `&module=${params.module}` : ""}`} className="text-primary hover:underline">Sebelumnya</Link> : null}
              {page < pageCount ? <Link href={`/settings/audit?page=${page + 1}${q ? `&q=${encodeURIComponent(q)}` : ""}${params.module ? `&module=${params.module}` : ""}`} className="text-primary hover:underline">Berikutnya</Link> : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
