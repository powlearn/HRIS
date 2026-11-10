import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError, type SessionUser } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { dateOnly, inclusiveDays } from "@/lib/time";
import { decimalFromDb, Decimal } from "@/lib/money";
import { notifyRole, notifyUser } from "@/lib/notifications";
import { ensureLeaveBalances } from "@/modules/employees/service";

export const PENDING_LEAVE_STATUSES = ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW"] as const;

export async function getLeaveOverview(user: SessionUser) {
  const year = new Date().getUTCFullYear();
  const canApprove = hasPermission(user.permissions, "leave.approve");
  const canSeeAll = hasPermission(user.permissions, "leave.manage") || canApprove;

  if (user.employeeId) await ensureLeaveBalances(user.tenantId, user.employeeId, year);

  const employeeScope: Prisma.LeaveRequestWhereInput = canSeeAll
    ? { tenantId: user.tenantId }
    : { tenantId: user.tenantId, employeeId: user.employeeId ?? "__none__" };

  const [types, balances, myRequests, approvals, holidays] = await Promise.all([
    prisma.leaveType.findMany({ where: { tenantId: user.tenantId, isActive: true }, orderBy: { name: "asc" } }),
    user.employeeId
      ? prisma.leaveBalance.findMany({
          where: { tenantId: user.tenantId, employeeId: user.employeeId, year },
          include: { leaveType: { select: { name: true, code: true, color: true } } },
        })
      : Promise.resolve([]),
    prisma.leaveRequest.findMany({
      where: { tenantId: user.tenantId, employeeId: user.employeeId ?? "__none__" },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        leaveType: true,
        employee: { select: { firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
        approvals: { orderBy: { stepOrder: "asc" } },
      },
    }),
    canApprove
      ? prisma.leaveRequest.findMany({
          where: {
            tenantId: user.tenantId,
            status: { in: [...PENDING_LEAVE_STATUSES] },
            ...(hasPermission(user.permissions, "leave.manage")
              ? {}
              : { employee: { managerId: user.employeeId ?? "__none__" } }),
          },
          orderBy: { submittedAt: "asc" },
          include: {
            leaveType: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                employeeCode: true,
                managerId: true,
                department: { select: { name: true } },
              },
            },
            approvals: { orderBy: { stepOrder: "asc" } },
          },
        })
      : Promise.resolve([]),
    prisma.holiday.findMany({ where: { tenantId: user.tenantId }, orderBy: { date: "asc" } }),
  ]);

  const canApproveStep = (request: (typeof approvals)[number]) => {
    const step = request.approvals.find((approval) => approval.stepOrder === request.currentStep);
    if (!step) return false;
    return step.approverId === user.id || step.approverRole === user.roleSlug || hasPermission(user.permissions, "*");
  };

  return {
    types: types.map((type) => ({
      id: type.id,
      name: type.name,
      code: type.code,
      color: type.color,
      annualQuota: type.annualQuota,
      isPaid: type.isPaid,
      requiresDocument: type.requiresDocument,
      maxConsecutiveDays: type.maxConsecutiveDays,
      minNoticeDays: type.minNoticeDays,
    })),
    balances: balances.map((balance) => ({
      id: balance.id,
      name: balance.leaveType.name,
      code: balance.leaveType.code,
      color: balance.leaveType.color,
      entitled: decimalFromDb(balance.entitled).plus(decimalFromDb(balance.carriedOver)).toNumber(),
      used: decimalFromDb(balance.used).toNumber(),
      pending: decimalFromDb(balance.pending).toNumber(),
      remaining: Math.max(
        0,
        decimalFromDb(balance.entitled)
          .plus(decimalFromDb(balance.carriedOver))
          .minus(decimalFromDb(balance.used))
          .minus(decimalFromDb(balance.pending))
          .toNumber(),
      ),
    })),
    myRequests: myRequests.map((request) => ({
      id: request.id,
      requestNumber: request.requestNumber,
      type: request.leaveType.name,
      color: request.leaveType.color,
      startDate: request.startDate,
      endDate: request.endDate,
      days: decimalFromDb(request.days).toNumber(),
      status: request.status,
      reason: request.reason,
      submittedAt: request.submittedAt,
      createdAt: request.createdAt,
      employeeName: `${request.employee.firstName} ${request.employee.lastName ?? ""}`.trim(),
      approvals: request.approvals.map((approval) => ({
        stepOrder: approval.stepOrder,
        role: approval.approverRole,
        status: approval.status,
        comment: approval.comment,
        actedAt: approval.actedAt,
      })),
    })),
    approvals: approvals
      .filter((request) => canApproveStep(request))
      .map((request) => ({
        id: request.id,
        requestNumber: request.requestNumber,
        employeeName: `${request.employee.firstName} ${request.employee.lastName ?? ""}`.trim(),
        employeeCode: request.employee.employeeCode,
        department: request.employee.department?.name ?? null,
        type: request.leaveType.name,
        color: request.leaveType.color,
        startDate: request.startDate,
        endDate: request.endDate,
        days: decimalFromDb(request.days).toNumber(),
        reason: request.reason,
        status: request.status,
        currentStep: request.currentStep,
        submittedAt: request.submittedAt,
        approvals: request.approvals.map((approval) => ({
          stepOrder: approval.stepOrder,
          status: approval.status,
          role: approval.approverRole,
          comment: approval.comment,
        })),
      })),
    holidays: holidays.map((holiday) => ({ id: holiday.id, date: holiday.date, name: holiday.name })),
    calendar: myRequests
      .concat([])
      .filter((request) => request.status === "APPROVED")
      .map((request) => ({
        id: request.id,
        name: `${request.employee.firstName} ${request.employee.lastName ?? ""}`.trim(),
        type: request.leaveType.name,
        color: request.leaveType.color,
        start: request.startDate,
        end: request.endDate,
      })),
    canApprove,
    canSeeAll,
    employeeScope,
  };
}

