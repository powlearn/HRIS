import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const currentUser = await prisma.user.findFirst({
    where: { id: user.id, tenantId: user.tenantId },
    select: { avatarUrl: true },
  });

  const [unreadCount, pendingApprovals] = await Promise.all([
    prisma.notification.count({ where: { tenantId: user.tenantId, userId: user.id, readAt: null } }),
    hasPermission(user.permissions, "leave.approve")
      ? prisma.leaveRequest.count({
          where: {
            tenantId: user.tenantId,
            status: { in: ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW"] },
          },
        })
      : Promise.resolve(0),
  ]);

  return (
    <AppShell
      user={{ ...user, avatarUrl: currentUser?.avatarUrl ?? null }}
      unreadCount={unreadCount}
      pendingApprovals={pendingApprovals}
    >
      {children}
    </AppShell>
  );
}
