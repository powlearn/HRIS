import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { AiSettingsForm } from "@/components/settings/ai-settings-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePage } from "@/lib/page-guard";
import { getAiRuntime } from "@/modules/ai/provider";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

export const metadata: Metadata = { title: "Konfigurasi AI" };
export const dynamic = "force-dynamic";

export default async function AiSettingsPage() {
  const user = await requirePage("settings.read");
  const runtime = await getAiRuntime(user.tenantId);
  const setting = await prisma.systemSetting.findUnique({
    where: { tenantId_key: { tenantId: user.tenantId, key: "ai.config" } },
  });
  const config = (setting?.value ?? {}) as { enabled?: boolean; allowConfidentialData?: boolean; model?: string };
  const canConfigure = hasPermission(user.permissions, "ai.configure");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Sistem"
        title="AI HR Copilot"
        description="Kontrol apakah tenant menggunakan model eksternal. Kredensial hanya berasal dari variabel lingkungan server."
      />
      <SettingsNav />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div><CardTitle>Status penyedia</CardTitle><CardDescription>Konfigurasi tingkat platform</CardDescription></div>
              <Badge variant={runtime.available ? "success" : "warning"}>{runtime.available ? "Siap" : "Mode lokal"}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-[11px]">
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">AI_ENABLED</span><span className="font-mono">{process.env.AI_ENABLED === "true" ? "true" : "false"}</span></div>
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">API key</span><span className="font-mono">{runtime.configured ? "terkonfigurasi" : "kosong"}</span></div>
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Base URL</span><span className="max-w-[60%] truncate font-mono">{runtime.baseUrl}</span></div>
            <div className="flex justify-between border-b border-border/50 py-1"><span className="text-muted-foreground">Model aktif</span><span className="font-mono">{runtime.model}</span></div>
            <div className="flex justify-between py-1"><span className="text-muted-foreground">Data rahasia</span><span>{runtime.allowConfidential ? "Diizinkan" : "Dibatasi"}</span></div>
            {runtime.reason ? <p className="rounded-md bg-muted/60 p-2 leading-relaxed text-muted-foreground">{runtime.reason}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Konfigurasi tenant</CardTitle><CardDescription>Perubahan memerlukan izin ai.configure</CardDescription></CardHeader>
          <CardContent>
            {canConfigure ? (
              <AiSettingsForm
                initial={{
                  enabled: config.enabled ?? false,
                  allowConfidentialData: config.allowConfidentialData ?? false,
                  model: config.model ?? runtime.model,
                }}
                envReady={runtime.configured}
              />
            ) : (
              <p className="text-[12px] text-muted-foreground">Anda dapat melihat status tetapi tidak mengubah konfigurasi AI.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Batas keamanan</CardTitle></CardHeader>
        <CardContent className="grid gap-2 text-[11px] leading-relaxed text-muted-foreground sm:grid-cols-3">
          <p className="rounded-md border border-border p-2.5">Respons AI selalu memerlukan peninjauan manusia; tidak ada aksi bisnis otomatis.</p>
          <p className="rounded-md border border-border p-2.5">Konteks dibatasi pada tenant pengguna dan izin perannya; percakapan disimpan per pengguna.</p>
          <p className="rounded-md border border-border p-2.5">AI tidak pernah menerima kredensial, token sesi, atau data payroll individual.</p>
        </CardContent>
      </Card>
    </div>
  );
}
