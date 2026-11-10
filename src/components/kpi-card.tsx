import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  tone = "default",
  footer,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  delta?: { value: number; label?: string; invert?: boolean };
  tone?: "default" | "primary" | "warning" | "danger" | "success";
  footer?: React.ReactNode;
  className?: string;
}) {
  const toneStyles = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-[color-mix(in_oklch,var(--warning)_16%,transparent)] text-[color-mix(in_oklch,var(--warning)_70%,var(--foreground))]",
    danger: "bg-destructive/10 text-destructive",
    success: "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[color-mix(in_oklch,var(--success)_78%,var(--foreground))]",
  }[tone];

  const positive = (delta?.value ?? 0) > 0;
  const neutral = (delta?.value ?? 0) === 0;
  const good = delta?.invert ? !positive : positive;
  const DeltaIcon = neutral ? Minus : positive ? ArrowUpRight : ArrowDownRight;

  return (
    <div className={cn("group relative overflow-hidden rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_-1px_rgba(16,24,40,0.06)]", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[12px] font-medium text-muted-foreground">{label}</p>
          <p className="numeric text-[26px] font-semibold leading-tight tracking-[-0.02em]">{value}</p>
        </div>
        {Icon ? (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", toneStyles)}>
            <Icon className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        {delta ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[11px] font-medium",
              neutral
                ? "bg-muted text-muted-foreground"
                : good
                  ? "bg-[color-mix(in_oklch,var(--success)_14%,transparent)] text-[color-mix(in_oklch,var(--success)_80%,var(--foreground))]"
                  : "bg-destructive/10 text-destructive",
            )}
          >
            <DeltaIcon className="size-3" />
            {Math.abs(delta.value)}%
          </span>
        ) : null}
        {hint ? <p className="truncate text-[11px] text-muted-foreground">{hint}</p> : null}
      </div>
      {footer ? <div className="mt-3 border-t border-border/60 pt-2.5">{footer}</div> : null}
    </div>
  );
}

export function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="numeric font-medium">{value}</span>
    </div>
  );
}
