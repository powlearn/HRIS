import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { payrollPolicyConfigSchema } from "@/modules/payroll/policy";
import { dateOnly } from "@/lib/time";

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(500).optional(),
  config: payrollPolicyConfigSchema,
});

export const POST = apiRoute({
  permission: "payroll.manage",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const latest = await prisma.payrollPolicy.findFirst({
      where: { tenantId: user.tenantId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;

    const policy = await prisma.$transaction(async (tx) => {
      await tx.payrollPolicy.updateMany({ where: { tenantId: user.tenantId, isActive: true }, data: { isActive: false } });
      return tx.payrollPolicy.create({
        data: {
          tenantId: user.tenantId,
          name: input.name,
          version,
          effectiveFrom: dateOnly(input.effectiveFrom),
          isActive: true,
          notes: input.notes,
          config: input.config as object,
        },
      });
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "payroll.policy_updated",
      module: "payroll",
      entityType: "PayrollPolicy",
      entityId: policy.id,
      metadata: { version, name: input.name },
      req,
    });

    return { id: policy.id, version };
  },
});
