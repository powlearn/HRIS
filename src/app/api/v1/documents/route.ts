import { z } from "zod";
import { apiRoute } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { saveUpload } from "@/lib/storage";

const typeSchema = z.enum(["KTP", "NPWP", "KARTU_KELUARGA", "IJAZAH", "KONTRAK", "SERTIFIKAT", "BPJS", "LAINNYA"]);

export const POST = apiRoute({
  permission: "document.manage",
  handler: async ({ req, user }) => {
    const form = await req.formData();
    const file = form.get("file");
    const employeeId = String(form.get("employeeId") ?? "");
    const name = String(form.get("name") ?? "").trim();
    const type = typeSchema.parse(String(form.get("type") ?? "LAINNYA"));

    if (!(file instanceof File)) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(422, "Berkas wajib diunggah.");
    }
    const employee = await prisma.employee.findFirst({ where: { id: employeeId, tenantId: user.tenantId } });
    if (!employee) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(404, "Karyawan tidak ditemukan pada tenant ini.");
    }

    const stored = await saveUpload(file, user.tenantId);
    const document = await prisma.employeeDocument.create({
      data: {
        tenantId: user.tenantId,
        employeeId: employee.id,
        type,
        name: name || stored.fileName,
        fileName: stored.fileName,
        storageKey: stored.storageKey,
        mimeType: stored.mimeType,
        sizeBytes: stored.sizeBytes,
        uploadedById: user.id,
      },
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "document.uploaded",
      module: "dokumen",
      entityType: "EmployeeDocument",
      entityId: document.id,
      metadata: { employeeId: employee.id, type, sizeBytes: stored.sizeBytes },
      req,
    });

    return { id: document.id };
  },
});
