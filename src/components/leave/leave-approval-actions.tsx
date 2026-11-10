"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function LeaveApprovalActions({ requestId, employeeName }: { requestId: string; employeeName: string }) {
  const router = useRouter();
  const [mode, setMode] = React.useState<"approve" | "reject" | null>(null);
  const [comment, setComment] = React.useState("");
  const [pending, setPending] = React.useState(false);

  async function submit() {
    if (!mode) return;
    setPending(true);
    try {
      const res = await fetch(`/api/v1/leave/requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, comment: comment || undefined }),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal memproses pengajuan.");
        return;
      }
      toast.success(mode === "approve" ? "Pengajuan disetujui." : "Pengajuan ditolak.");
      setMode(null);
      setComment("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex gap-1.5">
        <Button size="xs" onClick={() => setMode("approve")}>
          <Check className="size-3" /> Setujui
        </Button>
        <Button size="xs" variant="ghost" className="text-destructive" onClick={() => setMode("reject")}>
          <X className="size-3" /> Tolak
        </Button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(open) => !open && setMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{mode === "approve" ? "Setujui pengajuan" : "Tolak pengajuan"}</DialogTitle>
            <DialogDescription>
              {mode === "approve"
                ? `Pengajuan ${employeeName} akan diteruskan ke tahap berikutnya atau diselesaikan.`
                : `Berikan alasan penolakan agar karyawan memahami keputusan.`}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder="Catatan untuk karyawan (opsional untuk persetujuan)."
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMode(null)} disabled={pending}>Batal</Button>
            <Button onClick={submit} disabled={pending} variant={mode === "reject" ? "destructive" : "default"}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : null}
              {mode === "approve" ? "Setujui pengajuan" : "Tolak pengajuan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
