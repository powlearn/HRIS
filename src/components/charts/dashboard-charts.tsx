"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useMemo } from "react";
import { useTheme } from "next-themes";

const PALETTE = ["#6366f1", "#06b6d4", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#64748b"];

function useAxisColor() {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === "dark" ? "#94a3b8" : "#64748b";
}

const tooltipStyle = {
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--popover)",
  color: "var(--popover-foreground)",
  fontSize: 12,
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export function AttendanceTrendChart({
  data,
}: {
  data: { date: string; present: number; late: number; absent: number; onLeave: number }[];
}) {
  const axisColor = useAxisColor();
  return (
    <ResponsiveContainer width="100%" height={248}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="presentGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366f1" stopOpacity={0.28} />
            <stop offset="100%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" tickFormatter={formatDay} tickLine={false} axisLine={false} minTickGap={24} stroke={axisColor} />
        <YAxis tickLine={false} axisLine={false} width={34} tickFormatter={(value) => String(Math.round(Number(value)))} stroke={axisColor} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelFormatter={(value) => formatDay(String(value))}
          formatter={(value, name) => [value, { present: "Hadir", late: "Terlambat", absent: "Tidak hadir", onLeave: "Cuti" }[String(name)] ?? name]}
        />
        <Area type="monotone" dataKey="present" stroke="#6366f1" strokeWidth={2} fill="url(#presentGradient)" name="present" />
        <Area type="monotone" dataKey="late" stroke="#f59e0b" strokeWidth={1.5} fill="transparent" name="late" />
        <Area type="monotone" dataKey="absent" stroke="#ef4444" strokeWidth={1.5} fill="transparent" name="absent" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function DepartmentDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = useMemo(() => data.reduce((acc, item) => acc + item.value, 0), [data]);
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={248}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2} strokeWidth={0}>
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [`${value} karyawan`, name]} />
          <Legend
            verticalAlign="bottom"
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
            formatter={(value) => <span style={{ color: "var(--muted-foreground)" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-x-0 top-[44%] -translate-y-1/2 text-center">
        <p className="numeric text-xl font-semibold">{total}</p>
        <p className="text-[10px] text-muted-foreground">karyawan aktif</p>
      </div>
    </div>
  );
}

export function TurnoverChart({ data }: { data: { label: string; turnover: number; hires: number; exits: number }[] }) {
  const axisColor = useAxisColor();
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={2}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} stroke={axisColor} />
        <YAxis tickLine={false} axisLine={false} stroke={axisColor} width={46} tickFormatter={(value) => `${Number(value).toFixed(1)}%`} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [
            name === "turnover" ? `${value}%` : value,
            { turnover: "Turnover", hires: "Karyawan baru", exits: "Keluar" }[String(name)] ?? name,
          ]}
        />
        <Bar dataKey="turnover" fill="#6366f1" radius={[4, 4, 0, 0]} name="turnover" maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PayrollTrendChart({ data }: { data: { label: string; net: number }[] }) {
  const axisColor = useAxisColor();
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <XAxis dataKey="label" tickLine={false} axisLine={false} stroke={axisColor} />
        <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={(v) => `${Math.round(Number(v) / 1_000_000)} jt`} stroke={axisColor} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Number(value)), "Gaji bersih"]}
        />
        <Line type="monotone" dataKey="net" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: "#10b981" }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function LeaveCategoryChart({ data }: { data: { name: string; value: number }[] }) {
  const axisColor = useAxisColor();
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 12, left: 8, bottom: 0 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={108} tickLine={false} axisLine={false} stroke={axisColor} />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value} pengajuan`, "Jumlah"]} />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={PALETTE[index % PALETTE.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
