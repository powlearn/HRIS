import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { employeeUpdateSchema } from "@/modules/employees/schema";
import { getEmployeeDetail, updateEmployee } from "@/modules/employees/service";

export const GET = apiRoute<{ id: string }>({
  permission: ["employee.read", "employee.read.team"],
  handler: async ({ user, params }) => getEmployeeDetail(user, params.id),
});

export const PATCH = apiRoute<{ id: string }>({
  permission: "employee.update",
  handler: async ({ req, user, params }) => {
    const body = await readJson<Record<string, unknown>>(req);
    const input = employeeUpdateSchema.parse({ ...body, id: params.id });
    const employee = await updateEmployee(user, input);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "employee.updated",
      module: "karyawan",
      entityType: "Employee",
      entityId: employee.id,
      metadata: { fields: Object.keys(input).filter((key) => key !== "id") },
      req,
    });
    return { id: employee.id };
  },
});
