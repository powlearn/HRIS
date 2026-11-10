import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, History, Lock, ShieldCheck, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { CopilotChat } from "@/components/ai/copilot-chat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requirePage } from "@/lib/page-guard";
import { getCopilotStatus } from "@/modules/ai/service";
import { formatDateTime } from "@/lib/time";
import { hasPermission } from "@/lib/rbac";

export const metadata: Metadata = { title: "AI HR Copilot" };
export const dynamic = "force-dynamic";

export default async function AiPage() {
  const user = await requirePage("ai.use");
  const status = await getCopilotStatus(user);
  const canConfigure = hasPermission(user.permissions, "ai.configure");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pertumbuhan"
        title="AI HR Copilot"
        description="Asisten HR yang menghormati izin peran dan batas tenant. Saran AI tidak pernah dijalankan otomatis."
        actions={
          canConfigure ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/ai"><Sparkles className="size-3.5" /> Konfigurasi AI</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <CopilotChat
          suggestions={status.suggestions}
          available={status.runtime.available}
          modelLabel={
            status.runtime.available
              ? `${status.runtime.model} · kebijakan tenant aktif`
              : "Mode lokal deterministik · tanpa kredensial penyedia"
          }
        />

        <div className="space-y-4">
          <Card className={status.runtime.available ? "border-success/25" : "border-warning/25"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {status.runtime.available ? <ShieldCheck className="size-4 text-success" /> : <AlertTriangle className="size-4 text-warning" />}
                Status integrasi
              </CardTitle>
              <CardDescription>{status.runtime.available ? "Penyedia AI aktif dan dapat dihubungi." : "Copilot berjalan tanpa memanggil penyedia eksternal."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={status.runtime.available ? "success" : "warning"}>{status.runtime.available ? "Aktif" : "Nonaktif"}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Model</span>
                <span className="font-mono">{status.runtime.model}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Data rahasia</span>
                <span className="font-medium">{status.runtime.allowConfidential ? "Diizinkan admin" : "Dibatasi"}</span>
              </div>
              {status.runtime.reason ? (
                <p className="rounded-md bg-muted/60 p-2 leading-relaxed text-muted-foreground">{status.runtime.reason}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="size-4 text-muted-foreground" /> Privasi & kepatuhan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-[11px] leading-relaxed text-muted-foreground">
              <p>Konteks yang dikirim hanya agregat tenant. NIK, rekening, dan NPWP tidak pernah dikirim ke penyedia AI.</p>
              <p>AI tidak memiliki jalur untuk menyetujui cuti, memproses payroll, atau mengubah data. Semua aksi memerlukan interaksi manusia dan tercatat di audit log.</p>
              <p>Rate limit 20 pertanyaan per menit per pengguna.</p>
            </CardContent>
          </Card>

          {status.conversations.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><History className="size-4 text-muted-foreground" /> Percakapan terakhir</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {status.conversations.map((conversation) => (
                  <div key={conversation.id} className="rounded-md border border-border/60 px-2 py-1.5">
                    <p className="truncate text-[11px] font-medium">{conversation.title}</p>
                    <p className="truncate text-[10px] text-muted-foreground">{conversation.lastMessage}</p>
                    <p className="text-[9px] text-muted-foreground">{formatDateTime(conversation.updatedAt)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
