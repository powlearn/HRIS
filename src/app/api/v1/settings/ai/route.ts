import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  enabled: z.boolean(),
  allowConfidentialData: z.boolean(),
  model: z.string().trim().max(80).optional(),
});

export const PATCH = apiRoute({
  permission: "ai.configure",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const existing = await prisma.systemSetting.findUnique({
      where: { tenantId_key: { tenantId: user.tenantId, key: "ai.config" } },
    });
    const previous = (existing?.value ?? {}) as Record<string, unknown>;
    const value = {
      ...previous,
      enabled: input.enabled,
      allowConfidentialData: input.allowConfidentialData,
      model: input.model ?? previous.model ?? "gpt-4o-mini",
      provider: "openai-compatible",
      updatedAt: new Date().toISOString(),
    };

    await prisma.systemSetting.upsert({
      where: { tenantId_key: { tenantId: user.tenantId, key: "ai.config" } },
      update: { value },
      create: { tenantId: user.tenantId, key: "ai.config", category: "ai", value },
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "ai.configuration_updated",
      module: "ai",
      entityType: "SystemSetting",
      entityId: "ai.config",
      metadata: { enabled: input.enabled, allowConfidentialData: input.allowConfidentialData },
      req,
    });

    return { updated: true };
  },
});
