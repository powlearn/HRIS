# NexaHR — HRIS Enterprise Multi-Tenant

NexaHR adalah aplikasi **HRIS (Human Resource Information System)** multi-tenant untuk perusahaan Indonesia: data karyawan, absensi, cuti, payroll, rekrutmen, performa, dokumen, laporan, audit, dan AI HR Copilot — dengan antarmuka **Bahasa Indonesia** dan data demo fiktif.

Dibangun sebagai *vertical slice* produksi: setiap halaman yang terlihat memiliki query server, otorisasi, dan endpoint nyata (bukan mock).

> Semua data pada seed bersifat fiktif. Konfigurasi tarif BPJS/PTKP/PPh 21 adalah **contoh yang dapat diedit**, bukan nasihat hukum atau pajak.

---

## 1. Stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | Next.js 15.5 (App Router, Server Components, Server Actions/Route Handlers) |
| Bahasa | TypeScript (strict) |
| UI | Tailwind CSS 4, Radix UI/shadcn-style primitives, `motion`, Recharts, TanStack Table, cmdk, sonner |
| Database | PostgreSQL + Prisma ORM 6 |
| Auth | Auth.js (NextAuth v5, Credentials, JWT session 8 jam) + bcrypt |
| Validasi | Zod + React Hook Form |
| Uang | Decimal.js (tanpa floating point) |
| Waktu | date-fns-tz, zona waktu per tenant |
| Email | Nodemailer (driver `console` secara default) |
| Test | Vitest |

---

## 2. Fitur yang sudah berjalan

### Platform & keamanan
- **Multi-tenant** dengan `tenantId` di setiap tabel domain; semua query difilter di server.
- **RBAC granular** per modul/aksi (`employee.read`, `payroll.approve`, dst.) dengan 6 preset peran: Super Admin, Company Admin, HR Manager, HR Staff, Department Manager, Karyawan.
- **Matriks izin yang dapat diubah** dari UI (Settings → Peran & izin); perubahan dicatat di audit log.
- **Otorisasi server-side**: page guard + API wrapper; UI hanya menyembunyikan, server tetap menolak.
- **Audit log append-only** untuk login, perubahan data, approval, payroll, dan ekspor.
- **Data sensitif** (NIK, NPWP, BPJS, rekening bank) dienkripsi AES-256-GCM dan dimasker kecuali pemilik izin `employee.sensitive.read`.
- **Sesi divalidasi ke database** setiap request: akun nonaktif, tenant suspended, atau sesi yang dicabut langsung ditolak.
- **Rate limit** login/endpoint auth, lockout 5 percobaan gagal, reset password via token hash (30 menit).
- Middleware melindungi seluruh rute aplikasi; cookie `httpOnly`/`sameSite=lax` + `secure` di produksi.
- Dokumen privat disimpan di disk dan hanya bisa diunduh lewat route ber-otorisasi.

### Modul
| Modul | Isi |
| --- | --- |
| **Dasbor** | KPI headcount/kehadiran/keterlambatan/approval, filter bulan–departemen–lokasi, tren kehadiran, distribusi departemen, turnover, ringkasan payroll, aktivitas terbaru, notifikasi, widget absensi |
| **Karyawan** | Direktori + pencarian/filter, tambah/ubah, profil lengkap (ringkasan, kepegawaian, kehadiran, cuti, payroll, dokumen, aktivitas), masking data sensitif, ekspor CSV |
| **Absensi** | Clock-in/out dengan geofence & jarak, status terlambat/toleransi jadwal, koreksi oleh karyawan dan approval atasan, rekap tim |
| **Cuti & izin** | Saldo per jenis cuti, pengajuan (validasi sisa saldo, dokumen, konflik jadwal), approval berjenjang (manager → HR), kalender cuti tim, hari libur |
| **Payroll** | Periode payroll, proses deterministik dari kebijakan berversi + komponen + kehadiran, status Draf → Menunggu Persetujuan → Disetujui → Dibayar, slip gaji PDF/print, ekspor CSV, editor kebijakan (BPJS, PTKP, lapisan PPh 21) |
| **Rekrutmen** | Lowongan, pipeline pelamar per tahap, jadwal wawancara, offer, onboarding |
| **Performa** | Siklus penilaian, review diri & atasan, goal |
| **Dokumen** | Unggah/unduh/hapus dengan penyimpanan privat |
| **Laporan** | Headcount, absensi, cuti, payroll, rekrutmen |
| **AI HR Copilot** | Provider-agnostic (OpenAI-compatible); nonaktif kecuali dikonfigurasi; jawaban deterministik lokal saat nonaktif; **tidak pernah menyetujui/mengubah payroll** |
| **Pengaturan** | Organisasi, peran & izin, kebijakan payroll, konfigurasi AI, audit log |
| **Profil & notifikasi** | Profil pengguna, pusat notifikasi, preferensi tema (terang/gelap) |

