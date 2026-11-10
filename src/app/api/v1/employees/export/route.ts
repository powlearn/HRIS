import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import { listEmployees } from "@/modules/employees/service";
import { toCsv } from "@/lib/validation";
import { EMPLOYEE_STATUS } from "@/lib/design";
import { formatDate } from "@/lib/time";
import { formatIDR } from "@/lib/money";

export const GET = apiRoute({
  permission: "employee.export",
  handler: async ({ req, user }) => {
    const params = req.nextUrl.searchParams;
    const all: Awaited<ReturnType<typeof listEmployees>>["employees"] = [];
    let page = 1;
    for (;;) {
      const result = await listEmployees(user, {
        search: params.get("search") ?? undefined,
        status: params.get("status") ?? undefined,
        departmentId: params.get("departmentId") ?? undefined,
        locationId: params.get("locationId") ?? undefined,
        page,
        pageSize: 100,
      });
      all.push(...result.employees);
      if (page >= result.pageCount) break;
      page += 1;
    }

    const canSeeSalary = hasPermission(user.permissions, ["employee.sensitive.read", "payroll.read"]);
    const csv = toCsv(
      ["ID Karyawan", "Nama", "Email", "Telepon", "Departemen", "Jabatan", "Lokasi", "Atasan", "Status", "Tanggal Bergabung", "Gaji Pokok"],
      all.map((employee) => [
        employee.employeeCode,
        employee.name,
        employee.email,
        employee.phone ?? "",
        employee.department ?? "",
        employee.position ?? "",
        employee.location ?? "",
        employee.manager ?? "",
        EMPLOYEE_STATUS[employee.status]?.label ?? employee.status,
        formatDate(employee.hireDate),
        canSeeSalary && employee.basicSalary !== null ? formatIDR(employee.basicSalary) : "—",
      ]),
    );

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "employee.exported",
      module: "karyawan",
      entityType: "Employee",
      metadata: { rows: all.length },
      req,
    });

    const filename = `nexahr-karyawan-${new Date().toISOString().slice(0, 10)}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  },
});
