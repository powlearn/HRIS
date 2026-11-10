import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(80),
  code: z.string().trim().min(2, "Kode minimal 2 karakter").max(10).regex(/^[A-Z0-9-]+$/, "Kode hanya huruf kapital, angka, dan tanda hubung"),
  description: z.string().trim().max(300).optional(),
});

export const POST = apiRoute({
  permission: "org.manage",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const department = await prisma.department.create({
      data: { tenantId: user.tenantId, name: input.name, code: input.code, description: input.description },
    });
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "organization.department_created",
      module: "organisasi",
      entityType: "Department",
      entityId: department.id,
      metadata: { name: department.name, code: department.code },
      req,
    });
    return { id: department.id };
  },
});
