import { prisma } from "@/lib/prisma";
import { ApiError, type SessionUser } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { decimalFromDb, Decimal, roundRupiah } from "@/lib/money";
import { computePayroll, type PayrollComputation } from "@/modules/payroll/engine";
import { parsePolicyConfig } from "@/modules/payroll/policy";
import { notifyUser } from "@/lib/notifications";

export type PayrollLine = { code: string; name: string; type: string; amount: string; taxable: boolean; statutory: boolean };

export async function getPayrollOverview(user: SessionUser, periodId?: string) {
  const canReadAll = hasPermission(user.permissions, "payroll.read");
  const canReadSelf = hasPermission(user.permissions, "payroll.read.self");

  const [periods, components, policies, myRecords] = await Promise.all([
    prisma.payrollPeriod.findMany({ where: { tenantId: user.tenantId }, orderBy: { startDate: "desc" }, take: 18 }),
    canReadAll ? prisma.payrollComponent.findMany({ where: { tenantId: user.tenantId }, orderBy: { sortOrder: "asc" } }) : Promise.resolve([]),
    canReadAll ? prisma.payrollPolicy.findMany({ where: { tenantId: user.tenantId }, orderBy: { version: "desc" } }) : Promise.resolve([]),
    canReadSelf && user.employeeId
      ? prisma.payrollRecord.findMany({
          where: { tenantId: user.tenantId, employeeId: user.employeeId },
          include: { period: true, payslip: true },
          orderBy: { createdAt: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
  ]);

  const selected =
    periods.find((period) => period.id === periodId) ??
    periods.find((p) => p.status !== "DRAFT") ??
    periods[0] ??
    null;

  const records = selected && canReadAll
    ? await prisma.payrollRecord.findMany({
        where: { periodId: selected.id, tenantId: user.tenantId },
        include: {
          employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
          payslip: { select: { id: true, number: true } },
        },
        orderBy: { employee: { firstName: "asc" } },
      })
    : [];

  return {
    periods: periods.map((period) => ({
      id: period.id,
      name: period.name,
      code: period.code,
      status: period.status,
      startDate: period.startDate,
      endDate: period.endDate,
      payDate: period.payDate,
      grossTotal: decimalFromDb(period.grossTotal).toFixed(2),
      deductionTotal: decimalFromDb(period.deductionTotal).toFixed(2),
      netTotal: decimalFromDb(period.netTotal).toFixed(2),
      employeeCount: period.employeeCount,
    })),
    selected: selected
      ? {
          id: selected.id,
          name: selected.name,
          code: selected.code,
          status: selected.status,
          startDate: selected.startDate,
          endDate: selected.endDate,
          payDate: selected.payDate,
          grossTotal: decimalFromDb(selected.grossTotal).toFixed(2),
          deductionTotal: decimalFromDb(selected.deductionTotal).toFixed(2),
          netTotal: decimalFromDb(selected.netTotal).toFixed(2),
          employeeCount: selected.employeeCount,
          processedAt: selected.processedAt,
          approvedAt: selected.approvedAt,
        }
      : null,
    records: records.map((record) => ({
      id: record.id,
      employeeId: record.employee.id,
      employeeName: `${record.employee.firstName} ${record.employee.lastName ?? ""}`.trim(),
      employeeCode: record.employee.employeeCode,
      department: record.employee.department?.name ?? null,
      basicSalary: decimalFromDb(record.basicSalary).toFixed(2),
      grossPay: decimalFromDb(record.grossPay).toFixed(2),
      totalDeductions: decimalFromDb(record.totalDeductions).toFixed(2),
      netPay: decimalFromDb(record.netPay).toFixed(2),
      overtimePay: decimalFromDb(record.overtimePay).toFixed(2),
      attendanceDays: record.attendanceDays,
      payslipId: record.payslip?.id ?? null,
      payslipNumber: record.payslip?.number ?? null,
      lines: ((record.items as { lines?: PayrollLine[] })?.lines ?? []) as PayrollLine[],
    })),
    components: components.map((component) => ({
      id: component.id,
      name: component.name,
      code: component.code,
      type: component.type,
      calculation: component.calculation,
      amount: decimalFromDb(component.amount).toFixed(2),
      isTaxable: component.isTaxable,
      isStatutory: component.isStatutory,
      description: component.description,
    })),
    policy: policies[0]
      ? {
          id: policies[0].id,
          name: policies[0].name,
          version: policies[0].version,
          effectiveFrom: policies[0].effectiveFrom,
          config: policies[0].config,
          notes: policies[0].notes,
        }
      : null,
    policyVersions: policies.map((policy) => ({ id: policy.id, version: policy.version, name: policy.name, effectiveFrom: policy.effectiveFrom, isActive: policy.isActive })),
    myRecords: myRecords.map((record) => ({
      id: record.id,
      period: record.period.name,
      payDate: record.period.payDate,
      netPay: decimalFromDb(record.netPay).toFixed(2),
      grossPay: decimalFromDb(record.grossPay).toFixed(2),
      payslipId: record.payslip?.id ?? null,
      status: record.status,
    })),
    permissions: {
      canManage: hasPermission(user.permissions, "payroll.manage"),
      canApprove: hasPermission(user.permissions, "payroll.approve"),
      canReadAll,
      canReadSelf,
    },
  };
}

export async function processPayroll(user: SessionUser, periodId: string) {
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, tenantId: user.tenantId } });
  if (!period) throw new ApiError(404, "Periode payroll tidak ditemukan.");
  if (period.status !== "DRAFT") throw new ApiError(409, "Hanya periode berstatus draf yang dapat diproses.");

  const policyRow = period.policyId
    ? await prisma.payrollPolicy.findFirst({ where: { id: period.policyId, tenantId: user.tenantId } })
    : await prisma.payrollPolicy.findFirst({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { version: "desc" } });
  if (!policyRow) throw new ApiError(422, "Kebijakan payroll belum tersedia. Konfigurasikan kebijakan terlebih dahulu.");
  const config = parsePolicyConfig(policyRow.config);

  const [employees, components, employeeComponents, attendance, unpaidLeaves] = await Promise.all([
    prisma.employee.findMany({
      where: { tenantId: user.tenantId, status: { in: ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"] } },
      select: { id: true, employeeCode: true, firstName: true, lastName: true, basicSalary: true },
      orderBy: { employeeCode: "asc" },
    }),
    prisma.payrollComponent.findMany({ where: { tenantId: user.tenantId, isActive: true } }),
    prisma.employeePayrollComponent.findMany({ where: { employee: { tenantId: user.tenantId } } }),
    prisma.attendanceRecord.findMany({
      where: { tenantId: user.tenantId, date: { gte: period.startDate, lte: period.endDate } },
      select: { employeeId: true, status: true, overtimeMinutes: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        tenantId: user.tenantId,
        status: "APPROVED",
        leaveType: { code: "UNPAID" },
        startDate: { lte: period.endDate },
        endDate: { gte: period.startDate },
      },
      select: { employeeId: true, days: true },
    }),
  ]);

  const attendanceByEmployee = new Map<string, { presentDays: number; overtimeMinutes: number }>();
  for (const record of attendance) {
    const entry = attendanceByEmployee.get(record.employeeId) ?? { presentDays: 0, overtimeMinutes: 0 };
    if (["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(record.status)) entry.presentDays += 1;
    entry.overtimeMinutes += record.overtimeMinutes;
    attendanceByEmployee.set(record.employeeId, entry);
  }
  const unpaidByEmployee = new Map<string, number>();
  for (const leave of unpaidLeaves) {
    unpaidByEmployee.set(leave.employeeId, (unpaidByEmployee.get(leave.employeeId) ?? 0) + decimalFromDb(leave.days).toNumber());
  }

  const componentById = new Map(components.map((component) => [component.id, component]));
  const computations: PayrollComputation[] = [];

  for (const employee of employees) {
    if (!employee.basicSalary) continue;
    const own = employeeComponents.filter((row) => row.employeeId === employee.id);
    const attendanceSummary = attendanceByEmployee.get(employee.id) ?? { presentDays: 0, overtimeMinutes: 0 };
    computations.push(
      computePayroll(
        {
          employeeId: employee.id,
          employeeCode: employee.employeeCode,
          employeeName: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
          basicSalary: employee.basicSalary.toString(),
          components: own
            .map((row) => {
              const component = componentById.get(row.componentId);
              if (!component) return null;
              return {
                component: {
                  code: component.code,
                  name: component.name,
                  type: component.type,
                  calculation: component.calculation,
                  amount: component.amount.toString(),
                  percent: component.percent?.toString() ?? null,
                  isTaxable: component.isTaxable,
                  isStatutory: component.isStatutory,
                },
                amount: row.amount.toString(),
              };
            })
            .filter(Boolean) as NonNullable<Parameters<typeof computePayroll>[0]["components"]>,
          attendance: {
            presentDays: attendanceSummary.presentDays,
            unpaidLeaveDays: unpaidByEmployee.get(employee.id) ?? 0,
            overtimeMinutes: attendanceSummary.overtimeMinutes,
          },
        },
        config,
      ),
    );
  }

  if (computations.length === 0) throw new ApiError(422, "Tidak ada karyawan aktif dengan gaji pokok untuk diproses.");

  let grossTotal = new Decimal(0);
  let deductionTotal = new Decimal(0);
  let netTotal = new Decimal(0);

  await prisma.$transaction(async (tx) => {
    await tx.payslip.deleteMany({ where: { payrollRecord: { periodId: period.id } } });
    await tx.payrollRecord.deleteMany({ where: { periodId: period.id } });

    for (const result of computations) {
      const record = await tx.payrollRecord.create({
        data: {
          tenantId: user.tenantId,
          periodId: period.id,
          employeeId: result.employeeId,
          basicSalary: new Decimal(result.basicSalary),
          grossPay: new Decimal(result.grossPay),
          taxableGross: new Decimal(result.taxableGross),
          totalDeductions: new Decimal(result.totalDeductions),
          netPay: new Decimal(result.netPay),
          overtimeHours: new Decimal(result.overtimeHours),
          overtimePay: new Decimal(result.overtimePay),
          attendanceDays: result.attendanceDays,
          unpaidLeaveDays: new Decimal(result.unpaidLeaveDays),
          items: { lines: result.lines, employerContributions: result.employerContributions } as object,
          status: "DRAFT",
        },
      });
      await tx.payslip.create({
        data: {
          payrollRecordId: record.id,
          number: `PS/${period.code.replace("PR-", "")}/${result.employeeCode}`,
          issuedAt: new Date(),
        },
      });
      grossTotal = grossTotal.plus(new Decimal(result.grossPay));
      deductionTotal = deductionTotal.plus(new Decimal(result.totalDeductions));
      netTotal = netTotal.plus(new Decimal(result.netPay));
    }

    await tx.payrollPeriod.update({
      where: { id: period.id },
      data: {
        status: "PENDING_APPROVAL",
        grossTotal: roundRupiah(grossTotal),
        deductionTotal: roundRupiah(deductionTotal),
        netTotal: roundRupiah(netTotal),
        employeeCount: computations.length,
        processedAt: new Date(),
        policyId: policyRow.id,
      },
    });
  });

  return { processed: computations.length, netTotal: netTotal.toFixed(2) };
}

export async function approvePayroll(user: SessionUser, periodId: string) {
  const period = await prisma.payrollPeriod.findFirst({ where: { id: periodId, tenantId: user.tenantId } });
  if (!period) throw new ApiError(404, "Periode payroll tidak ditemukan.");
  if (period.status !== "PENDING_APPROVAL") throw new ApiError(409, "Periode ini tidak menunggu persetujuan.");

  // Human approval only. AI has no path to this function.
  await prisma.$transaction([
    prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { status: "APPROVED", approvedAt: new Date(), approvedById: user.id },
    }),
    prisma.payrollRecord.updateMany({ where: { periodId: period.id }, data: { status: "FINAL" } }),
  ]);
  return { approved: true };
}

export async function markPayrollPaid(user: SessionUser, periodId: string) {
  const period = await prisma.payrollPeriod.findFirst({
    where: { id: periodId, tenantId: user.tenantId },
    include: { records: { select: { employeeId: true } } },
  });
  if (!period) throw new ApiError(404, "Periode payroll tidak ditemukan.");
  if (period.status !== "APPROVED") throw new ApiError(409, "Payroll harus disetujui sebelum ditandai dibayar.");

  await prisma.$transaction([
    prisma.payrollPeriod.update({ where: { id: period.id }, data: { status: "PAID", paidAt: new Date() } }),
    prisma.payrollRecord.updateMany({ where: { periodId: period.id }, data: { status: "PAID" } }),
  ]);

  for (const record of period.records) {
    await notifyUser({
      tenantId: user.tenantId,
      employeeId: record.employeeId,
      type: "INFO",
      title: "Slip gaji tersedia",
      body: `Payroll ${period.name} telah dibayarkan. Unduh slip gaji Anda.`,
      href: "/payroll",
    });
  }
  return { paid: true, notified: period.records.length };
}

export async function getPayslip(user: SessionUser, recordId: string) {
  const record = await prisma.payrollRecord.findFirst({
    where: { id: recordId, tenantId: user.tenantId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          userId: true,
          department: { select: { name: true } },
          position: { select: { title: true } },
        },
      },
      period: true,
      payslip: true,
    },
  });
  if (!record) throw new ApiError(404, "Slip gaji tidak ditemukan.");

  const isSelf = record.employee.userId === user.id;
  if (!isSelf && !hasPermission(user.permissions, ["payroll.read", "payroll.approve"])) {
    throw new ApiError(403, "Anda tidak memiliki izin melihat slip gaji ini.");
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: user.tenantId }, select: { name: true, legalName: true, logoUrl: true } });
  const items = record.items as { lines?: PayrollLine[]; employerContributions?: { code: string; name: string; amount: string }[] };

  return {
    id: record.id,
    number: record.payslip?.number ?? `PS/${record.period.code}/${record.employee.employeeCode}`,
    period: { name: record.period.name, startDate: record.period.startDate, endDate: record.period.endDate, payDate: record.period.payDate, status: record.period.status },
    employee: {
      name: `${record.employee.firstName} ${record.employee.lastName ?? ""}`.trim(),
      employeeCode: record.employee.employeeCode,
      department: record.employee.department?.name ?? "—",
      position: record.employee.position?.title ?? "—",
    },
    company: { name: tenant?.legalName ?? tenant?.name ?? "—" },
    basicSalary: decimalFromDb(record.basicSalary).toFixed(2),
    grossPay: decimalFromDb(record.grossPay).toFixed(2),
    totalDeductions: decimalFromDb(record.totalDeductions).toFixed(2),
    netPay: decimalFromDb(record.netPay).toFixed(2),
    taxableGross: decimalFromDb(record.taxableGross).toFixed(2),
    overtimeHours: decimalFromDb(record.overtimeHours).toFixed(2),
    attendanceDays: record.attendanceDays,
    lines: items.lines ?? [],
    employerContributions: items.employerContributions ?? [],
    issuedAt: record.payslip?.issuedAt ?? record.createdAt,
  };
}
