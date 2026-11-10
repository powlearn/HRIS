import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      tenantId: string | null;
      tenantName: string | null;
      roleSlug: string;
      roleName: string;
      permissions: string[];
      employeeId: string | null;
      timezone: string;
      mustChangePassword: boolean;
      sessionVersion: number;
    } & DefaultSession["user"];
  }

  interface User {
    tenantId?: string | null;
    tenantName?: string | null;
    roleSlug?: string;
    roleName?: string;
    permissions?: string[];
    sessionVersion?: number;
    employeeId?: string | null;
    timezone?: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    tenantId?: string | null;
    tenantName?: string | null;
    roleSlug?: string;
    roleName?: string;
    permissions?: string[];
    sessionVersion?: number;
    employeeId?: string | null;
    timezone?: string;
    mustChangePassword?: boolean;
  }
}
