import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium leading-4 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-muted-foreground bg-transparent",
        primary: "border-primary/20 bg-primary/10 text-primary",
        success: "border-transparent bg-[color-mix(in_oklch,var(--success)_16%,transparent)] text-[color-mix(in_oklch,var(--success)_82%,var(--foreground))]",
        warning: "border-transparent bg-[color-mix(in_oklch,var(--warning)_20%,transparent)] text-[color-mix(in_oklch,var(--warning)_70%,var(--foreground))]",
        danger: "border-transparent bg-destructive/10 text-destructive",
        info: "border-transparent bg-[color-mix(in_oklch,var(--chart-2)_16%,transparent)] text-[color-mix(in_oklch,var(--chart-2)_75%,var(--foreground))]",
        neutral: "border-border bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeTone = "primary" | "success" | "warning" | "danger" | "info" | "neutral";

export function Badge({
  className,
  variant,
  dot,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants> & { dot?: boolean }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current opacity-80" /> : null}
      {children}
    </span>
  );
}
