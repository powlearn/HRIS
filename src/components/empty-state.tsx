import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
      <div className="flex size-11 items-center justify-center rounded-xl border border-border bg-muted/60">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description ? <p className="mx-auto max-w-sm text-[13px] text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = "Terjadi kesalahan", description }: { title?: string; description?: string }) {
  return (
    <div className="surface flex flex-col items-center gap-2 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-destructive">{title}</p>
      <p className="max-w-md text-[13px] text-muted-foreground">
        {description ?? "Muat ulang halaman. Jika masalah berlanjut, hubungi administrator sistem."}
      </p>
    </div>
  );
}
