import { prisma } from "@/lib/prisma";
import { apiRoute } from "@/lib/api";

export const POST = apiRoute<{ id: string }>({
  handler: async ({ user, tenantId, params }) => {
    const result = await prisma.notification.updateMany({
      where: { id: params.id, tenantId, userId: user.id },
      data: { readAt: new Date() },
    });
    return { updated: result.count > 0 };
  },
});
