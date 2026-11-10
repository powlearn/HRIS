import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { deleteUpload } from "@/lib/storage";

export const DELETE = apiRoute<{ id: string }>({
  permission: "document.manage",
  handler: async ({ req, user, params }) => {
    const document = await prisma.employeeDocument.findFirst({ where: { id: params.id, tenantId: user.tenantId } });
    if (!document) return NextResponse.json({ error: { message: "Dokumen tidak ditemukan." } }, { status: 404 });

    await prisma.employeeDocument.delete({ where: { id: document.id } });
    await deleteUpload(document.storageKey);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "document.deleted",
      module: "dokumen",
      entityType: "EmployeeDocument",
      entityId: document.id,
      metadata: { employeeId: document.employeeId, type: document.type },
      req,
    });
    return { deleted: true };
  },
});
