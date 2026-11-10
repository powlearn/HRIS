import type { EmployeeStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, type SessionUser } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { decryptField, encryptField, maskValue } from "@/lib/crypto";
import { dateOnly, todayDateOnly } from "@/lib/time";
import { decimalFromDb } from "@/lib/money";
import type { EmployeeCreateInput, EmployeeUpdateInput } from "@/modules/employees/schema";

const ACTIVE_STATUSES: EmployeeStatus[] = ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"];

export type EmployeeListFilters = {
  search?: string;
  status?: string;
  departmentId?: string;
  locationId?: string;
  page?: number;
  pageSize?: number;
};

function scopeFor(user: SessionUser): Prisma.EmployeeWhereInput {
  if (hasPermission(user.permissions, "employee.read")) return { tenantId: user.tenantId };
  return {
    tenantId: user.tenantId,
    OR: [{ managerId: user.employeeId ?? "__none__" }, { id: user.employeeId ?? "__none__" }],
  };
}

export async function listEmployees(user: SessionUser, filters: EmployeeListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));

  const where: Prisma.EmployeeWhereInput = {
    ...scopeFor(user),
    ...(filters.status && filters.status !== "all"
      ? filters.status === "ACTIVE"
        ? { status: { in: ACTIVE_STATUSES } }
        : { status: filters.status as EmployeeStatus }
      : {}),
    ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
    ...(filters.search
      ? {
          OR: [
            { firstName: { contains: filters.search, mode: "insensitive" } },
            { lastName: { contains: filters.search, mode: "insensitive" } },
            { employeeCode: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
            { position: { title: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, title: true } },
        location: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const canSeeSalary = hasPermission(user.permissions, ["employee.sensitive.read", "payroll.read"]);

  return {
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    employees: rows.map((row) => ({
      id: row.id,
      employeeCode: row.employeeCode,
      name: `${row.firstName} ${row.lastName ?? ""}`.trim(),
      email: row.email,
      phone: row.phone,
      status: row.status,
      department: row.department?.name ?? null,
      departmentId: row.department?.id ?? null,
      position: row.position?.title ?? null,
      location: row.location?.name ?? null,
      manager: row.manager ? `${row.manager.firstName} ${row.manager.lastName ?? ""}`.trim() : null,
      hireDate: row.hireDate,
      basicSalary: canSeeSalary ? decimalFromDb(row.basicSalary).toNumber() : null,
    })),
  };
}

export async function getEmployeeDirectoryOptions(tenantId: string) {
  const [departments, locations, positions, managers, schedules] = await Promise.all([
    prisma.department.findMany({ where: { tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workLocation.findMany({ where: { tenantId, isActive: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.position.findMany({ where: { tenantId }, select: { id: true, title: true, departmentId: true }, orderBy: { title: "asc" } }),
    prisma.employee.findMany({
      where: { tenantId, status: { in: ACTIVE_STATUSES } },
      select: { id: true, firstName: true, lastName: true, employeeCode: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.workSchedule.findMany({ where: { tenantId }, select: { id: true, name: true } }),
  ]);
  return { departments, locations, positions, managers, schedules };
}

async function generateEmployeeCode(tenantId: string): Promise<string> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { employeeCodePrefix: true } });
  const prefix = tenant?.employeeCodePrefix ?? "EMP";
  const count = await prisma.employee.count({ where: { tenantId } });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const code = `${prefix}-${String(count + 1 + attempt).padStart(4, "0")}`;
    const exists = await prisma.employee.findFirst({ where: { tenantId, employeeCode: code }, select: { id: true } });
    if (!exists) return code;
  }
  throw new ApiError(500, "Tidak dapat membuat ID karyawan unik.");
}

export async function ensureLeaveBalances(tenantId: string, employeeId: string, year = new Date().getUTCFullYear()) {
  const leaveTypes = await prisma.leaveType.findMany({ where: { tenantId, isActive: true } });
  await prisma.leaveBalance.createMany({
    data: leaveTypes.map((type) => ({
      tenantId,
      employeeId,
      leaveTypeId: type.id,
      year,
      entitled: type.annualQuota,
      used: 0,
      pending: 0,
      carriedOver: 0,
    })),
    skipDuplicates: true,
  });
}

export async function createEmployee(user: SessionUser, input: EmployeeCreateInput) {
  const [department, position, location, manager] = await Promise.all([
    prisma.department.findFirst({ where: { id: input.departmentId, tenantId: user.tenantId } }),
    prisma.position.findFirst({ where: { id: input.positionId, tenantId: user.tenantId } }),
    prisma.workLocation.findFirst({ where: { id: input.locationId, tenantId: user.tenantId } }),
    input.managerId ? prisma.employee.findFirst({ where: { id: input.managerId, tenantId: user.tenantId } }) : null,
  ]);
  if (!department || !position || !location) throw new ApiError(422, "Departemen, jabatan, atau lokasi tidak valid untuk tenant ini.");
  if (input.managerId && !manager) throw new ApiError(422, "Atasan langsung tidak ditemukan pada tenant ini.");
  if (manager && manager.id === input.managerId) {
    const wouldCycle = await prisma.employee.findFirst({ where: { id: input.managerId, managerId: input.managerId } });
    if (wouldCycle) throw new ApiError(422, "Relasi atasan langsung membentuk siklus.");
  }

  const employeeCode = await generateEmployeeCode(user.tenantId);
  const employee = await prisma.employee.create({
    data: {
      tenantId: user.tenantId,
      employeeCode,
      firstName: input.firstName,
      lastName: input.lastName,
      email: input.email,
      phone: input.phone,
      gender: input.gender,
      birthDate: input.birthDate ? dateOnly(input.birthDate) : null,
      birthPlace: input.birthPlace,
      maritalStatus: input.maritalStatus,
      religion: input.religion,
      address: input.address,
      city: input.city,
      postalCode: input.postalCode,
      nikEnc: encryptField(input.nik),
      npwpEnc: encryptField(input.npwp),
      bankName: input.bankName,
      bankAccountEnc: encryptField(input.bankAccount),
      departmentId: input.departmentId,
      positionId: input.positionId,
      locationId: input.locationId,
      managerId: input.managerId ?? null,
      scheduleId: input.scheduleId ?? null,
      status: input.status,
      hireDate: dateOnly(input.hireDate),
      endDate: input.endDate ? dateOnly(input.endDate) : null,
      basicSalary: input.basicSalary,
      emergencyName: input.emergencyName,
      emergencyRelation: input.emergencyRelation,
      emergencyPhone: input.emergencyPhone,
    },
  });

  await prisma.employmentContract.create({
    data: {
      tenantId: user.tenantId,
      employeeId: employee.id,
      contractNumber: `PK/${new Date().getUTCFullYear()}/${employeeCode}`,
      type: input.contractType,
      startDate: dateOnly(input.hireDate),
      endDate: input.endDate ? dateOnly(input.endDate) : null,
      signedAt: new Date(),
      status: "ACTIVE",
      notes: "Dibuat melalui NexaHR.",
    },
  });

  await prisma.employmentHistory.create({
    data: {
      employeeId: employee.id,
      changeType: "HIRING",
      effectiveDate: dateOnly(input.hireDate),
      newValue: { position: position.title, department: department.name, status: input.status },
      notes: `Karyawan ditambahkan oleh ${user.name}.`,
      actorId: user.id,
    },
  });

  await ensureLeaveBalances(user.tenantId, employee.id);
  return employee;
}

export async function updateEmployee(user: SessionUser, input: EmployeeUpdateInput) {
  const existing = await prisma.employee.findFirst({ where: { id: input.id, tenantId: user.tenantId } });
  if (!existing) throw new ApiError(404, "Karyawan tidak ditemukan.");

  if (input.managerId) {
    if (input.managerId === existing.id) throw new ApiError(422, "Karyawan tidak dapat menjadi atasan dirinya sendiri.");
    const manager = await prisma.employee.findFirst({ where: { id: input.managerId, tenantId: user.tenantId } });
    if (!manager) throw new ApiError(422, "Atasan langsung tidak ditemukan pada tenant ini.");
  }

  const data: Prisma.EmployeeUpdateInput = {
    firstName: input.firstName ?? undefined,
    lastName: input.lastName ?? undefined,
    email: input.email ?? undefined,
    phone: input.phone ?? undefined,
    gender: input.gender ?? undefined,
    birthDate: input.birthDate ? dateOnly(input.birthDate) : undefined,
    birthPlace: input.birthPlace ?? undefined,
    maritalStatus: input.maritalStatus ?? undefined,
    religion: input.religion ?? undefined,
    address: input.address ?? undefined,
    city: input.city ?? undefined,
    postalCode: input.postalCode ?? undefined,
    department: input.departmentId ? { connect: { id: input.departmentId } } : undefined,
    position: input.positionId ? { connect: { id: input.positionId } } : undefined,
    location: input.locationId ? { connect: { id: input.locationId } } : undefined,
    manager: input.managerId ? { connect: { id: input.managerId } } : input.managerId === undefined ? undefined : { disconnect: true },
    schedule: input.scheduleId ? { connect: { id: input.scheduleId } } : undefined,
    status: input.status ?? undefined,
    basicSalary: input.basicSalary ?? undefined,
    endDate: input.endDate ? dateOnly(input.endDate) : undefined,
    emergencyName: input.emergencyName ?? undefined,
    emergencyRelation: input.emergencyRelation ?? undefined,
    emergencyPhone: input.emergencyPhone ?? undefined,
  };

  if (input.nik !== undefined) data.nikEnc = encryptField(input.nik);
  if (input.npwp !== undefined) data.npwpEnc = encryptField(input.npwp);
  if (input.bankAccount !== undefined) data.bankAccountEnc = encryptField(input.bankAccount);

  const updated = await prisma.employee.update({ where: { id: existing.id }, data });

  if (input.departmentId || input.positionId || input.status || input.basicSalary !== undefined || input.managerId !== undefined) {
    await prisma.employmentHistory.create({
      data: {
        employeeId: existing.id,
        changeType:
          input.departmentId && input.departmentId !== existing.departmentId
            ? "TRANSFER"
            : input.status && input.status !== existing.status
              ? "STATUS_CHANGE"
              : input.managerId !== undefined && input.managerId !== existing.managerId
                ? "MANAGER_CHANGE"
                : "SALARY_CHANGE",
        effectiveDate: todayDateOnly(user.timezone),
        oldValue: {
          departmentId: existing.departmentId,
          positionId: existing.positionId,
          status: existing.status,
          basicSalary: existing.basicSalary?.toString(),
          managerId: existing.managerId,
        },
        newValue: {
          departmentId: updated.departmentId,
          positionId: updated.positionId,
          status: updated.status,
          basicSalary: updated.basicSalary?.toString(),
          managerId: updated.managerId,
        },
        notes: `Perubahan data oleh ${user.name}.`,
        actorId: user.id,
      },
    });
  }

  return updated;
}

export async function getEmployeeDetail(user: SessionUser, employeeId: string) {
  const canReadAll = hasPermission(user.permissions, "employee.read");
  const employee = await prisma.employee.findFirst({
    where: {
      id: employeeId,
      tenantId: user.tenantId,
      ...(canReadAll ? {} : { OR: [{ managerId: user.employeeId ?? "__none__" }, { id: user.employeeId ?? "__none__" }] }),
    },
    include: {
      department: true,
      position: true,
      location: true,
      schedule: true,
      manager: { select: { id: true, firstName: true, lastName: true, employeeCode: true } },
      reports: { select: { id: true, firstName: true, lastName: true, employeeCode: true, position: { select: { title: true } } } },
      contracts: { orderBy: { startDate: "desc" } },
      histories: { orderBy: { effectiveDate: "desc" }, take: 20 },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!employee) throw new ApiError(404, "Karyawan tidak ditemukan atau berada di luar cakupan akses Anda.");

  const sensitive = hasPermission(user.permissions, "employee.sensitive.read");
  const payroll = hasPermission(user.permissions, "payroll.read") || employee.userId === user.id;
  const canSeeSalary = sensitive || hasPermission(user.permissions, "payroll.read");

  const [attendance, leaveRequests, leaveBalances, payrollRecords, auditTrail] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { tenantId: user.tenantId, employeeId },
      orderBy: { date: "desc" },
      take: 30,
    }),
    prisma.leaveRequest.findMany({
      where: { tenantId: user.tenantId, employeeId },
      orderBy: { startDate: "desc" },
      take: 12,
      include: { leaveType: { select: { name: true, color: true } }, approvals: { orderBy: { stepOrder: "asc" } } },
    }),
    prisma.leaveBalance.findMany({
      where: { tenantId: user.tenantId, employeeId },
      include: { leaveType: { select: { name: true, color: true } } },
      orderBy: { leaveType: { name: "asc" } },
    }),
    payroll
      ? prisma.payrollRecord.findMany({
          where: { tenantId: user.tenantId, employeeId },
          orderBy: { createdAt: "desc" },
          take: 12,
          include: { period: { select: { name: true, status: true, payDate: true } }, payslip: { select: { id: true, number: true } } },
        })
      : Promise.resolve([]),
    prisma.auditLog.findMany({
      where: { tenantId: user.tenantId, entityId: employeeId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
      email: employee.email,
      phone: employee.phone,
      gender: employee.gender,
      birthDate: employee.birthDate,
      birthPlace: employee.birthPlace,
      maritalStatus: employee.maritalStatus,
      religion: employee.religion,
      address: employee.address,
      city: employee.city,
      postalCode: employee.postalCode,
      status: employee.status,
      hireDate: employee.hireDate,
      endDate: employee.endDate,
      resignDate: employee.resignDate,
      bankName: employee.bankName,
      department: employee.department ? { id: employee.department.id, name: employee.department.name } : null,
      position: employee.position ? { id: employee.position.id, title: employee.position.title } : null,
      location: employee.location ? { id: employee.location.id, name: employee.location.name } : null,
      schedule: employee.schedule ? { id: employee.schedule.id, name: employee.schedule.name, startTime: employee.schedule.startTime, endTime: employee.schedule.endTime } : null,
      manager: employee.manager
        ? { id: employee.manager.id, name: `${employee.manager.firstName} ${employee.manager.lastName ?? ""}`.trim(), employeeCode: employee.manager.employeeCode }
        : null,
      reports: employee.reports.map((report) => ({
        id: report.id,
        name: `${report.firstName} ${report.lastName ?? ""}`.trim(),
        employeeCode: report.employeeCode,
        position: report.position?.title ?? null,
      })),
      emergency: {
        name: employee.emergencyName,
        relation: employee.emergencyRelation,
        phone: employee.emergencyPhone,
      },
      basicSalary: canSeeSalary ? decimalFromDb(employee.basicSalary).toNumber() : null,
      sensitive: sensitive
        ? {
            nik: decryptField(employee.nikEnc),
            npwp: decryptField(employee.npwpEnc),
            bankAccount: decryptField(employee.bankAccountEnc),
            bpjsKes: decryptField(employee.bpjsKesNumberEnc),
            bpjsTk: decryptField(employee.bpjsTkNumberEnc),
            masked: false,
          }
        : {
            nik: maskValue(decryptField(employee.nikEnc)),
            npwp: maskValue(decryptField(employee.npwpEnc)),
            bankAccount: maskValue(decryptField(employee.bankAccountEnc)),
            bpjsKes: maskValue(decryptField(employee.bpjsKesNumberEnc)),
            bpjsTk: maskValue(decryptField(employee.bpjsTkNumberEnc)),
            masked: true,
          },
    },
    contracts: employee.contracts.map((contract) => ({
      id: contract.id,
      contractNumber: contract.contractNumber,
      type: contract.type,
      status: contract.status,
      startDate: contract.startDate,
      endDate: contract.endDate,
      signedAt: contract.signedAt,
    })),
    histories: employee.histories.map((history) => ({
      id: history.id,
      changeType: history.changeType,
      effectiveDate: history.effectiveDate,
      notes: history.notes,
      oldValue: history.oldValue,
      newValue: history.newValue,
    })),
    documents: employee.documents.map((document) => ({
      id: document.id,
      name: document.name,
      type: document.type,
      fileName: document.fileName,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      createdAt: document.createdAt,
    })),
    attendance: attendance.map((record) => ({
      id: record.id,
      date: record.date,
      clockIn: record.clockIn,
      clockOut: record.clockOut,
      status: record.status,
      lateMinutes: record.lateMinutes,
      overtimeMinutes: record.overtimeMinutes,
      workedMinutes: record.workedMinutes,
      geofencePassed: record.geofencePassed,
    })),
    leaveRequests: leaveRequests.map((request) => ({
      id: request.id,
      requestNumber: request.requestNumber,
      type: request.leaveType.name,
      color: request.leaveType.color,
      startDate: request.startDate,
      endDate: request.endDate,
      days: decimalFromDb(request.days).toNumber(),
      status: request.status,
      reason: request.reason,
      approvals: request.approvals.map((approval) => ({
        step: approval.stepOrder,
        role: approval.approverRole,
        status: approval.status,
        comment: approval.comment,
        actedAt: approval.actedAt,
      })),
    })),
    leaveBalances: leaveBalances.map((balance) => ({
      id: balance.id,
      name: balance.leaveType.name,
      color: balance.leaveType.color,
      entitled: decimalFromDb(balance.entitled).plus(decimalFromDb(balance.carriedOver)).toNumber(),
      used: decimalFromDb(balance.used).toNumber(),
      pending: decimalFromDb(balance.pending).toNumber(),
    })),
    payrollRecords: payrollRecords.map((record) => ({
      id: record.id,
      period: record.period.name,
      periodStatus: record.period.status,
      payDate: record.period.payDate,
      grossPay: decimalFromDb(record.grossPay).toNumber(),
      totalDeductions: decimalFromDb(record.totalDeductions).toNumber(),
      netPay: decimalFromDb(record.netPay).toNumber(),
      payslipNumber: record.payslip?.number ?? null,
    })),
    auditTrail,
    permissions: {
      canEdit: hasPermission(user.permissions, "employee.update"),
      canSeeSensitive: sensitive,
      canSeePayroll: payroll,
      canManageDocuments: hasPermission(user.permissions, "document.manage"),
    },
  };
}

export type EmployeeDetail = Awaited<ReturnType<typeof getEmployeeDetail>>;
