"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { APPLICATION_STAGE } from "@/lib/design";

export function StageSelect({ applicationId, stage }: { applicationId: string; stage: string }) {
  const router = useRouter();
  const [value, setValue] = React.useState(stage);
  const [pending, setPending] = React.useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    try {
      const res = await fetch(`/api/v1/recruitment/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: next }),
      });
      if (!res.ok) {
        setValue(previous);
        const payload = (await res.json()) as { error?: { message: string } };
        toast.error(payload.error?.message ?? "Gagal memindahkan tahap.");
        return;
      }
      toast.success(`Tahap diubah ke ${APPLICATION_STAGE[next]?.label ?? next}.`);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Select value={value} onValueChange={change} disabled={pending}>
      <SelectTrigger className="h-6 w-[116px] border-none bg-transparent px-1 text-[10px] shadow-none">
        {pending ? <Loader2 className="size-3 animate-spin" /> : <SelectValue />}
      </SelectTrigger>
      <SelectContent>
        {Object.entries(APPLICATION_STAGE).map(([key, meta]) => (
          <SelectItem key={key} value={key}>{meta.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
