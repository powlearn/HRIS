import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/rate-limit";

type AuditInput = {
  tenantId: string | null;
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  module: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: NextRequest;
};

/** Append-only audit trail. Failures are logged but never block the request. */
export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: input.tenantId,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ? (input.metadata as object) : undefined,
        ipAddress: input.req ? clientIp(input.req.headers) : null,
        userAgent: input.req?.headers.get("user-agent")?.slice(0, 400) ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to write log", error);
  }
}

/** Masks sensitive values before they enter an audit record. */
export function redact<T extends Record<string, unknown>>(input: T, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(input).map(([key, value]) => [key, keys.includes(key) ? "[REDACTED]" : value]),
  );
}
