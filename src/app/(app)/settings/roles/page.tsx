import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { RoleMatrix } from "@/components/settings/role-matrix";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Peran & Izin" };
export const dynamic = "force-dynamic";

export default async function RolesSettingsPage() {
  const user = await requirePage("settings.read");

  const roles = await prisma.role.findMany({
    where: { OR: [{ tenantId: user.tenantId }, { tenantId: null }] },
    orderBy: { level: "desc" },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: { where: { tenantId: user.tenantId } } } },
    },
  });

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistem"
        title="Peran & izin"
        description="Atur izin per modul dan aksi. Setiap perubahan dicatat pada audit log dan ditegakkan di server."
      />
      <SettingsNav />
      <RoleMatrix
        roles={roles.map((role) => ({
          id: role.id,
          name: role.name,
          slug: role.slug,
          description: role.description,
          permissions: role.permissions.map((rp) => rp.permission.key),
          users: role._count.users,
        }))}
      />
    </div>
  );
}