### UX
- Shell responsif dengan sidebar yang bisa diciutkan, breadcrumb, command palette (⌘K / Ctrl+K) dengan pencarian karyawan langsung, pusat notifikasi, menu pengguna, transisi halaman.
- Empty state, skeleton, halaman 403/404, toast, dialog konfirmasi untuk aksi berisiko.
- Tabel dengan pencarian, filter, sortir, pagination, dan ekspor.
- Warna & tipografi konsisten (Inter variable, token desain di `src/lib/design.ts`).

---

## 3. Menjalankan secara lokal

### Prasyarat
- Node.js 20+
- PostgreSQL 16+ **atau** gunakan PostgreSQL embedded yang disediakan repo (tanpa Docker)

### Opsi A — PostgreSQL embedded (paling cepat, tanpa Docker)
```bash
npm install
cp .env.example .env
# isi AUTH_SECRET: openssl rand -base64 48

npm run db:up        # menjalankan PostgreSQL userland di port 5432 (data: .data/pg)
npm run db:deploy    # apply migrasi
npm run db:seed      # data demo
npm run dev          # http://localhost:3000
```
Hentikan database dengan `npm run db:down`.

Jika proses sebelumnya terhenti paksa, hapus `.data/pg.pid` lalu jalankan `npm run db:up` lagi.

### Opsi B — PostgreSQL yang sudah ada
Set `DATABASE_URL` di `.env`, lalu:
```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

### Build produksi
```bash
npm run build
npm run start
```

### Docker Compose
```bash
cp .env.example .env    # isi AUTH_SECRET
docker compose up --build -d
docker compose --profile seed run --rm seed   # opsional: data demo
```
Service: `db` (PostgreSQL 16), `migrate` (migrasi otomatis), `app` (port 3000), volume `pgdata` dan `uploads`.

> Catatan: Dockerfile & compose disediakan, tetapi **belum diverifikasi build/run** di lingkungan pengembangan ini karena tidak tersedia Docker daemon. Lihat bagian [Batasan](#8-batasan--yang-belum-selesai).

---

## 4. Akun demo

Sandi semua akun: **`NexaHR#2026`**

| Peran | Email |
| --- | --- |
| Super Admin | `super@nexahr.co.id` |
| Company Admin | `admin@nexahr.co.id` |
| HR Manager | `sari.hr@nexahr.co.id` |
| HR Staff | `rizky.hr@nexahr.co.id` |
| Department Manager | `andi.manager@nexahr.co.id` |
| Karyawan | `budi.santoso@nexahr.co.id` |

Data seed: 1 tenant (Nusantara Digital Group), 45 karyawan (44 aktif), 8 departemen, 5 lokasi, ±2.400 catatan kehadiran, 14 pengajuan cuti, 3 periode payroll (2 dibayar, 1 draf), 5 lowongan, 24 pelamar, 22 review performa, dan dokumen PDF contoh.

---

## 5. Variabel lingkungan

Lihat [`.env.example`](.env.example). Ringkasan:

| Variabel | Wajib | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Koneksi PostgreSQL |
| `AUTH_SECRET` | ✅ | Rahasia JWT (minimal 32 karakter acak) |
| `AUTH_TRUST_HOST` | — | `true` di belakang proxy |
| `APP_URL` | — | Origin publik untuk tautan reset password |
| `AI_ENABLED` | — | `true` untuk mengaktifkan copilot |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | — | Endpoint OpenAI-compatible |
| `AI_ALLOW_CONFIDENTIAL_DATA` | — | Default `false` (PII tidak dikirim ke provider) |
| `MAIL_DRIVER` | — | `console` (default) atau `smtp` + kredensial SMTP |
| `UPLOADS_DIR` | — | Lokasi penyimpanan dokumen privat (default `.uploads`) |

Jangan commit nilai rahasia. `.env` sudah di-ignore.

---

## 6. Arsitektur

```
src/
  app/
    (auth)/            login, lupa sandi, reset sandi
    (app)/             seluruh halaman terautentikasi + layout shell
    api/v1/            route handler REST (employees, attendance, leave,
                       payroll, recruitment, documents, ai, settings,
                       notifications, search, health)
  components/          shell, UI primitives, tabel, chart, dialog fitur
  lib/                 prisma, auth, rbac, api wrapper, audit, crypto,
                       money, time, storage, rate-limit, notifikasi, dsb.
  modules/             logika domain per modul (service + engine)
  middleware.ts        proteksi rute + rate limit auth
prisma/
  schema.prisma        40+ model
  migrations/          migrasi SQL
  seed.ts              data demo deterministik
tests/                 unit test payroll engine & keamanan
```

