"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function OnboardingToggle({ taskId, isCompleted }: { taskId: string; isCompleted: boolean }) {
  const router = useRouter();
  const [done, setDone] = React.useState(isCompleted);
  const [pending, setPending] = React.useState(false);

  async function toggle() {
    setPending(true);
    const next = !done;
    setDone(next);
    try {
      const res = await fetch(`/api/v1/recruitment/onboarding/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isCompleted: next }),
      });
      if (!res.ok) {
        setDone(!next);
        toast.error("Gagal memperbarui checklist.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={done}
      aria-label={done ? "Tandai belum selesai" : "Tandai selesai"}
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded border transition",
        done ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:border-ring/50",
      )}
    >
      {pending ? <Loader2 className="size-3 animate-spin" /> : done ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  );
}
