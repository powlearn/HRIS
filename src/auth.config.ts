import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js configuration shared by the middleware and the Node
 * runtime. Providers that need Prisma/bcrypt are added in `src/lib/auth.ts`.
 */
export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8 hours absolute session lifetime
    updateAge: 60 * 15,
  },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-nexahr.session" : "nexahr.session",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        const u = user as typeof user & {
          tenantId?: string | null;
          tenantName?: string | null;
          roleSlug?: string;
          roleName?: string;
          permissions?: string[];
          sessionVersion?: number;
          employeeId?: string | null;
          timezone?: string;
          mustChangePassword?: boolean;
        };
        token.uid = u.id;
        token.tenantId = u.tenantId ?? null;
        token.tenantName = u.tenantName ?? null;
        token.roleSlug = u.roleSlug ?? "employee";
        token.roleName = u.roleName ?? "Karyawan";
        token.permissions = u.permissions ?? [];
        token.sessionVersion = u.sessionVersion ?? 0;
        token.employeeId = u.employeeId ?? null;
        token.timezone = u.timezone ?? "Asia/Jakarta";
        token.mustChangePassword = u.mustChangePassword ?? false;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.uid as string) ?? session.user.id;
        session.user.tenantId = (token.tenantId as string | null) ?? null;
        session.user.tenantName = (token.tenantName as string | null) ?? null;
        session.user.roleSlug = (token.roleSlug as string) ?? "employee";
        session.user.roleName = (token.roleName as string) ?? "Karyawan";
        session.user.permissions = (token.permissions as string[]) ?? [];
        session.user.employeeId = (token.employeeId as string | null) ?? null;
        session.user.timezone = (token.timezone as string) ?? "Asia/Jakarta";
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.sessionVersion = (token.sessionVersion as number) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
