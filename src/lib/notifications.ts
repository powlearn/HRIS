import { prisma } from "@/lib/prisma";

type NotifyInput = {
  tenantId: string;
  userId?: string | null;
  employeeId?: string | null;
  type?: "INFO" | "APPROVAL" | "ALERT" | "SYSTEM";
  title: string;
  body?: string;
  href?: string;
};

/**
 * Creates an in-app notification for a user, resolving the linked user account
 * from an employee when needed. Never throws into the calling request.
 */
export async function notifyUser(input: NotifyInput): Promise<void> {
  try {
    let userId = input.userId ?? null;
    if (!userId && input.employeeId) {
      const employee = await prisma.employee.findFirst({
        where: { id: input.employeeId, tenantId: input.tenantId },
        select: { userId: true },
      });
      userId = employee?.userId ?? null;
    }
    if (!userId) return;
    await prisma.notification.create({
      data: {
        tenantId: input.tenantId,
        userId,
        type: input.type ?? "INFO",
        title: input.title,
        body: input.body,
        href: input.href,
      },
    });
  } catch (error) {
    console.error("[notifications] failed to create notification", error);
  }
}

export async function notifyRole(tenantId: string, roleSlug: string, input: Omit<NotifyInput, "tenantId" | "userId">) {
  const users = await prisma.user.findMany({
    where: { tenantId, role: { slug: roleSlug } },
    select: { id: true },
  });
  for (const user of users) {
    await notifyUser({ ...input, tenantId, userId: user.id });
  }
}
