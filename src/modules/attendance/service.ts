import { prisma } from "@/lib/prisma";
import { ApiError, type SessionUser } from "@/lib/api";
import { dateKey, dateOnly, formatTime, minutesBetween, zonedDateTime } from "@/lib/time";
import { decimalFromDb, ZERO } from "@/lib/money";

const DEFAULT_SCHEDULE = { startTime: "08:30", endTime: "17:30", graceMinutes: 15, breakMinutes: 60 };

export function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

function minutesOfDay(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export async function getEmployeeContext(user: SessionUser) {
  if (!user.employeeId) throw new ApiError(403, "Akun Anda belum terhubung ke profil karyawan.", { code: "NO_EMPLOYEE" });
  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, tenantId: user.tenantId },
    include: { schedule: true, location: true, department: { select: { name: true } }, position: { select: { title: true } } },
  });
  if (!employee) throw new ApiError(403, "Profil karyawan tidak ditemukan pada tenant ini.");
  return employee;
}

export async function getTodayAttendance(user: SessionUser) {
  const employee = await getEmployeeContext(user);
  const today = dateOnly(dateKey(new Date(), user.timezone));
  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  });
  const policy = await prisma.systemSetting.findUnique({ where: { tenantId_key: { tenantId: user.tenantId, key: "attendance.policy" } } });
  return {
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
      department: employee.department?.name ?? null,
      position: employee.position?.title ?? null,
      location: employee.location ? { id: employee.location.id, name: employee.location.name, radius: employee.location.radiusMeters } : null,
    },
    schedule: employee.schedule
      ? {
          name: employee.schedule.name,
          startTime: employee.schedule.startTime,
          endTime: employee.schedule.endTime,
          graceMinutes: employee.schedule.graceMinutes,
        }
      : { name: "Reguler", ...DEFAULT_SCHEDULE },
    record: record
      ? {
          id: record.id,
          clockIn: record.clockIn,
          clockOut: record.clockOut,
          status: record.status,
          lateMinutes: record.lateMinutes,
          overtimeMinutes: record.overtimeMinutes,
          workedMinutes: record.workedMinutes,
          geofencePassed: record.geofencePassed,
          distanceMeters: record.distanceMeters,
        }
      : null,
    policy: (policy?.value as { geofenceRequired?: boolean; remoteAllowed?: boolean } | null) ?? {
      geofenceRequired: false,
      remoteAllowed: true,
    },
  };
}

export async function clockIn(
  user: SessionUser,
  input: { latitude?: number; longitude?: number; accuracyMeters?: number; notes?: string; source?: "WEB" | "MOBILE" },
) {
  const employee = await getEmployeeContext(user);
  const timezone = employee.schedule?.timezone ?? user.timezone;
  const key = dateKey(new Date(), timezone);
  const today = dateOnly(key);

  const existing = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  });
  if (existing?.clockIn) throw new ApiError(409, "Anda sudah melakukan clock-in hari ini.", { code: "ALREADY_CLOCKED_IN" });

  const schedule = employee.schedule ?? DEFAULT_SCHEDULE;
  const settings = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId: user.tenantId, key: "attendance.policy" } },
  });
  const policy = (settings?.value ?? {}) as { geofenceRequired?: boolean; remoteAllowed?: boolean };

  const now = new Date();
  const lateThreshold = minutesOfDay(schedule.startTime) + (schedule.graceMinutes ?? 15);
  const nowZonedParts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(now);
  const lateMinutes = Math.max(0, minutesOfDay(nowZonedParts) - lateThreshold);

  let distanceMeters: number | null = null;
  let geofencePassed: boolean | null = null;
  const hasCoordinates = typeof input.latitude === "number" && typeof input.longitude === "number";
  if (employee.location?.latitude != null && employee.location.longitude != null && hasCoordinates) {
    distanceMeters = haversineMeters(
      { lat: input.latitude!, lng: input.longitude! },
      { lat: employee.location.latitude, lng: employee.location.longitude },
    );
    geofencePassed = distanceMeters <= employee.location.radiusMeters;
    if (policy.geofenceRequired && !geofencePassed) {
      throw new ApiError(
        422,
        `Lokasi Anda berada ${distanceMeters} m dari ${employee.location.name} (batas ${employee.location.radiusMeters} m). Absensi ditolak oleh kebijakan geofencing.`,
        { code: "OUTSIDE_GEOFENCE" },
      );
    }
  } else if (policy.geofenceRequired && !policy.remoteAllowed) {
    throw new ApiError(422, "Kebijakan tenant mewajibkan verifikasi lokasi. Aktifkan izin lokasi pada perangkat Anda.", {
      code: "LOCATION_REQUIRED",
    });
  }

  const status = lateMinutes > 0 ? "LATE" : "PRESENT";

  if (existing) {
    const updated = await prisma.attendanceRecord.update({
      where: { id: existing.id },
      data: {
        clockIn: now,
        status,
        source: input.source ?? "WEB",
        lateMinutes,
        clockInLat: hasCoordinates ? input.latitude : null,
        clockInLng: hasCoordinates ? input.longitude : null,
        accuracyMeters: input.accuracyMeters ?? null,
        distanceMeters,
        geofencePassed,
        locationId: employee.locationId,
        scheduleId: employee.scheduleId,
        notes: input.notes ?? existing.notes,
      },
    });
    return updated;
  }

  return prisma.attendanceRecord.create({
    data: {
      tenantId: user.tenantId,
      employeeId: employee.id,
      date: today,
      clockIn: now,
      status,
      source: input.source ?? "WEB",
      lateMinutes,
      clockInLat: hasCoordinates ? input.latitude : null,
      clockInLng: hasCoordinates ? input.longitude : null,
      accuracyMeters: input.accuracyMeters ?? null,
      distanceMeters,
      geofencePassed,
      locationId: employee.locationId,
      scheduleId: employee.scheduleId,
      notes: input.notes,
    },
  });
}

