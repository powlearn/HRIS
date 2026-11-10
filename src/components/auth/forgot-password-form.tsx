"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";

const schema = z.object({ email: z.string().email("Masukkan email yang valid") });

export function ForgotPasswordForm() {
  const [sent, setSent] = React.useState(false);
  const [devUrl, setDevUrl] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const payload = (await res.json()) as { data?: { devResetUrl?: string } };
      setDevUrl(payload.data?.devResetUrl ?? null);
      setSent(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/8 p-4">
          <CheckCircle2 className="mt-0.5 size-4 text-success" />
          <div className="space-y-1 text-[13px]">
            <p className="font-medium text-foreground">Permintaan diproses</p>
            <p className="text-muted-foreground">
              Jika email terdaftar, tautan reset telah dikirim. Tautan berlaku 30 menit dan hanya dapat digunakan
              sekali.
            </p>
          </div>
        </div>
        {devUrl ? (
          <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/40 p-3 text-[12px]">
            <p className="font-medium">Mode pengembangan — email tidak dikirim</p>
            <p className="text-muted-foreground">
              Driver email saat ini <code className="font-mono">console</code>. Gunakan tautan langsung berikut:
            </p>
            <Link href={devUrl} className="block break-all font-medium text-primary hover:underline">
              {devUrl}
            </Link>
          </div>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">
            <ArrowLeft className="size-4" /> Kembali ke halaman masuk
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email perusahaan</Label>
        <Input id="email" type="email" placeholder="nama@perusahaan.co.id" {...form.register("email")} />
        <FieldError message={form.formState.errors.email?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        Kirim tautan reset
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link href="/login">
          <ArrowLeft className="size-4" /> Kembali
        </Link>
      </Button>
    </form>
  );
}
