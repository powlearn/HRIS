import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { Decimal } from "@/lib/money";

const schema = z.object({
  kind: z.enum(["self", "manager"]),
  selfAssessment: z.string().trim().max(4000).optional(),
  selfScore: z.coerce.number().min(1).max(5).optional(),
  managerAssessment: z.string().trim().max(4000).optional(),
  managerScore: z.coerce.number().min(1).max(5).optional(),
  strengths: z.string().trim().max(1000).optional(),
  improvements: z.string().trim().max(1000).optional(),
  rating: z.enum(["BELOW_EXPECTATIONS", "MEETS_EXPECTATIONS", "EXCEEDS_EXPECTATIONS", "OUTSTANDING"]).optional(),
});

export const PATCH = apiRoute<{ id: string }>({
  handler: async ({ req, user, params }) => {
    const input = schema.parse(await readJson(req));
    const review = await prisma.performanceReview.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { employee: { select: { userId: true, id: true } } },
    });
    if (!review) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(404, "Penilaian tidak ditemukan.");
    }

    if (input.kind === "self") {
      if (!hasPermission(user.permissions, "performance.review.self") || review.employee.userId !== user.id) {
        const { ApiError } = await import("@/lib/api");
        throw new ApiError(403, "Anda hanya dapat mengisi penilaian diri sendiri.");
      }
      const updated = await prisma.performanceReview.update({
        where: { id: review.id },
        data: {
          selfAssessment: input.selfAssessment,
          selfScore: input.selfScore !== undefined ? new Decimal(input.selfScore) : undefined,
          status: review.status === "DRAFT" ? "SELF_ASSESSED" : undefined,
        },
      });
      await writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.name,
        action: "performance.self_assessment_submitted",
        module: "kinerja",
        entityType: "PerformanceReview",
        entityId: review.id,
        req,
      });
      return { id: updated.id, status: updated.status };
    }

    if (!hasPermission(user.permissions, "performance.manage") && !hasPermission(user.permissions, "*")) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(403, "Anda tidak memiliki izin menilai karyawan.");
    }

    const finalScore = input.managerScore !== undefined ? new Decimal(input.managerScore) : review.finalScore;
    const complete = input.managerScore !== undefined && Boolean(input.managerAssessment);
    const updated = await prisma.performanceReview.update({
      where: { id: review.id },
      data: {
        managerAssessment: input.managerAssessment,
        managerScore: input.managerScore !== undefined ? new Decimal(input.managerScore) : undefined,
        strengths: input.strengths,
        improvements: input.improvements,
        rating: input.rating,
        finalScore: finalScore ?? undefined,
        status: complete ? "COMPLETED" : "MANAGER_REVIEW",
        completedAt: complete ? new Date() : undefined,
      },
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "performance.review_updated",
      module: "kinerja",
      entityType: "PerformanceReview",
      entityId: review.id,
      metadata: { completed: complete },
      req,
    });

    return { id: updated.id, status: updated.status };
  },
});
