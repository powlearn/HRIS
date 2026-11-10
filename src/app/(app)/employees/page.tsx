import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { EmployeeTable } from "@/components/employees/employee-table";
import { EmptyState } from "@/components/empty-state";
import { getSessionUser } from "@/lib/api";
import { getEmployeeDirectoryOptions, listEmployees } from "@/modules/employees/service";
import { hasPermission } from "@/lib/rbac";

export const metadata: Metadata = { title: "Karyawan" };
export const dynamic = "force-dynamic";

export default async function EmployeesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasPermission(user.permissions, ["employee.read", "employee.read.team"])) redirect("/dashboard");

  const [directory, list] = await Promise.all([
    getEmployeeDirectoryOptions(user.tenantId),
    listEmployees(user, { pageSize: 100 }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenaga Kerja"
        title="Direktori karyawan"
        description={`${list.total} karyawan terdaftar pada tenant ${user.tenantName}. Data sensitif ditampilkan sesuai izin peran Anda.`}
        actions={
          <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
            <Users className="size-4" /> {list.employees.filter((employee) => employee.status !== "RESIGNED" && employee.status !== "TERMINATED").length} aktif
          </div>
        }
      />

      {list.employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada karyawan"
          description="Tambahkan karyawan pertama untuk mulai mengelola kehadiran, cuti, dan payroll."
        />
      ) : (
        <EmployeeTable
          employees={list.employees.map((employee) => ({ ...employee, hireDate: employee.hireDate.toISOString() }))}
          departments={directory.departments}
          canCreate={hasPermission(user.permissions, "employee.create")}
          canExport={hasPermission(user.permissions, "employee.export")}
          canEdit={hasPermission(user.permissions, "employee.update")}
        />
      )}
    </div>
  );
}
