import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const schema = z.object({ isCompleted: z.boolean() });

export const PATCH = apiRoute<{ id: string }>({
  permission: "recruitment.manage",
  handler: async ({ req, user, params }) => {
    const input = schema.parse(await readJson(req));
    const task = await prisma.onboardingTask.findFirst({ where: { id: params.id, tenantId: user.tenantId } });
    if (!task) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(404, "Tugas onboarding tidak ditemukan.");
    }
    return prisma.onboardingTask.update({
      where: { id: task.id },
      data: { isCompleted: input.isCompleted, completedAt: input.isCompleted ? new Date() : null },
    });
  },
});
