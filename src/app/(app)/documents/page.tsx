import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { DocumentUploadDialog, DeleteDocumentButton } from "@/components/documents/document-upload-dialog";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { DOCUMENT_TYPES } from "@/lib/design";
import { formatDateTime } from "@/lib/time";
import { KpiCard } from "@/components/kpi-card";
import { FolderOpen, HardDrive, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Dokumen" };
export const dynamic = "force-dynamic";

export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ employeeId?: string }> }) {
  const user = await requirePage("document.read");
  const { employeeId } = await searchParams;
  const canManage = hasPermission(user.permissions, "document.manage");

  const [documents, employees] = await Promise.all([
    prisma.employeeDocument.findMany({
      where: { tenantId: user.tenantId, ...(employeeId ? { employeeId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true } } },
    }),
    canManage
      ? prisma.employee.findMany({
          where: { tenantId: user.tenantId, status: { in: ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"] } },
          select: { id: true, firstName: true, lastName: true, employeeCode: true },
          orderBy: { firstName: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const totalBytes = documents.reduce((acc, document) => acc + document.sizeBytes, 0);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pertumbuhan"
        title="Dokumen karyawan"
        description="Arsip dokumen privat dengan validasi tipe berkas, kontrol akses per tenant, dan jejak unduhan."
        actions={canManage ? <DocumentUploadDialog employees={employees.map((employee) => ({ id: employee.id, name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(), employeeCode: employee.employeeCode }))} defaultEmployeeId={employeeId} /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard label="Total dokumen" value={documents.length} icon={FolderOpen} tone="primary" hint="Pada tenant ini" />
        <KpiCard label="Ruang terpakai" value={`${(totalBytes / 1024 / 1024).toFixed(1)} MB`} icon={HardDrive} hint="Penyimpanan privat" />
        <KpiCard label="Kontrol akses" value="Tenant-scoped" icon={ShieldCheck} tone="success" hint="Unduhan diaudit" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Arsip dokumen</CardTitle>
          <CardDescription>Hanya pengguna dengan izin document.read dapat mengunduh</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {documents.length === 0 ? (
            <EmptyState icon={FileText} title="Belum ada dokumen" description="Unggah kontrak, KTP, atau ijazah karyawan untuk memulai arsip digital." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dokumen</TableHead>
                  <TableHead>Karyawan</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Ukuran</TableHead>
                  <TableHead>Diunggah</TableHead>
                  {canManage ? <TableHead className="text-right">Aksi</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((document) => (
                  <TableRow key={document.id}>
                    <TableCell>
                      <a href={`/api/v1/documents/${document.id}/download`} className="flex items-center gap-2 text-[12px] font-medium text-primary hover:underline">
                        <FileText className="size-3.5" /> {document.name}
                      </a>
                      <p className="ml-5 text-[10px] text-muted-foreground">{document.fileName}</p>
                    </TableCell>
                    <TableCell className="text-[12px]">
                      {document.employee.firstName} {document.employee.lastName ?? ""}
                      <p className="text-[10px] text-muted-foreground">{document.employee.employeeCode}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline">{DOCUMENT_TYPES[document.type] ?? document.type}</Badge></TableCell>
                    <TableCell className="numeric text-[11px]">{(document.sizeBytes / 1024).toFixed(0)} KB</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{formatDateTime(document.createdAt)}</TableCell>
                    {canManage ? (
                      <TableCell className="text-right"><DeleteDocumentButton documentId={document.id} /></TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
