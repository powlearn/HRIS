"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Download, Plus, SlidersHorizontal } from "lucide-react";
import { DataTable } from "@/components/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/ui/primitives";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { EMPLOYEE_STATUS } from "@/lib/design";
import { formatCompactIDR, formatIDR } from "@/lib/money";

export type EmployeeRow = {
  id: string;
  employeeCode: string;
  name: string;
  email: string;
  phone: string | null;
  status: string;
  department: string | null;
  departmentId: string | null;
  position: string | null;
  location: string | null;
  manager: string | null;
  hireDate: string;
  basicSalary: number | null;
};

export function EmployeeTable({
  employees,
  departments,
  canCreate,
  canExport,
  canEdit,
}: {
  employees: EmployeeRow[];
  departments: { id: string; name: string }[];
  canCreate: boolean;
  canExport: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState("all");
  const [departmentId, setDepartmentId] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);

  const filtered = React.useMemo(
    () =>
      employees.filter((employee) => {
        if (status !== "all" && employee.status !== status) return false;
        if (departmentId !== "all" && employee.departmentId !== departmentId) return false;
        return true;
      }),
    [employees, status, departmentId],
  );

  const columns = React.useMemo<ColumnDef<EmployeeRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Karyawan",
        accessorFn: (row) => `${row.name} ${row.employeeCode} ${row.email}`,
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <PersonAvatar name={row.original.name} className="size-8" />
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight">{row.original.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {row.original.employeeCode} · {row.original.email}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "position",
        header: "Jabatan",
        accessorFn: (row) => row.position ?? "",
        cell: ({ row }) => (
          <div>
            <p className="text-[12px] font-medium">{row.original.position ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">{row.original.department ?? "—"}</p>
          </div>
        ),
      },
      {
        accessorKey: "location",
        header: "Lokasi",
        cell: ({ row }) => <span className="text-[12px] text-muted-foreground">{row.original.location ?? "—"}</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const meta = EMPLOYEE_STATUS[row.original.status];
          return <Badge variant={meta?.tone ?? "neutral"} dot>{meta?.label ?? row.original.status}</Badge>;
        },
      },
      {
        accessorKey: "basicSalary",
        header: "Gaji pokok",
        cell: ({ row }) => (
          <span className="numeric text-[12px]" title={row.original.basicSalary !== null ? formatIDR(row.original.basicSalary) : undefined}>
            {row.original.basicSalary !== null ? formatCompactIDR(row.original.basicSalary) : <span className="text-muted-foreground">Terbatas</span>}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <>
      <DataTable
        columns={columns}
        data={filtered}
        searchPlaceholder="Cari nama, ID, jabatan, email…"
        onRowClick={(row) => router.push(`/employees/${row.id}`)}
        pageSize={12}
        toolbar={
          <>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-8 w-[142px] text-[12px]">
                <SelectValue placeholder="Semua status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                {Object.entries(EMPLOYEE_STATUS).map(([value, meta]) => (
                  <SelectItem key={value} value={value}>
                    {meta.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="h-8 w-[188px] text-[12px]">
                <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                <SelectValue placeholder="Departemen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua departemen</SelectItem>
                {departments.map((department) => (
                  <SelectItem key={department.id} value={department.id}>
                    {department.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canExport ? (
              <Button asChild variant="outline" size="sm">
                <a href="/api/v1/employees/export" download>
                  <Download className="size-3.5" /> Ekspor
                </a>
              </Button>
            ) : null}
            {canCreate ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-3.5" /> Karyawan
              </Button>
            ) : null}
          </>
        }
      />
      {canCreate ? (
        <EmployeeFormDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          mode="create"
          onSaved={() => router.refresh()}
        />
      ) : null}
      {canEdit ? null : null}
    </>
  );
}
