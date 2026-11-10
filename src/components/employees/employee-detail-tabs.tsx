"use client";

import Link from "next/link";
import { Activity, Banknote, CalendarDays, Clock, FileText, Plane, UserRound, Briefcase } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { value: "overview", label: "Ringkasan", icon: UserRound },
  { value: "employment", label: "Kepegawaian", icon: Briefcase },
  { value: "attendance", label: "Kehadiran", icon: Clock },
  { value: "leave", label: "Cuti", icon: Plane },
  { value: "payroll", label: "Payroll", icon: Banknote },
  { value: "documents", label: "Dokumen", icon: FileText },
  { value: "activity", label: "Aktivitas", icon: Activity },
];

export function EmployeeDetailTabs({ employeeId, active }: { employeeId: string; active: string }) {
  return (
    <div className="overflow-x-auto">
      <nav className="inline-flex h-9 items-center gap-1 rounded-lg border border-border bg-muted/40 p-1" aria-label="Bagian profil karyawan">
        {TABS.map((tab) => (
          <Link
            key={tab.value}
            href={`/employees/${employeeId}?tab=${tab.value}`}
            aria-current={active === tab.value ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] font-medium transition",
              active === tab.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <tab.icon className="size-3.5" />
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
