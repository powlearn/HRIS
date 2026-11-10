"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock, Loader2, LogIn, LogOut, MapPin, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ATTENDANCE_STATUS } from "@/lib/design";
import { cn } from "@/lib/utils";

type TodayState = {
  employee: { id: string; name: string; department: string | null; position: string | null; location: { id: string; name: string; radius: number } | null };
  schedule: { name: string; startTime: string; endTime: string; graceMinutes: number };
  record: {
    id: string;
    clockIn: string | null;
    clockOut: string | null;
    status: string;
    lateMinutes: number;
    overtimeMinutes: number;
    workedMinutes: number;
    geofencePassed: boolean | null;
    distanceMeters: number | null;
  } | null;
  policy: { geofenceRequired?: boolean; remoteAllowed?: boolean };
};

function timeString(date: Date) {
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Jakarta" }).format(date);
}

export function AttendanceClock() {
  const router = useRouter();
  const [state, setState] = React.useState<TodayState | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/v1/attendance/today", { cache: "no-store" });
      const payload = (await res.json()) as { data?: TodayState; error?: { message: string } };
      if (!res.ok) {
        setError(payload.error?.message ?? "Tidak dapat memuat data absensi.");
        return;
      }
      setState(payload.data ?? null);
      setError(null);
    } catch {
      setError("Tidak dapat menghubungi server.");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function getPosition(): Promise<{ latitude?: number; longitude?: number; accuracyMeters?: number }> {
    if (!navigator.geolocation) return {};
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) =>
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Math.round(position.coords.accuracy),
          }),
        () => resolve({}),
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
      );
    });
  }

  async function submit(action: "clock-in" | "clock-out") {
    setPending(true);
    try {
      const position = await getPosition();
      const res = await fetch(`/api/v1/attendance/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(position),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Absensi gagal.");
        return;
      }
      toast.success(action === "clock-in" ? "Clock-in berhasil dicatat." : "Clock-out berhasil dicatat.");
      await load();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <ShieldAlert className="size-4 text-warning" /> Absensi tidak tersedia
        </div>
        <p className="mt-1 text-[12px] text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-card p-5">
        <div className="shimmer h-3 w-24 rounded" />
        <div className="shimmer h-8 w-32 rounded" />
        <div className="shimmer h-9 w-full rounded-lg" />
      </div>
    );
  }

  const statusMeta = state.record ? ATTENDANCE_STATUS[state.record.status] : null;
  const canClockIn = !state.record?.clockIn;
  const canClockOut = Boolean(state.record?.clockIn) && !state.record?.clockOut;

  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-primary/8 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Absensi hari ini</p>
          <p className="numeric mt-1 text-2xl font-semibold tracking-tight">{now ? timeString(now) : "--:--:--"} <span className="text-xs font-normal text-muted-foreground">WIB</span></p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {/\d{2}[:.]\d{2}/.test(state.schedule.name)
              ? state.schedule.name
              : `${state.schedule.name} · ${state.schedule.startTime}–${state.schedule.endTime}`}
            {" · toleransi "}
            {state.schedule.graceMinutes} mnt
          </p>
        </div>
        {statusMeta ? <Badge variant={statusMeta.tone} dot>{statusMeta.label}</Badge> : <Badge variant="outline">Belum absen</Badge>}
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg border border-border/70 bg-muted/40 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Clock-in</p>
          <p className="numeric text-[13px] font-semibold">
            {state.record?.clockIn ? new Date(state.record.clockIn).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/70 bg-muted/40 px-2 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Clock-out</p>
          <p className="numeric text-[13px] font-semibold">
            {state.record?.clockOut ? new Date(state.record.clockOut).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—"}
          </p>
        </div>
      </div>

      {state.record?.clockIn ? (
        <div className="relative mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span className={cn("inline-flex items-center gap-1", state.record.geofencePassed ? "text-success" : "")}>
            <MapPin className="size-3" />
            {state.record.geofencePassed === true
              ? `Terverifikasi lokasi (${state.record.distanceMeters} m)`
              : state.record.geofencePassed === false
                ? "Di luar area kantor"
                : "Lokasi tidak tersedia"}
          </span>
          {state.record.lateMinutes > 0 ? <span className="text-warning">Terlambat {state.record.lateMinutes} menit</span> : null}
        </div>
      ) : null}

      <div className="relative mt-4 flex gap-2">
        <Button className="flex-1" onClick={() => submit("clock-in")} disabled={!canClockIn || pending}>
          {pending && canClockIn ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {canClockIn ? "Clock-in" : "Sudah clock-in"}
        </Button>
        <Button variant="outline" className="flex-1" onClick={() => submit("clock-out")} disabled={!canClockOut || pending}>
          {pending && canClockOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
          {state.record?.clockOut ? "Sudah clock-out" : "Clock-out"}
        </Button>
      </div>
      <p className="relative mt-2.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
        <Clock className="mt-px size-3 shrink-0" />
        Lokasi perangkat membantu verifikasi, tetapi tidak anti-manipulasi. Koreksi manual tetap memerlukan persetujuan atasan.
      </p>
    </div>
  );
}
