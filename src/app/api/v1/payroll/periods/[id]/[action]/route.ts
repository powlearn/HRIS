import { apiRoute } from "@/lib/api";
import { writeAudit } from "@/lib/audit";
import { approvePayroll, markPayrollPaid, processPayroll } from "@/modules/payroll/service";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toCsv } from "@/lib/validation";
import { formatIDR } from "@/lib/money";
import { formatDate } from "@/lib/time";

export const POST = apiRoute<{ id: string; action: string }>({
  permission: "payroll.manage",
  handler: async ({ req, user, params }) => {
    if (params.action === "process") {
      const result = await processPayroll(user, params.id);
      await writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.name,
        action: "payroll.processed",
        module: "payroll",
        entityType: "PayrollPeriod",
        entityId: params.id,
        metadata: { employees: result.processed, netTotal: result.netTotal },
        req,
      });
      return result;
    }

    if (params.action === "approve") {
      const result = await approvePayroll(user, params.id);
      await writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.name,
        action: "payroll.approved",
        module: "payroll",
        entityType: "PayrollPeriod",
        entityId: params.id,
        req,
      });
      return result;
    }

    if (params.action === "mark-paid") {
      const result = await markPayrollPaid(user, params.id);
      await writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.name,
        action: "payroll.paid",
        module: "payroll",
        entityType: "PayrollPeriod",
        entityId: params.id,
        metadata: { notified: result.notified },
        req,
      });
      return result;
    }

    if (params.action === "export") {
      const period = await prisma.payrollPeriod.findFirst({
        where: { id: params.id, tenantId: user.tenantId },
        include: {
          records: {
            include: {
              employee: { select: { employeeCode: true, firstName: true, lastName: true, department: { select: { name: true } } } },
              payslip: { select: { number: true } },
            },
            orderBy: { employee: { employeeCode: "asc" } },
          },
        },
      });
      if (!period) return NextResponse.json({ error: { message: "Periode tidak ditemukan." } }, { status: 404 });

      const csv = toCsv(
        ["Periode", "ID Karyawan", "Nama", "Departemen", "Gaji Pokok", "Bruto", "Potongan", "Gaji Bersih", "Hari Hadir", "Nomor Slip"],
        period.records.map((record) => [
          period.name,
          record.employee.employeeCode,
          `${record.employee.firstName} ${record.employee.lastName ?? ""}`.trim(),
          record.employee.department?.name ?? "",
          formatIDR(record.basicSalary),
          formatIDR(record.grossPay),
          formatIDR(record.totalDeductions),
          formatIDR(record.netPay),
          record.attendanceDays,
          record.payslip?.number ?? "",
        ]),
      );

      await writeAudit({
        tenantId: user.tenantId,
        actorId: user.id,
        actorName: user.name,
        action: "payroll.exported",
        module: "payroll",
        entityType: "PayrollPeriod",
        entityId: period.id,
        metadata: { rows: period.records.length, payDate: formatDate(period.payDate) },
        req,
      });

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="payroll-${period.code}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ error: { message: "Aksi tidak dikenal." } }, { status: 400 });
  },
});

// Approving payroll requires the dedicated approval permission.
export const PATCH = apiRoute<{ id: string; action: string }>({
  permission: "payroll.approve",
  handler: async ({ req, user, params }) => {
    if (params.action !== "approve") {
      return NextResponse.json({ error: { message: "Aksi tidak dikenal." } }, { status: 400 });
    }
    const result = await approvePayroll(user, params.id);
    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "payroll.approved",
      module: "payroll",
      entityType: "PayrollPeriod",
      entityId: params.id,
      req,
    });
    return result;
  },
});