export async function clockOut(
  user: SessionUser,
  input: { latitude?: number; longitude?: number; accuracyMeters?: number; notes?: string },
) {
  const employee = await getEmployeeContext(user);
  const timezone = employee.schedule?.timezone ?? user.timezone;
  const today = dateOnly(dateKey(new Date(), timezone));
  const record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date: today } },
  });
  if (!record?.clockIn) throw new ApiError(409, "Anda belum melakukan clock-in hari ini.", { code: "NOT_CLOCKED_IN" });
  if (record.clockOut) throw new ApiError(409, "Anda sudah melakukan clock-out hari ini.", { code: "ALREADY_CLOCKED_OUT" });

  const schedule = employee.schedule ?? DEFAULT_SCHEDULE;
  const now = new Date();
  const workedMinutes = Math.max(0, minutesBetween(record.clockIn, now) - (schedule.breakMinutes ?? 60));

  // Overtime is computed against the schedule end in tenant-local wall time.
  const endLocal = zonedDateTime(dateKey(record.clockIn, timezone), schedule.endTime, timezone);
  const overtimeMinutes = Math.max(0, minutesBetween(endLocal, now));
  const earlyLeaveMinutes = Math.max(0, minutesBetween(now, endLocal));

  const hasCoordinates = typeof input.latitude === "number" && typeof input.longitude === "number";

  return prisma.attendanceRecord.update({
    where: { id: record.id },
    data: {
      clockOut: now,
      workedMinutes,
      overtimeMinutes,
      earlyLeaveMinutes,
      clockOutLat: hasCoordinates ? input.latitude : null,
      clockOutLng: hasCoordinates ? input.longitude : null,
      notes: input.notes ?? record.notes,
    },
  });
}

export async function requestCorrection(
  user: SessionUser,
  input: { date: string; requestedClockIn?: string; requestedClockOut?: string; reason: string },
) {
  const employee = await getEmployeeContext(user);
  const date = dateOnly(input.date);
  let record = await prisma.attendanceRecord.findUnique({
    where: { employeeId_date: { employeeId: employee.id, date } },
  });
  if (!record) {
    record = await prisma.attendanceRecord.create({
      data: { tenantId: user.tenantId, employeeId: employee.id, date, status: "ABSENT", source: "MANUAL" },
    });
  }
  const pending = await prisma.attendanceCorrection.findFirst({
    where: { attendanceId: record.id, status: "PENDING" },
  });
  if (pending) throw new ApiError(409, "Sudah ada permintaan koreksi yang menunggu persetujuan untuk tanggal ini.");

  const timezone = employee.schedule?.timezone ?? user.timezone;
  return prisma.attendanceCorrection.create({
    data: {
      tenantId: user.tenantId,
      attendanceId: record.id,
      employeeId: employee.id,
      requestedClockIn: input.requestedClockIn ? zonedDateTime(input.date, input.requestedClockIn, timezone) : null,
      requestedClockOut: input.requestedClockOut ? zonedDateTime(input.date, input.requestedClockOut, timezone) : null,
      reason: input.reason,
    },
  });
}

export type AttendanceSummary = {
  presentDays: number;
  lateDays: number;
  absentDays: number;
  leaveDays: number;
  overtimeMinutes: number;
  totalWorkedMinutes: number;
};

