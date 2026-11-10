"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/primitives";
import { Badge } from "@/components/ui/badge";
import { PERMISSIONS } from "@/lib/rbac";
import { cn } from "@/lib/utils";

type RoleRow = { id: string; name: string; slug: string; description: string | null; permissions: string[]; users: number };

export function RoleMatrix({ roles }: { roles: RoleRow[] }) {
  const router = useRouter();
  const [selectedRoleId, setSelectedRoleId] = React.useState(roles.find((role) => role.slug !== "super_admin")?.id ?? roles[0]?.id ?? "");
  const selected = roles.find((role) => role.id === selectedRoleId);
  const [keys, setKeys] = React.useState<Set<string>>(new Set(selected?.permissions ?? []));
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setKeys(new Set(roles.find((role) => role.id === selectedRoleId)?.permissions ?? []));
  }, [selectedRoleId, roles]);

  const readonly = selected?.slug === "super_admin";
  const isWildcard = keys.has("*");

  const modules = React.useMemo(() => {
    const grouped = new Map<string, typeof PERMISSIONS>();
    for (const permission of PERMISSIONS) {
      if (permission.key === "*") continue;
      const list = grouped.get(permission.module) ?? [];
      list.push(permission);
      grouped.set(permission.module, list);
    }
    return [...grouped.entries()];
  }, []);

  function toggle(key: string) {
    setKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/settings/roles/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: [...keys] }),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal menyimpan izin.");
        return;
      }
      toast.success("Izin peran diperbarui. Perubahan berlaku pada sesi berikutnya.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
      <div className="space-y-1.5">
        {roles.map((role) => (
          <button
            key={role.id}
            type="button"
            onClick={() => setSelectedRoleId(role.id)}
            className={cn(
              "w-full rounded-lg border px-3 py-2 text-left transition",
              selectedRoleId === role.id ? "border-primary/30 bg-primary/5" : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium">{role.name}</span>
              <span className="text-[10px] text-muted-foreground">{role.users} pengguna</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{role.description ?? role.slug}</p>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <div>
              <p className="text-[12px] font-semibold">{selected?.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {isWildcard ? "Akses penuh platform" : `${keys.size} izin aktif`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {readonly ? <Badge variant="outline">Hanya baca</Badge> : null}
            <Button size="sm" onClick={save} disabled={readonly || saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan izin
            </Button>
          </div>
        </div>

        {isWildcard ? (
          <div className="rounded-lg border border-success/25 bg-success/5 p-3 text-[12px]">
            Peran ini memiliki wildcard <code className="font-mono">*</code> — akses penuh termasuk modul baru. Wildcard
            hanya dapat dikelola pada tingkat platform.
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-2">
          {modules.map(([module, permissions]) => (
            <div key={module} className="rounded-lg border border-border bg-card p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[11px] font-semibold capitalize">{module}</p>
                <button
                  type="button"
                  onClick={() => {
                    if (readonly) return;
                    const allSelected = permissions.every((permission) => keys.has(permission.key));
                    setKeys((previous) => {
                      const next = new Set(previous);
                      for (const permission of permissions) {
                        if (allSelected) next.delete(permission.key);
                        else next.add(permission.key);
                      }
                      return next;
                    });
                  }}
                  className="text-[10px] text-primary hover:underline"
                >
                  {permissions.every((permission) => keys.has(permission.key)) ? "Hapus semua" : "Pilih semua"}
                </button>
              </div>
              <div className="space-y-1">
                {permissions.map((permission) => (
                  <label key={permission.key} className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 hover:bg-muted/50">
                    <Checkbox
                      checked={keys.has(permission.key)}
                      onCheckedChange={() => toggle(permission.key)}
                      disabled={readonly}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="block text-[11px] font-medium">{permission.label}</span>
                      <span className="block font-mono text-[9px] text-muted-foreground">{permission.key}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground">
          Izin disimpan pada tabel RolePermission dan divalidasi ulang di server pada setiap permintaan. Menyimpan
          perubahan tidak otomatis memperbarui sesi aktif.
        </p>
      </div>
    </div>
  );
}
