import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Tautan yang Anda buka tidak tersedia atau data telah dipindahkan.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Kembali ke dasbor</Link>
      </Button>
    </div>
  );
}
