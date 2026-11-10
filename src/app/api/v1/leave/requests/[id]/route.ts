import { z } from "zod";
import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { cancelLeaveRequest, decideLeaveRequest } from "@/modules/leave/service";

const schema = z.object({
  action: z.enum(["approve", "reject", "cancel"]),
  comment: z.string().trim().max(500).optional(),
});

export const PATCH = apiRoute<{ id: string }>({
  permission: ["leave.approve", "leave.request"],
  handler: async ({ req, user, params }) => {
    const input = schema.parse(await readJson(req));

    if (input.action === "cancel") {
      const result = await cancelLeaveRequest(user, params.id);
      await writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.name,
        action: "leave.cancelled",
        module: "cuti",
        entityType: "LeaveRequest",
        entityId: params.id,
        req,
      });
      return result;
    }

    if (!user.permissions.includes("*") && !user.permissions.includes("leave.approve")) {
      const { ApiError } = await import("@/lib/api");
      throw new ApiError(403, "Anda tidak memiliki izin menyetujui cuti.");
    }

    const decision = input.action === "approve" ? "APPROVED" : "REJECTED";
    const result = await decideLeaveRequest(user, params.id, decision, input.comment);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: decision === "APPROVED" ? "leave.approved" : "leave.rejected",
      module: "cuti",
      entityType: "LeaveRequest",
      entityId: params.id,
      metadata: { final: result.final },
      req,
    });
    return result;
  },
});