Pola request: **halaman/route → requirePage/apiHandler → service domain → Prisma**. Service selalu menerima `SessionUser` dan memfilter `tenantId`; tidak ada akses data langsung dari komponen klien.

### Payroll deterministik
1. Kebijakan aktif (`PayrollPolicy`, berversi) berisi tarif BPJS, PTKP, lapisan PPh 21, dan batas upah.
2. Proses payroll membaca karyawan aktif, komponen tetap, kehadiran, dan cuti tidak berbayar pada periode.
3. Seluruh perhitungan memakai `Decimal` dan dibulatkan Rupiah di akhir; tidak ada tarif yang di-hardcode.
4. Alur status dikunci di server: hanya `DRAFT` yang bisa diproses, hanya `PENDING_APPROVAL` yang bisa disetujui, dan hanya `APPROVED` yang bisa ditandai dibayar.
5. Setiap transisi menulis audit log dan notifikasi; AI tidak memiliki akses ke jalur ini.

---

## 7. Verifikasi yang sudah dijalankan

| Pemeriksaan | Hasil |
| --- | --- |
| `npx tsc --noEmit` | ✅ bersih |
| `npx vitest run` | ✅ 15/15 lulus (`tests/payroll-engine.test.ts`, `tests/security.test.ts`) |
| `npm run build` | ✅ sukses, seluruh route ter-generate |
| Migrasi + seed | ✅ 2 migrasi diterapkan, seed berhasil |
| `/api/health` | ✅ `{"status":"ok","database":"connected"}` |
| Login → dasbor (browser) | ✅ berhasil sebagai HR Manager |
| Payroll end-to-end (browser) | ✅ proses 44 karyawan → setujui → tandai dibayar, nilai tampil & audit tercatat |
| Approval cuti (browser) | ✅ pengajuan hilang dari antrean, audit `leave.approved` tercatat |
| Data sensitif & RBAC | ✅ diuji unit test, masking tampil di UI |

Contoh tampilan: [login](artifacts/login.png) · [dasbor](artifacts/final-dashboard.png) · [karyawan](artifacts/final-employees.png) · [payroll](artifacts/payroll-processed.png) · [audit](artifacts/audit.png).

---

## 8. Batasan & yang belum selesai

Ditulis jujur agar tidak ada klaim berlebih:

- **Docker belum diuji.** File `Dockerfile`, `docker-compose.yml`, dan `.dockerignore` tersedia, tetapi build/run tidak dapat dijalankan di lingkungan ini (tidak ada Docker daemon). Verifikasi dilakukan dengan `next start` + PostgreSQL embedded.
- **Email hanya mode console** secara default. Driver SMTP tersedia tetapi belum diuji terhadap server SMTP nyata.
- **AI Copilot** belum diuji terhadap provider nyata (tidak ada API key). Tanpa konfigurasi, copilot memakai jawaban deterministik lokal dan menampilkan status nonaktif.
- **Penyimpanan dokumen** memakai disk lokal (`.uploads`), bukan object storage. Untuk deployment multi-instance, ganti dengan S3/R2.
- **Antrean/background job** belum ada; notifikasi dan audit ditulis sinkron. Pengiriman email massal, penjadwalan payroll, dan reminder kontrak belum diotomatiskan.
- **Geofence absensi** hanya bukti lokasi, bukan anti-manipulasi (tidak ada attestation perangkat). Ini dinyatakan di UI.
- **PDF slip gaji** mengandalkan print-to-PDF browser; belum ada generator PDF server-side.
- **Kalender cuti** menampilkan cuti disetujui tim; tampilan bulanan belum memiliki tampilan tahun.
- **Belum ada** integrasi bank/payroll disbursement, mesin absensi fisik, e-signature, atau konektor pajak.
- **Rate limit** berbasis memori proses; pada multi-instance perlu Redis.
- **Belum diuji beban/performance** dan belum ada CI pipeline.
- Seed payroll memakai tarif contoh; wajib disesuaikan dengan regulasi dan kebijakan perusahaan sebelum dipakai nyata.

---

## 9. Lisensi & data

Data seed sepenuhnya fiktif dan dibuat untuk demonstrasi. Tidak ada data pribadi nyata. Gunakan dan modifikasi sesuai kebutuhan internal Anda.
