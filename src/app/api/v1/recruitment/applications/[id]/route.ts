import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { notifyRole } from "@/lib/notifications";

const schema = z.object({
  stage: z.enum(["APPLIED", "SCREENING", "INTERVIEW", "ASSESSMENT", "OFFERING", "HIRED", "REJECTED"]).optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const PATCH = apiRoute<{ id: string }>({
  permission: "recruitment.manage",
  handler: async ({ req, user, params }) => {
    const input = schema.parse(await readJson(req));
    const existing = await prisma.recruitmentApplication.findFirst({
      where: { id: params.id, tenantId: user.tenantId },
      include: { vacancy: { select: { title: true } } },
    });
    if (!existing) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(404, "Pelamar tidak ditemukan.");
    }

    const updated = await prisma.recruitmentApplication.update({
      where: { id: existing.id },
      data: {
        stage: input.stage ?? undefined,
        rating: input.rating ?? undefined,
        notes: input.notes ?? undefined,
      },
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "recruitment.stage_changed",
      module: "rekrutmen",
      entityType: "RecruitmentApplication",
      entityId: updated.id,
      metadata: { from: existing.stage, to: updated.stage, vacancy: existing.vacancy.title },
      req,
    });

    if (input.stage === "HIRED") {
      await notifyRole(user.tenantId, "hr_manager", {
        type: "INFO",
        title: `Kandidat diterima: ${updated.candidateName}`,
        body: `Posisi ${existing.vacancy.title}. Lanjutkan proses penawaran dan onboarding.`,
        href: "/recruitment",
      });
    }

    return { id: updated.id, stage: updated.stage };
  },
});
