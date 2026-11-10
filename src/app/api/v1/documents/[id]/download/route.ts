import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readUpload } from "@/lib/storage";
import { writeAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";

export const GET = apiRoute<{ id: string }>({
  permission: "document.read",
  handler: async ({ req, user, params }) => {
    const document = await prisma.employeeDocument.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { employee: { select: { userId: true, firstName: true, lastName: true } } },
    });
    if (!document) {
      return NextResponse.json({ error: { message: "Dokumen tidak ditemukan." } }, { status: 404 });
    }
    if (document.employee.userId !== user.id && !hasPermission(user.permissions, ["document.read", "*"])) {
      return NextResponse.json({ error: { message: "Akses ditolak." } }, { status: 403 });
    }

    const buffer = await readUpload(document.storageKey);
    const asciiName = document.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "document.downloaded",
      module: "dokumen",
      entityType: "EmployeeDocument",
      entityId: document.id,
      req,
    });

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(buffer.byteLength),
        "Content-Disposition": `attachment; filename="${asciiName}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
});
