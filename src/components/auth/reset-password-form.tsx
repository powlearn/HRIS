"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";

const schema = z
  .object({
    password: z
      .string()
      .min(10, "Minimal 10 karakter")
      .regex(/[A-Za-z]/, "Harus memuat huruf")
      .regex(/\d/, "Harus memuat angka"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Konfirmasi kata sandi tidak cocok",
    path: ["confirmPassword"],
  });

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = React.useState(false);
  const [serverError, setServerError] = React.useState<string | null>(null);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: z.infer<typeof schema>) {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: values.password }),
      });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: { message?: string } };
        setServerError(payload.error?.message ?? "Tautan tidak valid atau sudah kedaluwarsa.");
        return;
      }
      toast.success("Kata sandi diperbarui. Silakan masuk.");
      router.push("/login");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError ? (
        <div className="rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-[12px] text-destructive">
          {serverError}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <Label htmlFor="password">Kata sandi baru</Label>
        <Input id="password" type="password" autoComplete="new-password" {...form.register("password")} />
        <FieldError message={form.formState.errors.password?.message} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="confirmPassword">Ulangi kata sandi</Label>
        <Input id="confirmPassword" type="password" autoComplete="new-password" {...form.register("confirmPassword")} />
        <FieldError message={form.formState.errors.confirmPassword?.message} />
      </div>
      <Button type="submit" className="w-full" disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
        Simpan kata sandi
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link href="/login">Batal</Link>
      </Button>
    </form>
  );
}
