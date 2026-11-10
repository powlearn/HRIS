import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="space-y-7">
      <div className="flex items-center gap-2.5 lg:hidden">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
            <path d="M6 18V6.8L18 17.2V6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-tight">NexaHR</span>
      </div>

      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Masuk ke ruang kerja</h1>
        <p className="text-[13px] text-muted-foreground">
          Gunakan akun perusahaan Anda. Sesi aman berlaku maksimal 8 jam.
        </p>
      </div>

      <LoginForm callbackUrl={params.callbackUrl} initialError={params.error} />

      <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
        Dengan masuk, Anda menyetujui kebijakan penggunaan internal perusahaan.{" "}
        <Link href="/forgot-password" className="text-primary hover:underline">
          Lupa kata sandi?
        </Link>
      </p>
    </div>
  );
}
