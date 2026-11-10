import { apiRoute } from "@/lib/api";
import { getEmployeeDirectoryOptions } from "@/modules/employees/service";

export const GET = apiRoute({
  permission: ["employee.read", "employee.create"],
  handler: async ({ user }) => getEmployeeDirectoryOptions(user.tenantId),
});
