"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const schema = z.object({
  selfAssessment: z.string().max(4000).optional(),
  selfScore: z.number().min(1).max(5).optional(),
  managerAssessment: z.string().max(4000).optional(),
  managerScore: z.number().min(1).max(5).optional(),
  strengths: z.string().max(1000).optional(),
  improvements: z.string().max(1000).optional(),
  rating: z.enum(["BELOW_EXPECTATIONS", "MEETS_EXPECTATIONS", "EXCEEDS_EXPECTATIONS", "OUTSTANDING"]).optional(),
});

export function ReviewDialog({
  reviewId,
  kind,
  employeeName,
  initial,
  trigger,
}: {
  reviewId: string;
  kind: "self" | "manager";
  employeeName: string;
  initial?: {
    selfAssessment?: string | null;
    selfScore?: number | null;
    managerAssessment?: string | null;
    managerScore?: number | null;
    strengths?: string | null;
    improvements?: string | null;
    rating?: string | null;
  };
  trigger: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      selfAssessment: initial?.selfAssessment ?? "",
      selfScore: initial?.selfScore ?? undefined,
      managerAssessment: initial?.managerAssessment ?? "",
      managerScore: initial?.managerScore ?? undefined,
      strengths: initial?.strengths ?? "",
      improvements: initial?.improvements ?? "",
      rating: (initial?.rating as z.infer<typeof schema>["rating"]) ?? undefined,
    },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/performance/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...values }),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal menyimpan penilaian.");
        return;
      }
      toast.success(kind === "self" ? "Penilaian diri tersimpan." : "Penilaian manajer tersimpan.");
      setOpen(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div onClick={() => setOpen(true)}>{trigger}</div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent wide>
          <DialogHeader>
            <DialogTitle>{kind === "self" ? "Penilaian diri" : "Penilaian manajer"}</DialogTitle>
            <DialogDescription>
              {employeeName} · {kind === "self" ? "Refleksikan pencapaian dan tantangan Anda." : "Beri penilaian berbasis bukti dan perilaku yang teramati."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            {kind === "self" ? (
              <>
                <div className="space-y-1">
                  <Label htmlFor="selfAssessment">Ringkasan pencapaian</Label>
                  <Textarea id="selfAssessment" rows={4} placeholder="Pencapaian utama, dampak, dan pembelajaran." {...form.register("selfAssessment")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="selfScore">Skor mandiri (1–5)</Label>
                  <Input id="selfScore" type="number" step="0.1" min="1" max="5" {...form.register("selfScore", { valueAsNumber: true })} />
                  <FieldError message={form.formState.errors.selfScore?.message} />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="managerAssessment">Evaluasi manajer</Label>
                  <Textarea id="managerAssessment" rows={4} {...form.register("managerAssessment")} />
                  <FieldError message={form.formState.errors.managerAssessment?.message} />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="managerScore">Skor akhir (1–5)</Label>
                    <Input id="managerScore" type="number" step="0.1" min="1" max="5" {...form.register("managerScore", { valueAsNumber: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Rating</Label>
                    <Select value={form.watch("rating") ?? ""} onValueChange={(value) => form.setValue("rating", value as z.infer<typeof schema>["rating"])}>
                      <SelectTrigger><SelectValue placeholder="Pilih rating" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BELOW_EXPECTATIONS">Di bawah ekspektasi</SelectItem>
                        <SelectItem value="MEETS_EXPECTATIONS">Sesuai ekspektasi</SelectItem>
                        <SelectItem value="EXCEEDS_EXPECTATIONS">Melebihi ekspektasi</SelectItem>
                        <SelectItem value="OUTSTANDING">Istimewa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="strengths">Kekuatan</Label>
                    <Input id="strengths" {...form.register("strengths")} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="improvements">Area perbaikan</Label>
                    <Input id="improvements" {...form.register("improvements")} />
                  </div>
                </div>
              </>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Batal</Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Star className="size-4" />} Simpan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
