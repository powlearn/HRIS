"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, KeyRound, ScrollText, Settings2, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/settings", label: "Ringkasan", icon: Settings2, exact: true },
  { href: "/settings/organization", label: "Organisasi", icon: Building2 },
  { href: "/settings/roles", label: "Peran & izin", icon: KeyRound },
  { href: "/settings/payroll", label: "Payroll", icon: Wallet },
  { href: "/settings/ai", label: "AI Copilot", icon: Sparkles },
  { href: "/settings/audit", label: "Audit log", icon: ScrollText },
];

export function SettingsNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1.5 text-[12px] font-medium transition",
              active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="size-3.5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
