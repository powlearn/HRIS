import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";

export const GET = apiRoute({
  handler: async ({ req, tenantId, user }) => {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
    if (q.length < 2) return { employees: [] };
    if (!hasPermission(user.permissions, ["employee.read", "employee.read.team"])) return { employees: [] };

    const employees = await prisma.employee.findMany({
      where: {
        tenantId,
        AND: [
          {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          },
          hasPermission(user.permissions, "employee.read")
            ? {}
            : { OR: [{ managerId: user.employeeId ?? "__none__" }, { id: user.employeeId ?? "__none__" }] },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: { select: { name: true } },
        position: { select: { title: true } },
      },
      take: 6,
      orderBy: { firstName: "asc" },
    });

    return {
      employees: employees.map((employee) => ({
        id: employee.id,
        name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
        employeeCode: employee.employeeCode,
        department: employee.department?.name ?? null,
        position: employee.position?.title ?? null,
      })),
    };
  },
});
