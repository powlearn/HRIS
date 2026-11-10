import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Atur kata sandi baru" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold tracking-tight">Tautan tidak valid</h1>
        <p className="text-[13px] text-muted-foreground">
          Tautan reset tidak lengkap atau sudah kedaluwarsa. Silakan minta tautan baru.
        </p>
        <Button asChild>
          <Link href="/forgot-password">Minta tautan baru</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Atur kata sandi baru</h1>
        <p className="text-[13px] text-muted-foreground">
          Minimal 10 karakter, memadukan huruf dan angka. Semua sesi lain akan diakhiri.
        </p>
      </div>
      <ResetPasswordForm token={token} />
    </div>
  );
}
