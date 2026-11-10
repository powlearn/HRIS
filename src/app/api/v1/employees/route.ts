import { apiRoute, readJson } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { employeeCreateSchema } from "@/modules/employees/schema";
import { createEmployee, listEmployees } from "@/modules/employees/service";

export const GET = apiRoute({
  permission: ["employee.read", "employee.read.team"],
  handler: async ({ req, user }) => {
    const params = req.nextUrl.searchParams;
    return listEmployees(user, {
      search: params.get("search") ?? undefined,
      status: params.get("status") ?? undefined,
      departmentId: params.get("departmentId") ?? undefined,
      locationId: params.get("locationId") ?? undefined,
      page: Number(params.get("page") ?? 1),
      pageSize: Number(params.get("pageSize") ?? 20),
    });
  },
});

export const POST = apiRoute({
  permission: "employee.create",
  handler: async ({ req, user }) => {
    const input = employeeCreateSchema.parse(await readJson(req));
    const employee = await createEmployee(user, input);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "employee.created",
      module: "karyawan",
      entityType: "Employee",
      entityId: employee.id,
      metadata: { employeeCode: employee.employeeCode, departmentId: employee.departmentId },
      req,
    });
    return { id: employee.id, employeeCode: employee.employeeCode };
  },
});
