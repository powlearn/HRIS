import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { clockIn } from "@/modules/attendance/service";

const schema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  accuracyMeters: z.number().min(0).max(100000).optional(),
  notes: z.string().max(500).optional(),
});

export const POST = apiRoute({
  permission: "attendance.clock",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const record = await clockIn(user, input);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "attendance.clock_in",
      module: "kehadiran",
      entityType: "AttendanceRecord",
      entityId: record.id,
      metadata: { lateMinutes: record.lateMinutes, geofencePassed: record.geofencePassed, source: "WEB" },
      req,
    });
    return { record };
  },
});
