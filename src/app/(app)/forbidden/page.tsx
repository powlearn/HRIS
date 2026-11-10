import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-muted">
        <ShieldX className="size-6 text-muted-foreground" />
      </span>
      <h1 className="text-xl font-semibold tracking-tight">Akses ditolak</h1>
      <p className="max-w-sm text-[13px] text-muted-foreground">
        Peran Anda tidak memiliki izin untuk membuka halaman ini. Hubungi administrator sistem bila akses diperlukan.
      </p>
      <Button asChild variant="outline">
        <Link href="/dashboard">Kembali ke dasbor</Link>
      </Button>
    </div>
  );
}
