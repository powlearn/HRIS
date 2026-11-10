import { BadgeCheck, ShieldCheck, Sparkles } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[oklch(0.21_0.04_270)] p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 opacity-70 app-grid-bg" />
        <div className="pointer-events-none absolute -right-24 top-1/4 size-[420px] rounded-full bg-primary/30 blur-[110px]" />
        <div className="relative flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
              <path
                d="M6 18V6.8L18 17.2V6"
                stroke="white"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-[15px] font-semibold tracking-tight">NexaHR</span>
        </div>

        <div className="relative my-auto max-w-lg py-12">
          <p className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/80">
            <Sparkles className="size-3" /> Platform HRIS enterprise · multi-tenant
          </p>
          <h1 className="text-[34px] font-semibold leading-[1.15] tracking-[-0.03em]">
            Seluruh siklus karyawan,
            <br />
            <span className="text-white/60">dalam satu sumber kebenaran.</span>
          </h1>
          <p className="mt-4 max-w-md text-[14px] leading-relaxed text-white/60">
            Kelola kehadiran, cuti, payroll, rekrutmen, dan kinerja tim dengan kontrol akses berlapis dan alur
            persetujuan yang dapat diaudit.
          </p>

          <div className="mt-8 space-y-2.5">
            {[
              { icon: ShieldCheck, text: "Isolasi data per tenant & RBAC granular" },
              { icon: BadgeCheck, text: "Persetujuan berjenjang dengan jejak audit" },
              { icon: Sparkles, text: "AI HR Copilot yang menghormati izin pengguna" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2.5 text-[13px] text-white/75">
                <span className="flex size-6 items-center justify-center rounded-md bg-white/8 ring-1 ring-white/10">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </div>
            ))}
          </div>

          <div className="mt-10 rounded-xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-[11px] text-white/50">
              <span>Kehadiran bulan ini</span>
              <span className="text-emerald-300">+96,4% tepat waktu</span>
            </div>
            <div className="mt-3 flex h-16 items-end gap-1.5">
              {[38, 52, 44, 68, 58, 74, 62, 82, 70, 88, 76, 92].map((height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-[3px] bg-gradient-to-t from-indigo-400/30 to-indigo-300/80"
                  style={{ height: `${height}%` }}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
              {[
                { label: "Karyawan aktif", value: "248" },
                { label: "Departemen", value: "9" },
                { label: "SLA approval", value: "1,4 hari" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[16px] font-semibold">{stat.value}</p>
                  <p className="text-[10px] text-white/45">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="relative text-[11px] text-white/35">
          NexaHR · Aplikasi demonstrasi dengan data karyawan fiktif. Tidak untuk produksi tanpa konfigurasi.
        </p>
      </div>

      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[400px] animate-fade-up">{children}</div>
      </div>
    </div>
  );
}
