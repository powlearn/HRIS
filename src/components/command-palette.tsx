"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import {
  ArrowRight,
  CornerDownLeft,
  Search,
  Sparkles,
  UserRound,
} from "lucide-react";
import { ALL_NAV_ITEMS } from "@/components/shell/nav";
import { hasPermission } from "@/lib/rbac";
import { PersonAvatar } from "@/components/ui/primitives";

type SearchEmployee = {
  id: string;
  name: string;
  employeeCode: string;
  department: string | null;
  position: string | null;
};

type SearchResult = {
  employees: SearchEmployee[];
};

export function CommandPalette({
  permissions,
  open,
  onOpenChange,
}: {
  permissions: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchEmployee[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const payload = (await res.json()) as { data: SearchResult };
          setResults(payload.data.employees ?? []);
        }
      } catch {
        /* aborted */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const navigate = React.useCallback(
    (href: string) => {
      onOpenChange(false);
      router.push(href);
    },
    [onOpenChange, router],
  );

  const visibleNav = ALL_NAV_ITEMS.filter((item) => hasPermission(permissions, item.permission));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Pencarian global"
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-[12vh]"
      shouldFilter
    >
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl">
        <div className="flex items-center gap-2 border-b border-border px-3.5">
          <Search className="size-4 text-muted-foreground" />
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Cari karyawan, halaman, atau tindakan…"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="kbd">ESC</kbd>
        </div>
        <Command.List className="max-h-[58vh] overflow-y-auto p-1.5">
          <Command.Empty className="px-3 py-8 text-center text-sm text-muted-foreground">
            {loading ? "Mencari…" : "Tidak ada hasil. Coba kata kunci lain."}
          </Command.Empty>

          {results.length > 0 ? (
            <Command.Group heading="Karyawan" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
              {results.map((employee) => (
                <Command.Item
                  key={employee.id}
                  value={`karyawan ${employee.name} ${employee.employeeCode}`}
                  onSelect={() => navigate(`/employees/${employee.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-muted"
                >
                  <PersonAvatar name={employee.name} className="size-7" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{employee.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {employee.employeeCode}
                      {employee.position ? ` · ${employee.position}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="size-3.5 text-muted-foreground" />
                </Command.Item>
              ))}
            </Command.Group>
          ) : null}

          <Command.Group heading="Navigasi" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            {visibleNav.map((item) => (
              <Command.Item
                key={item.href}
                value={`${item.label} ${item.description}`}
                onSelect={() => navigate(item.href)}
                className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-muted"
              >
                <item.icon className="size-4 text-muted-foreground" />
                <span className="flex-1">{item.label}</span>
                <span className="hidden text-xs text-muted-foreground sm:block">{item.description}</span>
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Group heading="Tindakan cepat" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            <Command.Item
              value="profil saya kehadiran"
              onSelect={() => navigate("/attendance")}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-muted"
            >
              <UserRound className="size-4 text-muted-foreground" />
              Buka absensi saya
            </Command.Item>
            <Command.Item
              value="tanya ai copilot asisten"
              onSelect={() => navigate("/ai")}
              className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm aria-selected:bg-muted"
            >
              <Sparkles className="size-4 text-muted-foreground" />
              Tanya AI HR Copilot
            </Command.Item>
          </Command.Group>
        </Command.List>
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <CornerDownLeft className="size-3" /> untuk membuka
          </span>
          <span className="flex items-center gap-1.5">
            <span className="kbd">↑</span>
            <span className="kbd">↓</span> navigasi
          </span>
        </div>
      </div>
    </Command.Dialog>
  );
}
