import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { hasPermission, type PermissionKey } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roleSlug: string;
  roleName: string;
  permissions: string[];
  employeeId: string | null;
  timezone: string;
};

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, options: { code?: string; details?: unknown } = {}) {
    super(message);
    this.status = status;
    this.code = options.code ?? (status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "ERROR");
    this.details = options.details;
  }
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status });
}

export function apiFailure(message: string, status = 400, code = "ERROR", details?: unknown) {
  return NextResponse.json({ error: { message, code, details } }, { status });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId) return null;

  // Validate the session against the database so deleted, suspended or
  // revoked accounts cannot keep using a still-valid JWT.
  const account = await prisma.user.findFirst({
    where: { id: session.user.id, tenantId: session.user.tenantId },
    select: { status: true, sessionVersion: true, tenant: { select: { status: true } } },
  });
  if (
    !account ||
    account.status !== "ACTIVE" ||
    account.tenant?.status === "SUSPENDED" ||
    account.sessionVersion !== session.user.sessionVersion
  ) {
    return null;
  }

  return {
    id: session.user.id,
    name: session.user.name ?? "",
    email: session.user.email ?? "",
    tenantId: session.user.tenantId,
    tenantName: session.user.tenantName ?? "",
    roleSlug: session.user.roleSlug,
    roleName: session.user.roleName,
    permissions: session.user.permissions,
    employeeId: session.user.employeeId,
    timezone: session.user.timezone,
  };
}

/** Pages: returns the authenticated user or throws a redirect-friendly error. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Sesi tidak valid. Silakan masuk kembali.", { code: "UNAUTHORIZED" });
  return user;
}

export function assertPermission(user: SessionUser, required: PermissionKey | PermissionKey[]) {
  const ok = Array.isArray(required)
    ? required.some((key) => hasPermission(user.permissions, key))
    : hasPermission(user.permissions, required);
  if (!ok) {
    throw new ApiError(403, "Anda tidak memiliki izin untuk tindakan ini.", { code: "FORBIDDEN" });
  }
}

export async function assertOwnEmployee(user: SessionUser): Promise<string> {
  if (!user.employeeId) {
    throw new ApiError(403, "Akun ini tidak terhubung ke data karyawan.", { code: "NO_EMPLOYEE_PROFILE" });
  }
  // Confirm the employee still belongs to the session tenant (defence in depth).
  const employee = await prisma.employee.findFirst({
    where: { id: user.employeeId, tenantId: user.tenantId },
    select: { id: true },
  });
  if (!employee) throw new ApiError(403, "Profil karyawan tidak ditemukan pada tenant ini.");
  return employee.id;
}

export function parsePagination(searchParams: URLSearchParams) {
  const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(searchParams.get("pageSize") ?? 20) || 20));
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

type HandlerContext<P> = {
  req: NextRequest;
  params: P;
  user: SessionUser;
  tenantId: string;
};

type RouteOptions<P> = {
  permission?: PermissionKey | PermissionKey[];
  auth?: boolean;
  handler: (ctx: HandlerContext<P>) => Promise<unknown>;
};

/**
 * Wraps a Route Handler with authentication, permission checks, tenant context
 * and uniform error serialization. `tenantId` always comes from the session,
 * never from the request body or query string.
 */
export function apiRoute<P extends Record<string, string> = Record<string, string>>(options: RouteOptions<P>) {
  const requireAuth = options.auth !== false;
  return async function route(req: NextRequest, ctx: { params: Promise<P> }): Promise<NextResponse> {
    try {
      const params = ctx?.params ? await ctx.params : ({} as P);
      if (!requireAuth) {
        const result = await options.handler({
          req,
          params,
          user: null as unknown as SessionUser,
          tenantId: "",
        });
        if (result instanceof NextResponse) return result;
        return NextResponse.json({ data: result });
      }

      const user = await getSessionUser();
      if (!user) throw new ApiError(401, "Sesi tidak valid. Silakan masuk kembali.", { code: "UNAUTHORIZED" });
      if (options.permission) assertPermission(user, options.permission);

      const result = await options.handler({ req, params, user, tenantId: user.tenantId });
      if (result instanceof NextResponse) return result;
      if (result === undefined) return new NextResponse(null, { status: 204 });
      return NextResponse.json({ data: result });
    } catch (error) {
      return handleRouteError(error);
    }
  };
}

export function handleRouteError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return apiFailure(error.message, error.status, error.code, error.details);
  }
  if (error instanceof ZodError) {
    return apiFailure("Data yang dikirim tidak valid.", 422, "VALIDATION_ERROR", error.flatten());
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return apiFailure("Data dengan nilai unik tersebut sudah ada.", 409, "DUPLICATE", error.meta);
    }
    if (error.code === "P2025") {
      return apiFailure("Data tidak ditemukan.", 404, "NOT_FOUND");
    }
    if (error.code === "P2003") {
      return apiFailure("Data masih direferensikan oleh catatan lain.", 409, "FOREIGN_KEY");
    }
  }
  console.error("[api] unhandled error", error);
  return apiFailure("Terjadi kesalahan pada server.", 500, "INTERNAL");
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "Body permintaan harus berupa JSON yang valid.");
  }
}
