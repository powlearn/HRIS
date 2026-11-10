"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function MarkAllRead({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);

  async function markAll() {
    setPending(true);
    try {
      const res = await fetch("/api/v1/notifications/read-all", { method: "POST" });
      if (!res.ok) {
        toast.error("Gagal menandai notifikasi.");
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button size="sm" variant="outline" onClick={markAll} disabled={disabled || pending}>
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCheck className="size-3.5" />} Tandai semua dibaca
    </Button>
  );
}
