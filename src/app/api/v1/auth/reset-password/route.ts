import { createHash } from "node:crypto";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ApiError, apiRoute, readJson } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation";
import { writeAudit } from "@/lib/audit";

const schema = z.object({
  token: z.string().min(20, "Token tidak valid"),
  password: passwordSchema,
});

export const POST = apiRoute({
  auth: false,
  handler: async ({ req }) => {
    const limit = rateLimit(`reset:${clientIp(req.headers)}`, 8, 15 * 60_000);
    if (!limit.success) throw new ApiError(429, "Terlalu banyak percobaan. Coba lagi nanti.", { code: "RATE_LIMITED" });

    const { token, password } = schema.parse(await readJson(req));
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const user = await prisma.user.findFirst({
      where: { passwordResetToken: tokenHash, passwordResetExpires: { gt: new Date() } },
    });
    if (!user) throw new ApiError(400, "Tautan reset tidak valid atau sudah kedaluwarsa.", { code: "INVALID_TOKEN" });

    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
        failedAttempts: 0,
        lockedUntil: null,
        sessionVersion: { increment: 1 },
        mustChangePassword: false,
      },
    });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "auth.password_reset_completed",
      module: "autentikasi",
      entityType: "User",
      entityId: user.id,
      req,
    });

    return { reset: true };
  },
});
