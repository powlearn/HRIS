import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Lupa kata sandi" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Reset kata sandi</h1>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Masukkan email perusahaan Anda. Kami akan mengirim tautan reset yang berlaku 30 menit.
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
