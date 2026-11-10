import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api";

export const POST = apiRoute({
  handler: async ({ user, tenantId }) => {
    await prisma.notification.updateMany({
      where: { tenantId, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: true };
  },
});
