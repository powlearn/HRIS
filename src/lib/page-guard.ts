import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "@/lib/api";
import { hasPermission, type PermissionKey } from "@/lib/rbac";

/** Page-level guard: authentication + optional permission, redirecting on failure. */
export async function requirePage(permission?: PermissionKey | PermissionKey[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (permission) {
    const allowed = Array.isArray(permission)
      ? permission.some((key) => hasPermission(user.permissions, key))
      : hasPermission(user.permissions, permission);
    if (!allowed) redirect("/forbidden");
  }
  return user;
}