export function summariseAttendance(
  rows: { status: string; overtimeMinutes: number; workedMinutes: number }[],
): AttendanceSummary {
  const summary: AttendanceSummary = {
    presentDays: 0,
    lateDays: 0,
    absentDays: 0,
    leaveDays: 0,
    overtimeMinutes: 0,
    totalWorkedMinutes: 0,
  };
  for (const row of rows) {
    if (["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(row.status)) summary.presentDays += 1;
    if (row.status === "LATE") summary.lateDays += 1;
    if (row.status === "ABSENT") summary.absentDays += 1;
    if (row.status === "ON_LEAVE") summary.leaveDays += 1;
    summary.overtimeMinutes += row.overtimeMinutes;
    summary.totalWorkedMinutes += row.workedMinutes;
  }
  return summary;
}

export async function getMyAttendance(user: SessionUser, from: Date, to: Date) {
  const employee = await getEmployeeContext(user);
  const [records, leaveBalance] = await Promise.all([
    prisma.attendanceRecord.findMany({
      where: { tenantId: user.tenantId, employeeId: employee.id, date: { gte: from, lte: to } },
      orderBy: { date: "desc" },
    }),
    prisma.leaveBalance.findMany({
      where: { tenantId: user.tenantId, employeeId: employee.id, year: new Date().getUTCFullYear() },
      include: { leaveType: { select: { name: true, code: true, color: true } } },
    }),
  ]);

  return {
    employee: {
      id: employee.id,
      name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(),
      employeeCode: employee.employeeCode,
      department: employee.department?.name ?? null,
      position: employee.position?.title ?? null,
      schedule: employee.schedule ? { start: employee.schedule.startTime, end: employee.schedule.endTime } : null,
    },
    records: records.map((record) => ({
      id: record.id,
      date: record.date,
      clockIn: record.clockIn,
      clockOut: record.clockOut,
      status: record.status,
      lateMinutes: record.lateMinutes,
      overtimeMinutes: record.overtimeMinutes,
      workedMinutes: record.workedMinutes,
      locationVerified: record.geofencePassed,
      distanceMeters: record.distanceMeters,
    })),
    summary: summariseAttendance(records),
    leaveBalances: leaveBalance.map((balance) => ({
      name: balance.leaveType.name,
      color: balance.leaveType.color,
      entitled: decimalFromDb(balance.entitled).toNumber(),
      used: decimalFromDb(balance.used).toNumber(),
      pending: decimalFromDb(balance.pending).toNumber(),
      remaining: Math.max(0, decimalFromDb(balance.entitled).plus(decimalFromDb(balance.carriedOver)).minus(decimalFromDb(balance.used)).minus(decimalFromDb(balance.pending)).toNumber()),
    })),
    serverTime: formatTime(new Date(), user.timezone),
  };
}

export async function applyCorrection(
  user: SessionUser,
  correctionId: string,
  decision: "APPROVED" | "REJECTED",
  reviewNote?: string,
) {
  const correction = await prisma.attendanceCorrection.findFirst({
    where: { id: correctionId, tenantId: user.tenantId },
    include: { attendance: true, employee: { select: { id: true, firstName: true, lastName: true, scheduleId: true } } },
  });
  if (!correction) throw new ApiError(404, "Permintaan koreksi tidak ditemukan.");
  if (correction.status !== "PENDING") throw new ApiError(409, "Permintaan koreksi ini sudah diproses.");

  if (decision === "APPROVED") {
    const record = correction.attendance;
    const clockIn = correction.requestedClockIn ?? record.clockIn;
    const clockOut = correction.requestedClockOut ?? record.clockOut;
    const schedule = correction.employee.scheduleId
      ? await prisma.workSchedule.findUnique({ where: { id: correction.employee.scheduleId } })
      : null;
    const startTime = schedule?.startTime ?? DEFAULT_SCHEDULE.startTime;
    const endTime = schedule?.endTime ?? DEFAULT_SCHEDULE.endTime;
    const grace = schedule?.graceMinutes ?? DEFAULT_SCHEDULE.graceMinutes;
    const timezone = schedule?.timezone ?? user.timezone;

    const key = dateKey(record.date, timezone);
    const lateMinutes = clockIn
      ? Math.max(0, minutesBetween(zonedDateTime(key, startTime, timezone), clockIn) - grace)
      : 0;
    const overtimeMinutes = clockOut ? Math.max(0, minutesBetween(zonedDateTime(key, endTime, timezone), clockOut)) : 0;
    const workedMinutes = clockIn && clockOut ? Math.max(0, minutesBetween(clockIn, clockOut) - (schedule?.breakMinutes ?? 60)) : 0;

    await prisma.attendanceRecord.update({
      where: { id: record.id },
      data: {
        clockIn,
        clockOut,
        status: clockIn ? (lateMinutes > 0 ? "LATE" : "PRESENT") : "ABSENT",
        lateMinutes,
        overtimeMinutes,
        workedMinutes,
        source: "MANUAL",
      },
    });
  }

  return prisma.attendanceCorrection.update({
    where: { id: correction.id },
    data: {
      status: decision,
      reviewedById: user.id,
      reviewNote: reviewNote ?? null,
      reviewedAt: new Date(),
    },
  });
}

export const ZERO_MINUTES = ZERO;
