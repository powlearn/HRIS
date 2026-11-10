import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { applyCorrection } from "@/modules/attendance/service";

const schema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
  reviewNote: z.string().trim().max(500).optional(),
});

export const PATCH = apiRoute<{ id: string }>({
  permission: "attendance.correction.approve",
  handler: async ({ req, user, params }) => {
    const input = schema.parse(await readJson(req));
    const correction = await applyCorrection(user, params.id, input.status, input.reviewNote);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: input.status === "APPROVED" ? "attendance.correction_approved" : "attendance.correction_rejected",
      module: "kehadiran",
      entityType: "AttendanceCorrection",
      entityId: correction.id,
      metadata: { status: input.status },
      req,
    });

    await import("@/lib/notifications").then(({ notifyUser }) =>
      notifyUser({
        tenantId: user.tenantId,
        employeeId: correction.employeeId,
        type: "INFO",
        title: input.status === "APPROVED" ? "Koreksi kehadiran disetujui" : "Koreksi kehadiran ditolak",
        body: input.reviewNote ?? undefined,
        href: "/attendance",
      }),
    );

    return { id: correction.id, status: correction.status };
  },
});
