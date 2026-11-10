import type { EmployeeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const ACTIVE_EMPLOYEE_STATUSES: EmployeeStatus[] = ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"];
import { dateOnly, dateKey, monthRange, MONTH_NAMES_ID } from "@/lib/time";
import { decimalFromDb } from "@/lib/money";
import { hasPermission } from "@/lib/rbac";
import type { SessionUser } from "@/lib/api";

export type DashboardFilters = {
  month: number;
  year: number;
  departmentId?: string;
  locationId?: string;
};

function employeeScope(filters: DashboardFilters) {
  return {
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
  };
}

export async function getDashboardData(user: SessionUser, filters: DashboardFilters) {
  const tenantId = user.tenantId;
  const today = dateOnly(dateKey(new Date(), user.timezone));
  const { start, end } = monthRange(filters.year, filters.month);
  const scope = employeeScope(filters);
  const employeeFilter = {
    tenantId,
    ...scope,
    status: { in: ACTIVE_EMPLOYEE_STATUSES },
  };

  const sixMonthsAgo = new Date(Date.UTC(filters.year, filters.month - 6, 1));
  const canReadOrg = hasPermission(user.permissions, ["employee.read", "employee.read.team"]);

  const [
    headcount,
    presentToday,
    lateToday,
    absentToday,
    onLeaveRecords,
    newHiresThisMonth,
    resignedThisMonth,
    departments,
    locations,
    pendingLeave,
    pendingCorrections,
    latestPayroll,
    attendanceTrendRaw,
    departmentDistribution,
    recentActivity,
    payrollPeriods,
    leavers,
    joiners,
    contractExpiring,
    birthdayPeople,
  ] = await Promise.all([
    prisma.employee.count({ where: employeeFilter }),
    prisma.attendanceRecord.count({
      where: { tenantId, date: today, status: { in: ["PRESENT", "LATE", "REMOTE", "HALF_DAY"] }, employee: employeeFilter },
    }),
    prisma.attendanceRecord.count({ where: { tenantId, date: today, status: "LATE", employee: employeeFilter } }),
    prisma.attendanceRecord.count({ where: { tenantId, date: today, status: "ABSENT", employee: employeeFilter } }),
    prisma.attendanceRecord.count({ where: { tenantId, date: today, status: "ON_LEAVE", employee: employeeFilter } }),
    prisma.employee.count({ where: { ...employeeFilter, hireDate: { gte: start, lte: end } } }),
    prisma.employee.count({ where: { ...employeeFilter, resignDate: { gte: start, lte: end } } }),
    prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workLocation.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.leaveRequest.count({
      where: { tenantId, status: { in: ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW"] } },
    }),
    prisma.attendanceCorrection.count({ where: { tenantId, status: "PENDING" } }),
    prisma.payrollPeriod.findFirst({
      where: { tenantId, status: { not: "DRAFT" } },
      orderBy: { startDate: "desc" },
    }).then(async (period) => period ?? prisma.payrollPeriod.findFirst({ where: { tenantId }, orderBy: { startDate: "desc" } })),
    prisma.attendanceRecord.groupBy({
      by: ["date", "status"],
      where: { tenantId, date: { gte: start, lte: end }, employee: employeeFilter },
      _count: { _all: true },
    }),
    prisma.employee.groupBy({
      by: ["departmentId"],
      where: { tenantId, status: { in: ACTIVE_EMPLOYEE_STATUSES } },
      _count: { _all: true },
    }),
    prisma.auditLog.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, module: true, actorName: true, entityType: true, createdAt: true, metadata: true },
    }),
    prisma.payrollPeriod.findMany({ where: { tenantId }, orderBy: { startDate: "desc" }, take: 6 }),
    prisma.employee.findMany({
      where: { tenantId, resignDate: { gte: sixMonthsAgo } },
      select: { resignDate: true },
    }),
    prisma.employee.findMany({
      where: { tenantId, hireDate: { gte: sixMonthsAgo } },
      select: { hireDate: true },
    }),
    prisma.employmentContract.count({
      where: {
        tenantId,
        status: "ACTIVE",
        endDate: { gte: today, lte: new Date(today.getTime() + 45 * 86400000) },
      },
    }),
    prisma.employee.findMany({
      where: {
        tenantId,
        status: { in: ACTIVE_EMPLOYEE_STATUSES },
      },
      select: { firstName: true, lastName: true, birthDate: true, department: { select: { name: true } } },
    }),
  ]);

  // Attendance daily series for the selected month
  const byDate = new Map<string, { present: number; late: number; absent: number; onLeave: number }>();
  for (const row of attendanceTrendRaw) {
    const key = row.date.toISOString().slice(0, 10);
    const bucket = byDate.get(key) ?? { present: 0, late: 0, absent: 0, onLeave: 0 };
    const count = row._count._all;
    if (row.status === "PRESENT" || row.status === "REMOTE" || row.status === "HALF_DAY") bucket.present += count;
    else if (row.status === "LATE") {
      bucket.present += count;
      bucket.late += count;
    } else if (row.status === "ABSENT") bucket.absent += count;
    else if (row.status === "ON_LEAVE") bucket.onLeave += count;
    byDate.set(key, bucket);
  }
  const attendanceSeries = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, ...value }));

  const deptNameById = new Map(departments.map((d) => [d.id, d.name]));
  const distribution = departmentDistribution
    .map((row) => ({
      name: row.departmentId ? deptNameById.get(row.departmentId) ?? "Lainnya" : "Tanpa Departemen",
      value: row._count._all,
    }))
    .sort((a, b) => b.value - a.value);

  // Turnover trend for the last six months
  const turnoverSeries: { label: string; turnover: number; hires: number; exits: number }[] = [];
  for (let offset = 5; offset >= 0; offset -= 1) {
    const info = monthRange(
      new Date(Date.UTC(filters.year, filters.month - 1 - offset, 1)).getUTCFullYear(),
      new Date(Date.UTC(filters.year, filters.month - 1 - offset, 1)).getUTCMonth() + 1,
    );
    const exits = leavers.filter((e) => e.resignDate && e.resignDate >= info.start && e.resignDate <= info.end).length;
    const hires = joiners.filter((e) => e.hireDate >= info.start && e.hireDate <= info.end).length;
    const avgHeadcount = Math.max(1, headcount - Math.round(exits / 2));
    turnoverSeries.push({
      label: `${MONTH_NAMES_ID[info.start.getUTCMonth()]?.slice(0, 3)} ${String(info.start.getUTCFullYear()).slice(2)}`,
      turnover: Number(((exits / avgHeadcount) * 100).toFixed(1)),
      hires,
      exits,
    });
  }

  const monthLabel = new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(start);
  const birthdayMonth = new Date(Date.UTC(filters.year, filters.month - 1, 1)).getUTCMonth();
  const birthdays = birthdayPeople
    .filter((p) => p.birthDate && p.birthDate.getUTCMonth() === birthdayMonth)
    .sort((a, b) => (a.birthDate?.getUTCDate() ?? 0) - (b.birthDate?.getUTCDate() ?? 0))
    .slice(0, 5)
    .map((p) => ({
      name: `${p.firstName} ${p.lastName ?? ""}`.trim(),
      day: p.birthDate!.getUTCDate(),
      department: p.department?.name ?? "—",
    }));

  const attendanceRate =
    presentToday + absentToday > 0 ? Number(((presentToday / (presentToday + absentToday)) * 100).toFixed(1)) : 0;

  return {
    filters: {
      ...filters,
      monthLabel,
      departments,
      locations,
    },
    metrics: {
      headcount,
      presentToday,
      lateToday,
      absentToday,
      onLeaveToday: Math.max(onLeaveRecords, 0),
      newHiresThisMonth,
      resignedThisMonth,
      pendingApprovals: pendingLeave + pendingCorrections,
      pendingLeave,
      pendingCorrections,
      attendanceRate,
      contractExpiring,
      canReadOrg,
    },
    payroll: latestPayroll
      ? {
          id: latestPayroll.id,
          name: latestPayroll.name,
          status: latestPayroll.status,
          grossTotal: decimalFromDb(latestPayroll.grossTotal).toFixed(2),
          netTotal: decimalFromDb(latestPayroll.netTotal).toFixed(2),
          employeeCount: latestPayroll.employeeCount,
          payDate: latestPayroll.payDate,
        }
      : null,
    payrollHistory: payrollPeriods.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      netTotal: decimalFromDb(p.netTotal).toFixed(2),
      grossTotal: decimalFromDb(p.grossTotal).toFixed(2),
      employeeCount: p.employeeCount,
      payDate: p.payDate,
      startDate: p.startDate,
    })),
    attendanceSeries,
    distribution,
    turnoverSeries,
    recentActivity,
    birthdays,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboardData>>;
