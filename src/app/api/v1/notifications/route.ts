import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api";

export const GET = apiRoute({
  handler: async ({ user, tenantId }) => {
    const [items, unread] = await Promise.all([
      prisma.notification.findMany({
        where: { tenantId, userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      prisma.notification.count({ where: { tenantId, userId: user.id, readAt: null } }),
    ]);
    return { items, unread };
  },
});
