"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CorrectionReview({ correctionId }: { correctionId: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<"APPROVED" | "REJECTED" | null>(null);

  async function decide(status: "APPROVED" | "REJECTED") {
    setPending(status);
    try {
      const res = await fetch(`/api/v1/attendance/corrections/${correctionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reviewNote: status === "APPROVED" ? "Koreksi disetujui." : "Koreksi ditolak." }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: { message: string } };
        toast.error(payload.error?.message ?? "Gagal memproses koreksi.");
        return;
      }
      toast.success(status === "APPROVED" ? "Koreksi disetujui." : "Koreksi ditolak.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button size="xs" variant="outline" onClick={() => decide("APPROVED")} disabled={pending !== null}>
        {pending === "APPROVED" ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} Setujui
      </Button>
      <Button size="xs" variant="ghost" onClick={() => decide("REJECTED")} disabled={pending !== null} className="text-destructive">
        {pending === "REJECTED" ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />} Tolak
      </Button>
    </div>
  );
}
