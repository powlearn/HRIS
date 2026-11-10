import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { requestCorrection } from "@/modules/attendance/service";
import { dateKeySchema } from "@/lib/validation";

const schema = z.object({
  date: dateKeySchema,
  requestedClockIn: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  requestedClockOut: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter").max(500),
});

export const POST = apiRoute({
  permission: "attendance.clock",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    if (!input.requestedClockIn && !input.requestedClockOut) {
      throw new (await import("@/lib/api")).ApiError(422, "Isi minimal salah satu jam clock-in atau clock-out yang benar.");
    }
    const correction = await requestCorrection(user, input);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "attendance.correction_requested",
      module: "kehadiran",
      entityType: "AttendanceCorrection",
      entityId: correction.id,
      metadata: { date: input.date },
      req,
    });
    return { id: correction.id };
  },
});
