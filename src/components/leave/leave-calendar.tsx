"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MONTH_NAMES_ID } from "@/lib/time";
import { cn } from "@/lib/utils";

type LeaveItem = { id: string; name: string; type: string; color: string; start: string; end: string };
type Holiday = { id: string; date: string; name: string };

const DAY_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export function LeaveCalendar({ leaves, holidays }: { leaves: LeaveItem[]; holidays: Holiday[] }) {
  const today = new Date();
  const [cursor, setCursor] = React.useState(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)));

  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const startOffset = (firstDay.getUTCDay() + 6) % 7; // Monday-first
  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const holidayMap = new Map(holidays.map((holiday) => [holiday.date.slice(0, 10), holiday.name]));

  function leavesForDay(day: number) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return leaves.filter((leave) => {
      const start = leave.start.slice(0, 10);
      const end = leave.end.slice(0, 10);
      return key >= start && key <= end;
    });
  }

  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-${String(today.getUTCDate()).padStart(2, "0")}`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-semibold">{MONTH_NAMES_ID[month]} {year}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Bulan sebelumnya"
            onClick={() => setCursor(new Date(Date.UTC(year, month - 1, 1)))}
          >
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setCursor(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)))}
          >
            Hari ini
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Bulan berikutnya"
            onClick={() => setCursor(new Date(Date.UTC(year, month + 1, 1)))}
          >
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((label) => (
          <div key={label} className="pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} className="min-h-[62px] rounded-md" />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayLeaves = leavesForDay(day);
          const isHoliday = holidayMap.has(key);
          const isWeekend = [5, 6].includes(((new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7));
          return (
            <div
              key={key}
              className={cn(
                "min-h-[62px] rounded-md border border-border/60 p-1 text-left",
                isWeekend && "bg-muted/30",
                isHoliday && "border-primary/25 bg-primary/[0.04]",
                key === todayKey && "ring-1 ring-primary/40",
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("numeric text-[10px]", key === todayKey ? "font-semibold text-primary" : "text-muted-foreground")}>{day}</span>
                {isHoliday ? <span className="size-1.5 rounded-full bg-primary/60" /> : null}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayLeaves.slice(0, 2).map((leave) => (
                  <div
                    key={leave.id}
                    title={`${leave.name} · ${leave.type}`}
                    className="truncate rounded px-1 py-0.5 text-[9px] font-medium leading-tight"
                    style={{ background: `${leave.color}1f`, color: leave.color }}
                  >
                    {leave.name.split(" ")[0]}
                  </div>
                ))}
                {dayLeaves.length > 2 ? (
                  <p className="px-1 text-[9px] text-muted-foreground">+{dayLeaves.length - 2} lagi</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {holidays.length > 0 ? (
        <div className="space-y-1 border-t border-border/60 pt-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Hari libur nasional</p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {holidays.slice(0, 6).map((holiday) => (
              <span key={holiday.id} className="text-[10px] text-muted-foreground">
                {new Date(`${holiday.date.slice(0, 10)}T00:00:00Z`).toLocaleDateString("id-ID", { day: "numeric", month: "short", timeZone: "UTC" })} · {holiday.name}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
