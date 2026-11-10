"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/primitives";

export function AiSettingsForm({
  initial,
  envReady,
}: {
  initial: { enabled: boolean; allowConfidentialData: boolean; model: string };
  envReady: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = React.useState(initial.enabled);
  const [allowConfidential, setAllowConfidential] = React.useState(initial.allowConfidentialData);
  const [model, setModel] = React.useState(initial.model);
  const [saving, setSaving] = React.useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/v1/settings/ai", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, allowConfidentialData: allowConfidential, model }),
      });
      const payload = (await res.json()) as { error?: { message: string } };
      if (!res.ok) {
        toast.error(payload.error?.message ?? "Gagal menyimpan konfigurasi AI.");
        return;
      }
      toast.success("Konfigurasi AI disimpan.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <p className="text-[12px] font-medium">Aktifkan AI Copilot untuk tenant</p>
          <p className="text-[10px] text-muted-foreground">
            Memerlukan AI_ENABLED=true dan AI_API_KEY pada server. Tanpa kredensial, copilot tetap berjalan dalam mode lokal.
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!envReady} aria-label="Aktifkan AI" />
      </div>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-border p-3">
        <div>
          <p className="text-[12px] font-medium">Izinkan konteks data operasional</p>
          <p className="text-[10px] text-muted-foreground">
            Jika aktif, ringkasan agregat (bukan NIK/rekening/gaji individu) dapat dikirim ke penyedia AI. Memerlukan
            AI_ALLOW_CONFIDENTIAL_DATA=true pada server.
          </p>
        </div>
        <Switch checked={allowConfidential} onCheckedChange={setAllowConfidential} disabled={!enabled} aria-label="Izinkan data" />
      </div>

      <div className="space-y-1">
        <Label htmlFor="model">Model</Label>
        <Input id="model" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o-mini" />
        <p className="text-[10px] text-muted-foreground">Nama model mengikuti penyedia OpenAI-compatible yang dikonfigurasi server.</p>
      </div>

      {!envReady ? (
        <p className="rounded-md bg-muted/60 p-2 text-[10px] leading-relaxed text-muted-foreground">
          Kredensial penyedia belum tersedia. Administrator platform perlu mengatur variabel lingkungan; kunci tidak pernah
          disimpan di database atau dikirim ke browser.
        </p>
      ) : null}

      <Button size="sm" onClick={save} disabled={saving}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Simpan konfigurasi
      </Button>
    </div>
  );
}
