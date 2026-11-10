import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS } from "@/lib/rbac";

const schema = z.object({
  permissionKeys: z.array(z.string()).max(200),
});

export const PATCH = apiRoute<{ id: string }>({
  permission: "role.manage",
  handler: async ({ req, user, params }) => {
    const input = schema.parse(await readJson(req));
    const role = await prisma.role.findFirst({ where: { id: params.id, tenantId: user.tenantId } });
    if (!role) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(404, "Peran tidak ditemukan atau merupakan peran sistem platform.");
    }
    if (role.slug === "super_admin") {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(403, "Peran Super Admin dikelola di tingkat platform.");
    }

    const validKeys = new Set(PERMISSIONS.map((permission) => permission.key));
    const keys = [...new Set(input.permissionKeys)].filter((key) => validKeys.has(key as never));
    const permissions = await prisma.permission.findMany({ where: { key: { in: keys } } });

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
      prisma.rolePermission.createMany({ data: permissions.map((permission) => ({ roleId: role.id, permissionId: permission.id })) }),
    ]);

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "role.permissions_updated",
      module: "pengaturan",
      entityType: "Role",
      entityId: role.id,
      metadata: { role: role.slug, count: permissions.length },
      req,
    });

    return { id: role.id, permissions: permissions.map((permission) => permission.key) };
  },
});
