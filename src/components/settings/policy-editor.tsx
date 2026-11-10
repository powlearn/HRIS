"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PolicyEditor({
  initialConfig,
  initialName,
}: {
  initialConfig: unknown;
  initialName: string;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(`${initialName} (revisi)`);
  const [effectiveFrom, setEffectiveFrom] = React.useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = React.useState("");
  const [json, setJson] = React.useState(JSON.stringify(initialConfig, null, 2));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        setError("JSON tidak valid. Periksa tanda kutip dan koma.");
        return;
      }
      const res = await fetch("/api/v1/settings/payroll-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, effectiveFrom, notes, config: parsed }),
      });
      const payload = (await res.json()) as { error?: { message: string; details?: unknown }; data?: { version: number } };
      if (!res.ok) {
        setError(payload.error?.message ?? "Gagal menyimpan kebijakan. Periksa struktur konfigurasi.");
        return;
      }
      toast.success(`Kebijakan versi ${payload.data?.version} aktif.`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="policyName">Nama kebijakan</Label>
          <Input id="policyName" value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="effectiveFrom">Berlaku sejak</Label>
          <Input id="effectiveFrom" type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Catatan perubahan</Label>
        <Textarea id="notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Dasar perubahan tarif/kebijakan." />
      </div>
      <div className="space-y-1">
        <Label htmlFor="config">Konfigurasi (JSON)</Label>
        <Textarea
          id="config"
          rows={14}
          value={json}
          onChange={(event) => setJson(event.target.value)}
          className="font-mono text-[11px] leading-relaxed"
          spellCheck={false}
        />
        <p className="text-[10px] text-muted-foreground">
          Skema divalidasi di server (Zod). Semua tarif BPJS, PTKP, dan lapisan PPh 21 berasal dari sini — tidak ada tarif
          yang di-hardcode pada kode perhitungan.
        </p>
      </div>
      {error ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/5 p-2 text-[11px] text-destructive">
          <ShieldAlert className="mt-0.5 size-3.5 shrink-0" /> {error}
        </div>
      ) : null}
      <Button type="submit" size="sm" disabled={saving}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan versi baru
      </Button>
    </form>
  );
}
