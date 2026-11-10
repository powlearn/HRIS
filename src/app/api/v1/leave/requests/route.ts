import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { submitLeaveRequest } from "@/modules/leave/service";
import { dateKeySchema } from "@/lib/validation";

const schema = z.object({
  leaveTypeId: z.string().min(1, "Pilih jenis cuti"),
  startDate: dateKeySchema,
  endDate: dateKeySchema,
  reason: z.string().trim().min(10, "Alasan minimal 10 karakter").max(500),
  attachmentKey: z.string().max(300).optional(),
});

export const POST = apiRoute({
  permission: "leave.request",
  handler: async ({ req, user }) => {
    const input = schema.parse(await readJson(req));
    const request = await submitLeaveRequest(user, input);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "leave.submitted",
      module: "cuti",
      entityType: "LeaveRequest",
      entityId: request.id,
      metadata: { requestNumber: request.requestNumber, days: request.days.toString() },
      req,
    });
    return { id: request.id, requestNumber: request.requestNumber };
  },
});
