import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiRoute, readJson } from "@/lib/api";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { sendMail, passwordResetEmail } from "@/lib/mail";
import { writeAudit } from "@/lib/audit";

const schema = z.object({ email: z.string().trim().toLowerCase().email() });

export const POST = apiRoute({
  auth: false,
  handler: async ({ req }) => {
    const ip = clientIp(req.headers);
    const ipLimit = rateLimit(`forgot:ip:${ip}`, 5, 15 * 60_000);

    const { email } = schema.parse(await readJson(req));
    const emailLimit = rateLimit(`forgot:email:${email}`, 3, 15 * 60_000);
    if (!ipLimit.success || !emailLimit.success) {
      return NextResponse.json(
        { error: { message: "Terlalu banyak permintaan. Coba lagi dalam 15 menit.", code: "RATE_LIMITED" } },
        { status: 429 },
      );
    }

    const user = await prisma.user.findUnique({ where: { email }, include: { tenant: true } });

    // Always answer success to avoid account enumeration.
    if (!user || !user.tenant) return { submitted: true };

    const rawToken = randomBytes(32).toString("base64url");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expires = new Date(Date.now() + 30 * 60_000);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordResetToken: tokenHash, passwordResetExpires: expires },
    });

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
    const mail = passwordResetEmail(user.name, resetUrl);
    await sendMail({ ...mail, to: user.email });

    await writeAudit({
      tenantId: user.tenantId,
      actorId: user.id,
      actorName: user.name,
      action: "auth.password_reset_requested",
      module: "autentikasi",
      entityType: "User",
      entityId: user.id,
      req,
    });

    const isDevConsole = process.env.NODE_ENV !== "production" && (process.env.MAIL_DRIVER ?? "console") === "console";
    return { submitted: true, ...(isDevConsole ? { devResetUrl: resetUrl } : {}) };
  },
});
