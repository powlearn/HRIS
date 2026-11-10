"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertCircle, Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label, FieldError } from "@/components/ui/label";
import { toast } from "sonner";

const schema = z.object({
  email: z.string().email("Masukkan email yang valid"),
  password: z.string().min(1, "Kata sandi wajib diisi"),
});

type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { label: "HR Manager", email: "sari.hr@nexahr.co.id" },
  { label: "Company Admin", email: "admin@nexahr.co.id" },
  { label: "Karyawan", email: "budi.santoso@nexahr.co.id" },
];

const DEMO_PASSWORD = "NexaHR#2026";

export function LoginForm({ callbackUrl, initialError }: { callbackUrl?: string; initialError?: string }) {
  const router = useRouter();
  const [showPassword, setShowPassword] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(
    initialError ? "Email atau kata sandi tidak cocok. Sesi mungkin telah berakhir." : null,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setFormError(null);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      if (!result || result.error) {
        setFormError("Email atau kata sandi tidak cocok. Periksa kembali kredensial Anda.");
        return;
      }
      toast.success("Berhasil masuk. Selamat bekerja!");
      router.push(callbackUrl && callbackUrl.startsWith("/") ? callbackUrl : "/dashboard");
      router.refresh();
    } catch {
      setFormError("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(email: string) {
    form.setValue("email", email, { shouldValidate: true });
    form.setValue("password", DEMO_PASSWORD, { shouldValidate: true });
    setFormError(null);
  }

  return (
    <div className="space-y-5">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2.5 text-[12px] text-destructive"
          >
            <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
            <span>{formError}</span>
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="email">Email perusahaan</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="nama@perusahaan.co.id"
            aria-invalid={Boolean(form.formState.errors.email)}
            {...form.register("email")}
          />
          <FieldError message={form.formState.errors.email?.message} />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Kata sandi</Label>
            <a href="/forgot-password" className="text-[11px] text-primary hover:underline">
              Lupa sandi?
            </a>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••••"
              aria-invalid={Boolean(form.formState.errors.password)}
              className="pr-9"
              {...form.register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition hover:text-foreground"
              aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            >
              {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
          <FieldError message={form.formState.errors.password?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {submitting ? "Memverifikasi…" : "Masuk"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Akun demonstrasi
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          {DEMO_ACCOUNTS.map((account) => (
            <button
              key={account.email}
              type="button"
              onClick={() => fillDemo(account.email)}
              className="rounded-lg border border-border bg-card px-2 py-2 text-center text-[11px] font-medium text-muted-foreground transition hover:border-ring/40 hover:bg-muted hover:text-foreground"
            >
              {account.label}
            </button>
          ))}
        </div>
        <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
          Klik peran untuk mengisi kredensial demo (sandi: <span className="font-mono">{DEMO_PASSWORD}</span>).
          Data bersifat fiktif.
        </p>
      </div>
    </div>
  );
}
