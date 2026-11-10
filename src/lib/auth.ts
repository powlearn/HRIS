import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
});

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Kredensial",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Kata sandi", type: "password" },
      },
      async authorize(rawCredentials) {
        const parsed = credentialsSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const { password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          include: {
            role: { include: { permissions: { include: { permission: true } } } },
            tenant: true,
            employee: { select: { id: true } },
          },
        });

        // Always run a hash comparison to keep timing roughly constant and avoid
        // user enumeration through response timing.
        const hash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
        const valid = await bcrypt.compare(password, hash).catch(() => false);
        if (!user || !valid) {
          if (user) {
            const attempts = user.failedAttempts + 1;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                failedAttempts: attempts,
                lockedUntil:
                  attempts >= MAX_FAILED_ATTEMPTS ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : user.lockedUntil,
              },
            });
            await prisma.auditLog.create({
              data: {
                tenantId: user.tenantId,
                actorId: user.id,
                actorName: user.name,
                action: "auth.login_failed",
                module: "autentikasi",
                entityType: "User",
                entityId: user.id,
                metadata: { attempts },
              },
            });
          }
          return null;
        }

        if (user.status !== "ACTIVE") return null;
        if (user.lockedUntil && user.lockedUntil > new Date()) return null;
        if (!user.tenant || user.tenant.status === "SUSPENDED") return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { failedAttempts: 0, lockedUntil: null, lastLoginAt: new Date() },
        });

        await prisma.auditLog.create({
          data: {
            tenantId: user.tenantId,
            actorId: user.id,
            actorName: user.name,
            action: "auth.login_success",
            module: "autentikasi",
            entityType: "User",
            entityId: user.id,
          },
        });

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.avatarUrl,
          tenantId: user.tenantId,
          tenantName: user.tenant.name,
          roleSlug: user.role?.slug ?? "employee",
          roleName: user.role?.name ?? "Karyawan",
          permissions: user.role?.permissions.map((rp) => rp.permission.key) ?? [],
          sessionVersion: user.sessionVersion,
          employeeId: user.employee?.id ?? null,
          timezone: user.tenant.timezone,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
});
