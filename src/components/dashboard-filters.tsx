"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Building2, CalendarRange, MapPin, RotateCcw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };

export function DashboardFilters({
  month,
  year,
  departmentId,
  locationId,
  departments,
  locations,
}: {
  month: number;
  year: number;
  departmentId?: string;
  locationId?: string;
  departments: Option[];
  locations: Option[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();

  const months = React.useMemo(() => {
    const now = new Date();
    return Array.from({ length: 9 }).map((_, index) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      return {
        value: `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}`,
        label: new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric", timeZone: "UTC" }).format(date),
      };
    });
  }, []);

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (!value || value === "all") params.delete(key);
    else params.set(key, value);
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  const isFiltered = Boolean(departmentId || locationId || searchParams.get("month"));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={`${year}-${month}`} onValueChange={(value) => {
        const [nextYear, nextMonth] = value.split("-");
        const params = new URLSearchParams(searchParams.toString());
        params.set("month", value);
        startTransition(() => router.push(`${pathname}?${params.toString()}`));
      }}>
        <SelectTrigger className="h-8 w-[168px] text-[12px]">
          <CalendarRange className="size-3.5 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {months.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={departmentId ?? "all"} onValueChange={(value) => update("departmentId", value)}>
        <SelectTrigger className="h-8 w-[188px] text-[12px]">
          <Building2 className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="Semua departemen" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua departemen</SelectItem>
          {departments.map((department) => (
            <SelectItem key={department.id} value={department.id}>
              {department.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={locationId ?? "all"} onValueChange={(value) => update("locationId", value)}>
        <SelectTrigger className="h-8 w-[172px] text-[12px]">
          <MapPin className="size-3.5 text-muted-foreground" />
          <SelectValue placeholder="Semua lokasi" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Semua lokasi</SelectItem>
          {locations.map((location) => (
            <SelectItem key={location.id} value={location.id}>
              {location.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isFiltered ? (
        <Button variant="ghost" size="xs" onClick={() => router.push(pathname)} disabled={pending}>
          <RotateCcw className="size-3" /> Reset
        </Button>
      ) : null}
    </div>
  );
}