export async function submitLeaveRequest(
  user: SessionUser,
  input: { leaveTypeId: string; startDate: string; endDate: string; reason: string; attachmentKey?: string },
) {
  if (!user.employeeId) throw new ApiError(403, "Akun Anda belum terhubung ke profil karyawan.", { code: "NO_EMPLOYEE" });
  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, tenantId: user.tenantId },
    select: { id: true, managerId: true, departmentId: true, firstName: true, lastName: true, userId: true },
  });
  if (!employee) throw new ApiError(403, "Profil karyawan tidak ditemukan.");

  const type = await prisma.leaveType.findFirst({ where: { id: input.leaveTypeId, tenantId: user.tenantId, isActive: true } });
  if (!type) throw new ApiError(404, "Jenis cuti tidak ditemukan.");

  const start = dateOnly(input.startDate);
  const end = dateOnly(input.endDate);
  if (end < start) throw new ApiError(422, "Tanggal selesai tidak boleh sebelum tanggal mulai.");

  const days = inclusiveDays(start, end);
  if (days > type.maxConsecutiveDays) {
    throw new ApiError(422, `Maksimum ${type.maxConsecutiveDays} hari untuk ${type.name}.`);
  }

  const today = dateOnly(new Date().toISOString().slice(0, 10));
  if (type.minNoticeDays > 0) {
    const noticeDays = Math.floor((start.getTime() - today.getTime()) / 86400000);
    if (noticeDays < type.minNoticeDays) {
      throw new ApiError(422, `${type.name} memerlukan pengajuan minimal ${type.minNoticeDays} hari sebelumnya.`);
    }
  }

  // Conflict detection against overlapping pending/approved requests.
  const conflict = await prisma.leaveRequest.findFirst({
    where: {
      tenantId: user.tenantId,
      employeeId: employee.id,
      status: { in: ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { requestNumber: true, startDate: true, endDate: true },
  });
  if (conflict) {
    throw new ApiError(
      409,
      `Terdapat pengajuan lain pada periode yang sama (${conflict.requestNumber}). Pilih tanggal lain.`,
      { code: "DATE_CONFLICT" },
    );
  }

  const year = start.getUTCFullYear();
  const balance = await prisma.leaveBalance.findUnique({
    where: { employeeId_leaveTypeId_year: { employeeId: employee.id, leaveTypeId: type.id, year } },
  });
  if (type.annualQuota > 0) {
    if (!balance) throw new ApiError(422, "Saldo cuti Anda belum tersedia. Hubungi HR.");
    const remaining = decimalFromDb(balance.entitled)
      .plus(decimalFromDb(balance.carriedOver))
      .minus(decimalFromDb(balance.used))
      .minus(decimalFromDb(balance.pending));
    if (remaining.lt(days)) {
      throw new ApiError(422, `Saldo ${type.name} tidak mencukupi (tersisa ${remaining.toString()} hari).`);
    }
  }

  const workflow = await prisma.approvalWorkflow.findFirst({
    where: { tenantId: user.tenantId, module: "LEAVE", isActive: true },
    include: { steps: { orderBy: { order: "asc" } } },
  });
  if (!workflow || workflow.steps.length === 0) throw new ApiError(422, "Alur persetujuan cuti belum dikonfigurasi.");

  const managerUser = employee.managerId
    ? await prisma.employee.findUnique({ where: { id: employee.managerId }, select: { userId: true } })
    : null;

  const count = await prisma.leaveRequest.count({ where: { tenantId: user.tenantId } });
  const request = await prisma.leaveRequest.create({
    data: {
      tenantId: user.tenantId,
      requestNumber: `LV/${year}/${String(count + 1).padStart(4, "0")}`,
      employeeId: employee.id,
      leaveTypeId: type.id,
      startDate: start,
      endDate: end,
      days: new Decimal(days),
      reason: input.reason,
      attachmentKey: input.attachmentKey,
      status: "MANAGER_REVIEW",
      currentStep: 1,
      submittedAt: new Date(),
      approvals: {
        create: workflow.steps.map((step) => ({
          stepOrder: step.order,
          approverRole: step.roleSlug ?? "dept_manager",
          approverId:
            step.approverType === "MANAGER"
              ? managerUser?.userId ?? null
              : step.approverType === "USER"
                ? step.userId
                : null,
        })),
      },
    },
  });

  if (type.annualQuota > 0 && balance) {
    await prisma.leaveBalance.update({
      where: { id: balance.id },
      data: { pending: { increment: days } },
    });
  }

  await notifyUser({
    tenantId: user.tenantId,
    employeeId: employee.managerId,
    type: "APPROVAL",
    title: `Pengajuan ${type.name} dari ${employee.firstName} ${employee.lastName ?? ""}`.trim(),
    body: `${days} hari · ${input.startDate} s.d. ${input.endDate}`,
    href: "/leave",
  });
  await notifyRole(user.tenantId, "hr_manager", {
    type: "APPROVAL",
    title: `Pengajuan cuti baru: ${employee.firstName} ${employee.lastName ?? ""}`.trim(),
    body: `${type.name} · ${days} hari menunggu alur persetujuan.`,
    href: "/leave",
  });

  return request;
}

export async function decideLeaveRequest(
  user: SessionUser,
  requestId: string,
  decision: "APPROVED" | "REJECTED",
  comment?: string,
) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId: user.tenantId },
    include: { leaveType: true, employee: { select: { id: true, firstName: true, lastName: true, managerId: true } }, approvals: true },
  });
  if (!request) throw new ApiError(404, "Pengajuan cuti tidak ditemukan.");
  if (request.status === "APPROVED" || request.status === "REJECTED" || request.status === "CANCELLED") {
    throw new ApiError(409, "Pengajuan ini sudah selesai diproses.");
  }

  const step = request.approvals.find((approval) => approval.stepOrder === request.currentStep);
  if (!step) throw new ApiError(409, "Tahap persetujuan tidak ditemukan.");
  if (step.approverId !== user.id && step.approverRole !== user.roleSlug && !hasPermission(user.permissions, "*")) {
    throw new ApiError(403, "Anda bukan approver pada tahap ini.");
  }
  if (step.status !== "PENDING") throw new ApiError(409, "Tahap persetujuan ini sudah diproses.");

  const totalSteps = request.approvals.length;
  const isFinal = request.currentStep >= totalSteps;

  await prisma.$transaction(async (tx) => {
    await tx.leaveApproval.update({
      where: { id: step.id },
      data: { status: decision, comment: comment ?? null, actedAt: new Date(), approverId: user.id },
    });

    if (decision === "REJECTED") {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: "REJECTED", decidedAt: new Date() },
      });
      if (request.leaveType.annualQuota > 0) {
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getUTCFullYear() },
          data: { pending: { decrement: request.days } },
        });
      }
      return;
    }

    if (isFinal) {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: { status: "APPROVED", decidedAt: new Date() },
      });
      if (request.leaveType.annualQuota > 0) {
        await tx.leaveBalance.updateMany({
          where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getUTCFullYear() },
          data: { pending: { decrement: request.days }, used: { increment: request.days } },
        });
      }

      // Reflect approved leave in attendance records for weekdays in range.
      const days: Date[] = [];
      for (let cursor = new Date(request.startDate); cursor <= request.endDate; cursor = new Date(cursor.getTime() + 86400000)) {
        const weekday = cursor.getUTCDay();
        if (weekday !== 0 && weekday !== 6) days.push(new Date(cursor));
      }
      if (days.length > 0) {
        await tx.attendanceRecord.updateMany({
          where: { employeeId: request.employeeId, date: { in: days } },
          data: { status: "ON_LEAVE", clockIn: null, clockOut: null, lateMinutes: 0, overtimeMinutes: 0, workedMinutes: 0 },
        });
      }
    } else {
      await tx.leaveRequest.update({
        where: { id: request.id },
        data: {
          currentStep: request.currentStep + 1,
          status: request.currentStep + 1 === 2 ? "HR_REVIEW" : "MANAGER_REVIEW",
        },
      });
    }
  });

  await notifyUser({
    tenantId: user.tenantId,
    employeeId: request.employeeId,
    type: decision === "APPROVED" && isFinal ? "INFO" : "APPROVAL",
    title:
      decision === "REJECTED"
        ? `Pengajuan cuti ${request.requestNumber} ditolak`
        : isFinal
          ? `Pengajuan cuti ${request.requestNumber} disetujui`
          : `Pengajuan cuti ${request.requestNumber} diteruskan ke HR`,
    body: comment ?? undefined,
    href: "/leave",
  });

  return { status: decision, final: isFinal };
}

export async function cancelLeaveRequest(user: SessionUser, requestId: string) {
  const request = await prisma.leaveRequest.findFirst({
    where: { id: requestId, tenantId: user.tenantId },
    include: { leaveType: true },
  });
  if (!request) throw new ApiError(404, "Pengajuan cuti tidak ditemukan.");
  if (request.employeeId !== user.employeeId) throw new ApiError(403, "Anda hanya dapat membatalkan pengajuan sendiri.");
  if (!["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW", "DRAFT"].includes(request.status)) {
    throw new ApiError(409, "Pengajuan ini tidak dapat dibatalkan.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.leaveRequest.update({ where: { id: request.id }, data: { status: "CANCELLED", decidedAt: new Date() } });
    if (request.leaveType.annualQuota > 0) {
      await tx.leaveBalance.updateMany({
        where: { employeeId: request.employeeId, leaveTypeId: request.leaveTypeId, year: request.startDate.getUTCFullYear() },
        data: { pending: { decrement: request.days } },
      });
    }
  });
  return { cancelled: true };
}
