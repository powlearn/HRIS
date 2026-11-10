/**
 * NexaHR seed — fictional Indonesian demo company (Nusantara Digital Group).
 * All names, emails, NIK, phone numbers and bank accounts are synthetic.
 *
 * Deterministic: the same script produces the same dataset, so screenshots,
 * tests and demos stay stable.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PERMISSIONS } from "../src/lib/rbac";
import { ROLE_PRESETS } from "../src/lib/role-presets";
import { encryptField } from "../src/lib/crypto";
import { Decimal } from "../src/lib/money";
import { computePayroll } from "../src/modules/payroll/engine";
import { parsePolicyConfig } from "../src/modules/payroll/policy";
import { dateKey, dateOnly, zonedDateTime } from "../src/lib/time";

const prisma = new PrismaClient();
const TZ = "Asia/Jakarta";

// ── deterministic PRNG ──────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261110);
const pick = <T,>(items: T[]): T => items[Math.floor(rand() * items.length)] as T;
const between = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;

// ── dates ───────────────────────────────────────────────────────────────────
const NOW = new Date();
const TODAY_KEY = dateKey(NOW, TZ);
const today = dateOnly(TODAY_KEY);

function monthInfo(offset: number) {
  const base = new Date(Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() + offset, 1));
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + 1, 0));
  return { year, month: month + 1, start, end };
}
const prevMonth = monthInfo(-1);
const currentMonth = monthInfo(0);

const holidayDates: { date: Date; name: string }[] = (() => {
  const year = NOW.getUTCFullYear();
  return [
    { date: dateOnly(`${year}-01-01`), name: "Tahun Baru Masehi" },
    { date: dateOnly(`${year}-05-01`), name: "Hari Buruh Internasional" },
    { date: dateOnly(`${year}-08-17`), name: "Hari Kemerdekaan Republik Indonesia" },
    { date: dateOnly(`${year}-12-25`), name: "Hari Raya Natal" },
    { date: dateOnly(`${year}-12-24`), name: "Cuti Bersama Natal" },
  ];
})();
const holidaySet = new Set(holidayDates.map((h) => h.date.toISOString().slice(0, 10)));

// ── PDF helper (real, downloadable sample documents) ────────────────────────
function buildPdf(title: string, lines: string[]): Buffer {
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const body = [
    `BT /F1 16 Tf 56 780 Td (${escape(title)}) Tj ET`,
    "BT /F1 10 Tf 56 752 Td 15 TL",
    ...lines.map((line) => `(${escape(line)}) Tj T*`),
    "ET",
    "BT /F1 8 Tf 56 80 Td (Dokumen contoh NexaHR - data fiktif, bukan dokumen resmi.) Tj ET",
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(body, "latin1")} >>\nstream\n${body}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "latin1"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(pdf, "latin1");
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

// ── org definitions ─────────────────────────────────────────────────────────
type DeptDef = { code: string; name: string; description: string; city: string; positions: string[] };

const DEPARTMENTS: DeptDef[] = [
  { code: "MGT", name: "Manajemen", description: "Kepemimpinan perusahaan & tata kelola.", city: "Jakarta", positions: ["Direktur Utama", "Platform Administrator"] },
  {
    code: "TECH",
    name: "Teknologi",
    description: "Rekayasa perangkat lunak, infrastruktur, dan keandalan platform.",
    city: "Jakarta",
    positions: ["Chief Technology Officer", "Engineering Manager", "Senior Software Engineer", "Software Engineer", "QA Engineer", "DevOps Engineer"],
  },
  { code: "PRD", name: "Produk & Desain", description: "Strategi produk, riset pengguna, dan desain pengalaman.", city: "Bandung", positions: ["Head of Product", "Product Manager", "Product Designer", "UX Researcher"] },
  { code: "FIN", name: "Keuangan", description: "Akuntansi, perpajakan, dan pengendalian keuangan.", city: "Jakarta", positions: ["Finance Manager", "Accounting Supervisor", "Accountant", "Payroll Specialist"] },
  { code: "HR", name: "Sumber Daya Manusia", description: "Talent acquisition, people operations, dan payroll.", city: "Jakarta", positions: ["HR Manager", "HR Officer", "Talent Acquisition Specialist", "Payroll & Benefit Admin"] },
  { code: "MKT", name: "Pemasaran", description: "Brand, konten, dan pertumbuhan pemasaran.", city: "Jakarta", positions: ["Marketing Manager", "Content Strategist", "Performance Marketer", "Social Media Specialist"] },
  { code: "OPS", name: "Operasional", description: "Fasilitas, administrasi kantor, dan dukungan internal.", city: "Surabaya", positions: ["Operations Manager", "Office Administrator", "IT Support"] },
  { code: "SLS", name: "Penjualan", description: "Akuisisi pelanggan enterprise dan keberhasilan pelanggan.", city: "Jakarta", positions: ["Sales Manager", "Account Executive", "Customer Success Specialist"] },
];

const LOCATIONS = [
  { code: "JKT", name: "Jakarta HQ", city: "Jakarta", address: "Menara Sentraya, Jl. Iskandarsyah Raya No. 1A, Kebayoran Baru", latitude: -6.2441, longitude: 106.8006, radiusMeters: 250 },
  { code: "BDG", name: "Bandung Studio", city: "Bandung", address: "Jl. Cihampelas No. 88, Coblong", latitude: -6.8958, longitude: 107.6031, radiusMeters: 200 },
  { code: "SBY", name: "Surabaya Branch", city: "Surabaya", address: "Jl. Basuki Rahmat No. 105, Genteng", latitude: -7.2575, longitude: 112.7521, radiusMeters: 200 },
];

const salariesByTitle: Record<string, number> = {
  "Direktur Utama": 55_000_000,
  "Platform Administrator": 26_000_000,
  "Chief Technology Officer": 48_000_000,
  "Engineering Manager": 30_000_000,
  "Senior Software Engineer": 19_000_000,
  "Software Engineer": 13_500_000,
  "QA Engineer": 11_000_000,
  "DevOps Engineer": 17_000_000,
  "Head of Product": 38_000_000,
  "Product Manager": 22_000_000,
  "Product Designer": 15_000_000,
  "UX Researcher": 14_000_000,
  "Finance Manager": 30_000_000,
  "Accounting Supervisor": 17_000_000,
  Accountant: 10_500_000,
  "Payroll Specialist": 12_000_000,
  "HR Manager": 28_000_000,
  "HR Officer": 9_500_000,
  "Talent Acquisition Specialist": 11_500_000,
  "Payroll & Benefit Admin": 10_500_000,
  "Marketing Manager": 27_000_000,
  "Content Strategist": 12_000_000,
  "Performance Marketer": 14_000_000,
  "Social Media Specialist": 8_500_000,
  "Operations Manager": 26_000_000,
  "Office Administrator": 8_000_000,
  "IT Support": 9_000_000,
  "Sales Manager": 28_000_000,
  "Account Executive": 13_000_000,
  "Customer Success Specialist": 11_000_000,
};

const FEMALE_NAMES = ["Ayu Lestari", "Intan Maharani", "Putri Handayani", "Melati Anggraeni", "Nabila Rahmawati", "Kartika Dewi", "Anisa Fitriani", "Ratna Sari", "Wulan Puspita", "Sri Mulyani", "Lia Kurniasih", "Dian Safitri", "Sinta Amelia", "Mega Wati", "Tiara Kusuma", "Nur Aini", "Desi Ratnasari", "Yulia Sari", "Novita Sari", "Fitriani", "Lestari Ningsih"];
const MALE_NAMES = ["Dimas Prakoso", "Reza Alfarizi", "Bayu Setiawan", "Arif Hidayat", "Yusuf Maulana", "Firman Syah", "Galih Wicaksono", "Ilham Ramadhan", "Teguh Santoso", "Aditya Nugraha", "Hafiz Rahman", "Rudi Hartono", "Eko Prasetyo", "Fauzan Akbar", "Bambang Sutrisno", "Angga Permana", "Hendra Gunawan", "Rizal Fadillah", "Agus Salim", "Doni Saputra", "Muhammad Iqbal"];
const namePool = [...FEMALE_NAMES, ...MALE_NAMES].sort((a, b) => a.localeCompare(b));
let nameCursor = 0;

type EmployeeSpec = {
  code: string;
  first: string;
  last: string;
  email: string;
  dept: string;
  title: string;
  managerCode?: string;
  status: "PERMANENT" | "CONTRACT" | "PROBATION" | "INTERN" | "RESIGNED";
  hireDate: Date;
  salary: number;
  location: string;
  gender: "MALE" | "FEMALE";
  birthDate: Date;
  city: string;
  contractType: "PERMANENT" | "FIXED_TERM" | "PROBATION" | "INTERNSHIP";
  resignDate?: Date;
  ptkp: string;
};

const specs: EmployeeSpec[] = [];
const usedEmails = new Set<string>();
let employeeSeq = 0;

function addSpec(input: {
  first: string;
  last: string;
  dept: string;
  title: string;
  managerCode?: string;
  status?: EmployeeSpec["status"];
  hireDate: string;
  salary?: number;
  location?: string;
  gender?: "MALE" | "FEMALE";
  birthDate?: string;
  contractType?: EmployeeSpec["contractType"];
  resignDate?: string;
  ptkp?: string;
}) {
  employeeSeq += 1;
  const code = `NDG-${String(employeeSeq).padStart(4, "0")}`;
  const female = input.gender ? input.gender === "FEMALE" : rand() > 0.45;
  const city = LOCATIONS.find((l) => l.code === (input.location ?? "JKT"))?.city ?? "Jakarta";
  const salary = input.salary ?? salariesByTitle[input.title] ?? 10_000_000;
  const emailBase = `${input.first}.${input.last}`.toLowerCase().replace(/[^a-z.]/g, "");
  let email = `${emailBase}@nexahr.co.id`;
  let suffix = 2;
  while (usedEmails.has(email)) {
    email = `${emailBase}${suffix}@nexahr.co.id`;
    suffix += 1;
  }
  usedEmails.add(email);
  specs.push({
    code,
    first: input.first,
    last: input.last,
    email,
    dept: input.dept,
    title: input.title,
    managerCode: input.managerCode,
    status: input.status ?? "PERMANENT",
    hireDate: dateOnly(input.hireDate),
    salary,
    location: input.location ?? "JKT",
    gender: female ? "FEMALE" : "MALE",
    birthDate: dateOnly(input.birthDate ?? `199${between(0, 6)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 28)).padStart(2, "0")}`),
    city,
    contractType: input.contractType ?? (input.status === "CONTRACT" ? "FIXED_TERM" : input.status === "PROBATION" ? "PROBATION" : input.status === "INTERN" ? "INTERNSHIP" : "PERMANENT"),
    resignDate: input.resignDate ? dateOnly(input.resignDate) : undefined,
    ptkp: input.ptkp ?? (rand() > 0.5 ? "TK/0" : "K/1"),
  });
  return code;
}

// Key leadership + demo personas
const dewi = addSpec({ first: "Dewi", last: "Anggraini", dept: "MGT", title: "Direktur Utama", hireDate: "2019-02-04", salary: 55_000_000, gender: "FEMALE", birthDate: "1982-04-17", ptkp: "K/2" });
const raka = addSpec({ first: "Raka", last: "Pradana", dept: "MGT", title: "Platform Administrator", managerCode: dewi, hireDate: "2020-01-06", salary: 26_000_000, gender: "MALE", birthDate: "1990-09-12" });
const fajar = addSpec({ first: "Fajar", last: "Nugroho", dept: "TECH", title: "Chief Technology Officer", managerCode: dewi, hireDate: "2019-03-01", salary: 48_000_000, gender: "MALE", birthDate: "1984-11-02", ptkp: "K/1" });
const andi = addSpec({ first: "Andi", last: "Kurniawan", dept: "TECH", title: "Engineering Manager", managerCode: fajar, hireDate: "2020-06-15", salary: 30_000_000, gender: "MALE", birthDate: "1988-06-21", ptkp: "K/1" });
const budi = addSpec({ first: "Budi", last: "Santoso", dept: "TECH", title: "Software Engineer", managerCode: andi, hireDate: "2022-09-01", salary: 13_500_000, gender: "MALE", birthDate: "1995-01-30", ptkp: "TK/0" });
const sari = addSpec({ first: "Sari", last: "Wulandari", dept: "HR", title: "HR Manager", managerCode: dewi, hireDate: "2019-07-01", salary: 28_000_000, gender: "FEMALE", birthDate: "1986-08-08", ptkp: "K/2" });
const rizky = addSpec({ first: "Rizky", last: "Pratama", dept: "HR", title: "HR Officer", managerCode: sari, hireDate: "2023-02-13", salary: 9_500_000, gender: "MALE", birthDate: "1997-03-19", ptkp: "TK/0" });
const citra = addSpec({ first: "Citra", last: "Lestari", dept: "PRD", title: "Head of Product", managerCode: dewi, hireDate: "2020-02-10", salary: 38_000_000, location: "BDG", gender: "FEMALE", birthDate: "1987-12-05", ptkp: "K/1" });
const maya = addSpec({ first: "Maya", last: "Kusuma", dept: "FIN", title: "Finance Manager", managerCode: dewi, hireDate: "2019-11-11", salary: 30_000_000, gender: "FEMALE", birthDate: "1985-05-23", ptkp: "K/2" });
const bagas = addSpec({ first: "Bagas", last: "Saputra", dept: "MKT", title: "Marketing Manager", managerCode: dewi, hireDate: "2021-04-05", salary: 27_000_000, gender: "MALE", birthDate: "1989-02-14" });
const nadia = addSpec({ first: "Nadia", last: "Permata", dept: "OPS", title: "Operations Manager", managerCode: dewi, hireDate: "2020-08-17", salary: 26_000_000, location: "SBY", gender: "FEMALE", birthDate: "1991-07-09" });
const yoga = addSpec({ first: "Yoga", last: "Hermawan", dept: "SLS", title: "Sales Manager", managerCode: dewi, hireDate: "2020-10-01", salary: 28_000_000, gender: "MALE", birthDate: "1987-03-27" });

// Additional staff, distributed across departments
const staffing: { dept: string; titles: string[]; manager: string; location?: string }[] = [
  { dept: "TECH", titles: ["Senior Software Engineer", "Senior Software Engineer", "Software Engineer", "Software Engineer", "QA Engineer", "QA Engineer", "DevOps Engineer"], manager: andi },
  { dept: "PRD", titles: ["Product Manager", "Product Designer", "Product Designer", "UX Researcher"], manager: citra, location: "BDG" },
  { dept: "FIN", titles: ["Accounting Supervisor", "Accountant", "Accountant", "Payroll Specialist"], manager: maya },
  { dept: "HR", titles: ["Talent Acquisition Specialist", "Payroll & Benefit Admin"], manager: sari },
  { dept: "MKT", titles: ["Content Strategist", "Performance Marketer", "Performance Marketer", "Social Media Specialist"], manager: bagas },
  { dept: "OPS", titles: ["Office Administrator", "IT Support", "IT Support"], manager: nadia, location: "SBY" },
  { dept: "SLS", titles: ["Account Executive", "Account Executive", "Account Executive", "Customer Success Specialist", "Customer Success Specialist"], manager: yoga },
];

for (const group of staffing) {
  for (const title of group.titles) {
    const fullName = namePool[nameCursor++ % namePool.length];
    const [first, ...rest] = fullName.split(" ");
    const last = rest.join(" ") || "Pratama";
    const roll = rand();
    const status: EmployeeSpec["status"] = roll > 0.93 ? "CONTRACT" : roll > 0.88 ? "PROBATION" : "PERMANENT";
    addSpec({
      first,
      last,
      dept: group.dept,
      title,
      managerCode: group.manager,
      status,
      hireDate: `${between(2020, 2025)}-${String(between(1, 12)).padStart(2, "0")}-${String(between(1, 27)).padStart(2, "0")}`,
      salary: Math.round((salariesByTitle[title] ?? 10_000_000) * (0.94 + rand() * 0.12)),
      location: group.location ?? "JKT",
    });
  }
}

// New hires this month for dashboard coverage
const thisMonthFirst = `${NOW.getUTCFullYear()}-${String(NOW.getUTCMonth() + 1).padStart(2, "0")}-01`;
addSpec({ first: "Kirana", last: "Maheswari", dept: "MKT", title: "Content Strategist", managerCode: bagas, status: "PROBATION", hireDate: thisMonthFirst, salary: 12_000_000, gender: "FEMALE" });
addSpec({ first: "Galih", last: "Ramadhan", dept: "TECH", title: "Software Engineer", managerCode: andi, status: "PROBATION", hireDate: thisMonthFirst, salary: 13_500_000, gender: "MALE" });

// One intern and one resigned employee for status coverage
addSpec({ first: "Lestari", last: "Ningsih", dept: "PRD", title: "UX Researcher", managerCode: citra, status: "INTERN", hireDate: "2026-07-01", salary: 4_500_000, location: "BDG", contractType: "INTERNSHIP" });
const resignedCode = addSpec({ first: "Hendra", last: "Gunawan", dept: "SLS", title: "Account Executive", managerCode: yoga, status: "RESIGNED", hireDate: "2021-03-08", salary: 12_000_000, resignDate: dateKey(new Date(Date.now() - 34 * 86400000), TZ) });

async function main() {
  console.log("Menghapus data lama…");
  await prisma.tenant.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.permission.deleteMany({});

  // Permissions
  await prisma.permission.createMany({ data: PERMISSIONS.map((p) => ({ key: p.key, module: p.module, action: p.action, description: p.label })) });
  const permissionRows = await prisma.permission.findMany();
  const permissionByKey = new Map(permissionRows.map((p) => [p.key, p.id]));

  const tenant = await prisma.tenant.create({
    data: {
      name: "Nusantara Digital Group",
      slug: "nusantara-digital",
      legalName: "PT Nusantara Digital Group",
      status: "ACTIVE",
      industry: "Teknologi & Layanan Digital",
      timezone: TZ,
      currency: "IDR",
      employeeCodePrefix: "NDG",
    },
  });
  const tenantId = tenant.id;

  // Roles
  const roles = new Map<string, string>();
  for (const preset of ROLE_PRESETS) {
    const role = await prisma.role.create({
      data: {
        tenantId: preset.slug === "super_admin" ? null : tenantId,
        name: preset.name,
        slug: preset.slug,
        description: preset.description,
        level: preset.level,
        isSystem: preset.isSystem,
      },
    });
    roles.set(preset.slug, role.id);
    const permissionIds = preset.permissions.map((key) => permissionByKey.get(key)).filter(Boolean) as string[];
    if (permissionIds.length) {
      await prisma.rolePermission.createMany({ data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })) });
    }
  }

  // Departments & positions
  const deptByCode = new Map<string, string>();
  const positionByTitle = new Map<string, string>();
  for (const dept of DEPARTMENTS) {
    const created = await prisma.department.create({
      data: { tenantId, name: dept.name, code: dept.code, description: dept.description },
    });
    deptByCode.set(dept.code, created.id);
    for (const title of dept.positions) {
      const position = await prisma.position.create({
        data: {
          tenantId,
          title,
          code: `${dept.code}-${title.split(" ").map((w) => w[0]).join("").toUpperCase()}${between(10, 99)}`,
          level: title.includes("Manager") || title.includes("Head") || title.includes("Chief") || title.includes("Direktur") ? "LEAD" : "STAFF",
          departmentId: created.id,
        },
      });
      positionByTitle.set(title, position.id);
    }
  }

  const locations = new Map<string, { id: string; latitude: number; longitude: number }>();
  for (const loc of LOCATIONS) {
    const created = await prisma.workLocation.create({ data: { tenantId, ...loc } });
    locations.set(loc.code, { id: created.id, latitude: loc.latitude, longitude: loc.longitude });
  }

  const scheduleRegular = await prisma.workSchedule.create({
    data: { tenantId, name: "Reguler 08.30–17.30", startTime: "08:30", endTime: "17:30", graceMinutes: 15, workDays: [1, 2, 3, 4, 5], timezone: TZ, isDefault: true },
  });
  await prisma.workSchedule.create({
    data: { tenantId, name: "Shift Pagi 07.00–15.00", startTime: "07:00", endTime: "15:00", graceMinutes: 10, workDays: [1, 2, 3, 4, 5], timezone: TZ },
  });
  await prisma.workSchedule.create({
    data: { tenantId, name: "Fleksibel 40 jam/minggu", startTime: "09:00", endTime: "18:00", graceMinutes: 60, workDays: [1, 2, 3, 4, 5], timezone: TZ },
  });

  // Employees
  const employeeByCode = new Map<string, { id: string; name: string; email: string; salary: number; ptkp: string }>();
  const employeeIdByCode = new Map<string, string>();
  for (const [specIndex, spec] of specs.entries()) {
    const managerId = spec.managerCode ? employeeIdByCode.get(spec.managerCode) ?? null : null;
    const location = locations.get(spec.location)!;
    const employee = await prisma.employee.create({
      data: {
        tenantId,
        employeeCode: spec.code,
        firstName: spec.first,
        lastName: spec.last,
        email: spec.email,
        phone: `+62 8${between(11, 19)}-${between(1000, 9999)}-${between(1000, 9999)}`,
        gender: spec.gender,
        birthDate: spec.birthDate,
        birthPlace: spec.city,
        maritalStatus: rand() > 0.4 ? "MENIKAH" : "BELUM_MENIKAH",
        religion: pick(["Islam", "Kristen", "Katolik", "Hindu", "Buddha"]),
        address: `Jl. ${pick(["Melati", "Cempaka", "Kemuning", "Anggrek", "Sakura", "Kenanga"])} No. ${between(1, 120)}`,
        city: spec.city,
        postalCode: String(between(10110, 60299)),
        nikEnc: encryptField(`3174${String(between(10, 99))}${String(between(100000, 999999))}${String(between(1000, 9999))}`),
        npwpEnc: rand() > 0.3 ? encryptField(`09.${between(100, 999)}.${between(100, 999)}.${between(1, 9)}-${between(100, 999)}.000`) : null,
        bankName: pick(["Bank Central Asia", "Bank Mandiri", "Bank Negara Indonesia", "Bank Rakyat Indonesia"]),
        bankAccountEnc: encryptField(String(between(1000000000, 9999999999))),
        bpjsKesNumberEnc: encryptField(`0001${String(between(100000000, 999999999))}`),
        bpjsTkNumberEnc: encryptField(`19${String(between(100000000, 999999999))}`),
        departmentId: deptByCode.get(spec.dept),
        positionId: positionByTitle.get(spec.title),
        locationId: location.id,
        managerId,
        scheduleId: scheduleRegular.id,
        status: spec.status,
        hireDate: spec.hireDate,
        resignDate: spec.resignDate,
        endDate: spec.status === "CONTRACT" ? new Date(Date.UTC(spec.hireDate.getUTCFullYear() + 2, spec.hireDate.getUTCMonth(), spec.hireDate.getUTCDate())) : null,
        basicSalary: new Decimal(spec.salary),
        emergencyName: pick(["Ibu Sri", "Bapak Joko", "Ibu Ani", "Bapak Hendra", "Kakak Rina"]),
        emergencyRelation: pick(["Orang Tua", "Pasangan", "Saudara"]),
        emergencyPhone: `+62 8${between(11, 19)}-${between(1000, 9999)}-${between(1000, 9999)}`,
      },
    });
    employeeIdByCode.set(spec.code, employee.id);
    employeeByCode.set(spec.code, {
      id: employee.id,
      name: `${spec.first} ${spec.last}`,
      email: spec.email,
      salary: spec.salary,
      ptkp: spec.ptkp,
    });

    await prisma.employmentContract.create({
      data: {
        tenantId,
        employeeId: employee.id,
        contractNumber: `PK/${spec.hireDate.getUTCFullYear()}/${String(specIndex + 1).padStart(4, "0")}`,
        type: spec.contractType,
        status: spec.resignDate ? "TERMINATED" : "ACTIVE",
        startDate: spec.hireDate,
        endDate: spec.contractType === "FIXED_TERM" ? new Date(Date.UTC(spec.hireDate.getUTCFullYear() + 2, spec.hireDate.getUTCMonth(), spec.hireDate.getUTCDate())) : null,
        signedAt: spec.hireDate,
        notes: "Kontrak demo yang dihasilkan oleh seed NexaHR.",
      },
    });
    await prisma.employmentHistory.create({
      data: {
        employeeId: employee.id,
        changeType: "HIRING",
        effectiveDate: spec.hireDate,
        newValue: { position: spec.title, department: spec.dept, status: spec.status },
        notes: "Bergabung dengan perusahaan.",
      },
    });
  }

  // One contract nearing expiry so the dashboard "perlu perhatian" card is meaningful.
  const expiringEmployee = await prisma.employee.findFirst({ where: { tenantId, status: "CONTRACT" }, orderBy: { hireDate: "asc" } });
  if (expiringEmployee) {
    const endDate = new Date(Date.now() + 21 * 86400000);
    await prisma.employee.update({ where: { id: expiringEmployee.id }, data: { endDate } });
    await prisma.employmentContract.updateMany({ where: { employeeId: expiringEmployee.id }, data: { endDate } });
  }

  // Department heads
  const headByDept: Record<string, string> = { MGT: dewi, TECH: fajar, PRD: citra, FIN: maya, HR: sari, MKT: bagas, OPS: nadia, SLS: yoga };
  for (const [code, headCode] of Object.entries(headByDept)) {
    await prisma.department.update({
      where: { id: deptByCode.get(code)! },
      data: { headId: employeeIdByCode.get(headCode)! },
    });
  }

  // Demo users — password is intentionally public demo data, not a secret.
  const passwordHash = await bcrypt.hash("NexaHR#2026", 12);
  const demoUsers: { email: string; name: string; role: string; employeeCode: string }[] = [
    { email: "admin@nexahr.co.id", name: "Dewi Anggraini", role: "company_admin", employeeCode: dewi },
    { email: "sari.hr@nexahr.co.id", name: "Sari Wulandari", role: "hr_manager", employeeCode: sari },
    { email: "rizky.hr@nexahr.co.id", name: "Rizky Pratama", role: "hr_staff", employeeCode: rizky },
    { email: "andi.manager@nexahr.co.id", name: "Andi Kurniawan", role: "dept_manager", employeeCode: andi },
    { email: "budi.santoso@nexahr.co.id", name: "Budi Santoso", role: "employee", employeeCode: budi },
    { email: "super@nexahr.co.id", name: "Raka Pradana", role: "super_admin", employeeCode: raka },
  ];
  const userIdByEmail = new Map<string, string>();
  for (const demo of demoUsers) {
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: demo.email,
        name: demo.name,
        passwordHash,
        roleId: roles.get(demo.role)!,
        phone: "+62 812-0000-0000",
      },
    });
    userIdByEmail.set(demo.email, user.id);
    await prisma.employee.update({ where: { id: employeeIdByCode.get(demo.employeeCode)! }, data: { userId: user.id } });
  }

  // Leave configuration
  const leaveTypeDefs = [
    { name: "Cuti Tahunan", code: "ANNUAL", color: "#6366f1", annualQuota: 12, isPaid: true, requiresDocument: false, minNoticeDays: 3 },
    { name: "Cuti Sakit", code: "SICK", color: "#f97316", annualQuota: 12, isPaid: true, requiresDocument: true, minNoticeDays: 0 },
    { name: "Cuti Melahirkan", code: "MATERNITY", color: "#ec4899", annualQuota: 90, isPaid: true, requiresDocument: true, minNoticeDays: 30, maxConsecutiveDays: 90 },
    { name: "Cuti Menikah", code: "MARRIAGE", color: "#14b8a6", annualQuota: 3, isPaid: true, requiresDocument: true, minNoticeDays: 7, maxConsecutiveDays: 3 },
    { name: "Izin Darurat", code: "EMERGENCY", color: "#eab308", annualQuota: 3, isPaid: true, requiresDocument: false, minNoticeDays: 0, maxConsecutiveDays: 3 },
    { name: "Cuti Tidak Berbayar", code: "UNPAID", color: "#64748b", annualQuota: 0, isPaid: false, requiresDocument: false, minNoticeDays: 7, maxConsecutiveDays: 30 },
  ];
  const leaveTypeByCode = new Map<string, { id: string; annualQuota: number; isPaid: boolean }>();
  for (const def of leaveTypeDefs) {
    const created = await prisma.leaveType.create({ data: { tenantId, ...def } });
    leaveTypeByCode.set(def.code, { id: created.id, annualQuota: def.annualQuota, isPaid: def.isPaid });
  }

  const leaveWorkflow = await prisma.approvalWorkflow.create({
    data: {
      tenantId,
      name: "Alur Cuti Standar",
      module: "LEAVE",
      isActive: true,
      steps: {
        create: [
          { order: 1, name: "Review Atasan Langsung", approverType: "MANAGER", roleSlug: "dept_manager", isRequired: true },
          { order: 2, name: "Verifikasi HR", approverType: "ROLE", roleSlug: "hr_manager", isRequired: true },
        ],
      },
    },
    include: { steps: true },
  });
  await prisma.approvalWorkflow.create({
    data: {
      tenantId,
      name: "Koreksi Kehadiran",
      module: "ATTENDANCE_CORRECTION",
      isActive: true,
      steps: { create: [{ order: 1, name: "Persetujuan Atasan", approverType: "MANAGER", roleSlug: "dept_manager", isRequired: true }] },
    },
  });
  await prisma.approvalWorkflow.create({
    data: {
      tenantId,
      name: "Persetujuan Payroll",
      module: "PAYROLL",
      isActive: true,
      steps: { create: [{ order: 1, name: "Persetujuan HR Manager", approverType: "ROLE", roleSlug: "hr_manager", isRequired: true }] },
    },
  });
  await prisma.approvalWorkflow.create({
    data: {
      tenantId,
      name: "Persetujuan Requisition",
      module: "REQUISITION",
      isActive: true,
      steps: { create: [{ order: 1, name: "Persetujuan HR Manager", approverType: "ROLE", roleSlug: "hr_manager", isRequired: true }] },
    },
  });

  await prisma.holiday.createMany({ data: holidayDates.map((h) => ({ tenantId, date: h.date, name: h.name, isNational: true })) });

  // Leave requests
  type LeaveSeed = {
    code: string;
    type: string;
    start: string;
    end: string;
    days: string;
    reason: string;
    status: "DRAFT" | "SUBMITTED" | "MANAGER_REVIEW" | "HR_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
    createdAtDaysAgo: number;
  };
  const leaveSeeds: LeaveSeed[] = [
    { code: budi, type: "ANNUAL", start: dateKey(new Date(Date.now() + 5 * 86400000), TZ), end: dateKey(new Date(Date.now() + 7 * 86400000), TZ), days: "3.0", reason: "Liburan keluarga ke Yogyakarta.", status: "MANAGER_REVIEW", createdAtDaysAgo: 1 },
    { code: andi, type: "ANNUAL", start: dateKey(new Date(Date.now() + 12 * 86400000), TZ), end: dateKey(new Date(Date.now() + 14 * 86400000), TZ), days: "3.0", reason: "Acara keluarga di luar kota.", status: "HR_REVIEW", createdAtDaysAgo: 3 },
    { code: rizky, type: "SICK", start: dateKey(new Date(Date.now() - 2 * 86400000), TZ), end: dateKey(new Date(Date.now() - 1 * 86400000), TZ), days: "2.0", reason: "Demam dan surat keterangan dokter.", status: "APPROVED", createdAtDaysAgo: 4 },
    { code: budi, type: "SICK", start: dateKey(new Date(Date.now() - 20 * 86400000), TZ), end: dateKey(new Date(Date.now() - 20 * 86400000), TZ), days: "1.0", reason: "Sakit perut, istirahat di rumah.", status: "APPROVED", createdAtDaysAgo: 21 },
    { code: specs[14]!.code, type: "ANNUAL", start: dateKey(new Date(Date.now() + 20 * 86400000), TZ), end: dateKey(new Date(Date.now() + 23 * 86400000), TZ), days: "4.0", reason: "Mudik dan acara keluarga.", status: "MANAGER_REVIEW", createdAtDaysAgo: 2 },
    { code: specs[16]!.code, type: "EMERGENCY", start: dateKey(new Date(Date.now() + 1 * 86400000), TZ), end: dateKey(new Date(Date.now() + 1 * 86400000), TZ), days: "1.0", reason: "Keperluan darurat keluarga.", status: "MANAGER_REVIEW", createdAtDaysAgo: 1 },
    { code: specs[20]!.code, type: "ANNUAL", start: dateKey(new Date(Date.now() - 15 * 86400000), TZ), end: dateKey(new Date(Date.now() - 13 * 86400000), TZ), days: "3.0", reason: "Istirahat pribadi.", status: "APPROVED", createdAtDaysAgo: 18 },
    { code: specs[23]!.code, type: "MARRIAGE", start: dateKey(new Date(Date.now() + 30 * 86400000), TZ), end: dateKey(new Date(Date.now() + 32 * 86400000), TZ), days: "3.0", reason: "Pernikahan.", status: "HR_REVIEW", createdAtDaysAgo: 1 },
    { code: specs[26]!.code, type: "ANNUAL", start: dateKey(new Date(Date.now() + 9 * 86400000), TZ), end: dateKey(new Date(Date.now() + 10 * 86400000), TZ), days: "2.0", reason: "Menghadiri wisuda.", status: "SUBMITTED", createdAtDaysAgo: 1 },
    { code: specs[28]!.code, type: "UNPAID", start: dateKey(new Date(Date.now() + 25 * 86400000), TZ), end: dateKey(new Date(Date.now() + 27 * 86400000), TZ), days: "3.0", reason: "Urusan administrasi pribadi.", status: "HR_REVIEW", createdAtDaysAgo: 2 },
    { code: specs[31]!.code, type: "ANNUAL", start: dateKey(new Date(Date.now() - 40 * 86400000), TZ), end: dateKey(new Date(Date.now() - 38 * 86400000), TZ), days: "3.0", reason: "Liburan tahunan.", status: "APPROVED", createdAtDaysAgo: 45 },
    { code: specs[35]!.code, type: "SICK", start: dateKey(new Date(Date.now() - 8 * 86400000), TZ), end: dateKey(new Date(Date.now() - 7 * 86400000), TZ), days: "2.0", reason: "Rawat jalan.", status: "REJECTED", createdAtDaysAgo: 9 },
    { code: specs[9]!.code, type: "ANNUAL", start: dateKey(new Date(Date.now() - 5 * 86400000), TZ), end: dateKey(new Date(Date.now() - 4 * 86400000), TZ), days: "2.0", reason: "Acara sekolah anak.", status: "APPROVED", createdAtDaysAgo: 8 },
    { code: sari, type: "ANNUAL", start: dateKey(new Date(Date.now() + 40 * 86400000), TZ), end: dateKey(new Date(Date.now() + 44 * 86400000), TZ), days: "5.0", reason: "Liburan akhir tahun.", status: "SUBMITTED", createdAtDaysAgo: 1 },
  ];

  const year = NOW.getUTCFullYear();
  const usedByEmployeeType = new Map<string, number>();
  const pendingByEmployeeType = new Map<string, number>();
  let leaveSeq = 0;

  for (const seed of leaveSeeds) {
    leaveSeq += 1;
    const employeeId = employeeIdByCode.get(seed.code)!;
    const managerId = specs.find((s) => s.code === seed.code)?.managerCode;
    const approver = managerId ? userIdByEmail.get(demoUsers.find((u) => u.employeeCode === managerId)?.email ?? "") ?? null : null;
    const hrManagerId = userIdByEmail.get("sari.hr@nexahr.co.id")!;
    const isPending = ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW"].includes(seed.status);
    const currentStep = seed.status === "HR_REVIEW" ? 2 : seed.status === "MANAGER_REVIEW" ? 1 : seed.status === "SUBMITTED" ? 1 : seed.status === "APPROVED" || seed.status === "REJECTED" ? 2 : 0;

    const request = await prisma.leaveRequest.create({
      data: {
        tenantId,
        requestNumber: `LV/${year}/${String(leaveSeq).padStart(4, "0")}`,
        employeeId,
        leaveTypeId: leaveTypeByCode.get(seed.type)!.id,
        startDate: dateOnly(seed.start),
        endDate: dateOnly(seed.end),
        days: new Decimal(seed.days),
        reason: seed.reason,
        status: seed.status,
        currentStep,
        submittedAt: new Date(Date.now() - seed.createdAtDaysAgo * 86400000),
        decidedAt: seed.status === "APPROVED" || seed.status === "REJECTED" ? new Date(Date.now() - (seed.createdAtDaysAgo - 1) * 86400000) : null,
        createdAt: new Date(Date.now() - seed.createdAtDaysAgo * 86400000),
      },
    });

    for (const step of leaveWorkflow.steps.sort((a, b) => a.order - b.order)) {
      let status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED" = "PENDING";
      if (seed.status === "APPROVED") status = "APPROVED";
      else if (seed.status === "REJECTED") status = step.order === 1 ? "APPROVED" : "REJECTED";
      else if (currentStep > step.order) status = "APPROVED";
      await prisma.leaveApproval.create({
        data: {
          leaveRequestId: request.id,
          stepOrder: step.order,
          approverRole: step.roleSlug ?? "manager",
          approverId: step.order === 1 ? approver : hrManagerId,
          status,
          comment:
            status === "APPROVED"
              ? "Disetujui. Pastikan serah terima pekerjaan."
              : status === "REJECTED"
                ? "Ditolak karena kebutuhan operasional pada tanggal tersebut."
                : null,
          actedAt: status === "PENDING" ? null : new Date(Date.now() - (seed.createdAtDaysAgo - step.order) * 86400000),
        },
      });
    }

    const key = `${employeeId}:${seed.type}`;
    if (seed.status === "APPROVED") usedByEmployeeType.set(key, (usedByEmployeeType.get(key) ?? 0) + Number(seed.days));
    if (isPending) pendingByEmployeeType.set(key, (pendingByEmployeeType.get(key) ?? 0) + Number(seed.days));
  }

  // Leave balances for every employee/type
  for (const [code, employee] of employeeByCode) {
    for (const [typeCode, type] of leaveTypeByCode) {
      const key = `${employee.id}:${typeCode}`;
      const entitled = typeCode === "UNPAID" ? 0 : type.annualQuota;
      await prisma.leaveBalance.create({
        data: {
          tenantId,
          employeeId: employee.id,
          leaveTypeId: type.id,
          year,
          entitled: new Decimal(entitled),
          used: new Decimal(usedByEmployeeType.get(key) ?? 0),
          pending: new Decimal(pendingByEmployeeType.get(key) ?? 0),
          carriedOver: typeCode === "ANNUAL" ? new Decimal(2) : new Decimal(0),
        },
      });
    }
  }

  // Attendance history — 78 days back, weekdays only, deterministic
  const attendanceRows: {
    tenantId: string;
    employeeId: string;
    date: Date;
    clockIn: Date | null;
    clockOut: Date | null;
    status: "PRESENT" | "LATE" | "ABSENT" | "ON_LEAVE" | "HOLIDAY" | "REMOTE" | "HALF_DAY";
    source: "WEB" | "MOBILE" | "MANUAL";
    scheduleId: string;
    locationId: string;
    locationLat?: number;
    locationLng?: number;
    clockInLat?: number;
    clockInLng?: number;
    accuracyMeters?: number;
    distanceMeters?: number;
    geofencePassed?: boolean;
    lateMinutes: number;
    earlyLeaveMinutes: number;
    overtimeMinutes: number;
    workedMinutes: number;
  }[] = [];

  const attendanceSummary = new Map<string, { presentDays: number; overtimeMinutes: number }>();

  for (const [specIndex, spec] of specs.entries()) {
    const employeeId = employeeIdByCode.get(spec.code)!;
    const location = locations.get(spec.location)!;
    for (let back = 78; back >= 0; back -= 1) {
      const day = new Date(Date.now() - back * 86400000);
      const key = dateKey(day, TZ);
      const weekday = new Date(`${key}T00:00:00Z`).getUTCDay();
      if (weekday === 0 || weekday === 6) continue;
      if (holidaySet.has(key)) continue;
      const dayOnly = dateOnly(key);
      if (dayOnly < spec.hireDate) continue;
      if (spec.resignDate && dayOnly > spec.resignDate) continue;

      const roll = rand();
      const isToday = key === TODAY_KEY;
      let status: (typeof attendanceRows)[number]["status"] = "PRESENT";
      let clockIn: Date | null = null;
      let clockOut: Date | null = null;
      let lateMinutes = 0;
      let overtimeMinutes = 0;
      let workedMinutes = 0;

      if (isToday && specIndex % 9 === 0) {
        status = "ON_LEAVE";
      } else if (isToday && specIndex % 13 === 0) {
        status = "ABSENT";
      } else if (roll < 0.028) {
        status = "ABSENT";
      } else if (roll < 0.055) {
        status = "ON_LEAVE";
      } else {
        const startMinute = 8 * 60 + between(-12, 26);
        const lateThreshold = 8 * 60 + 45;
        lateMinutes = Math.max(0, startMinute - lateThreshold);
        status = lateMinutes > 0 ? "LATE" : rand() > 0.94 ? "REMOTE" : "PRESENT";
        const clockInLocal = `${String(Math.floor(startMinute / 60)).padStart(2, "0")}:${String(startMinute % 60).padStart(2, "0")}`;
        clockIn = zonedDateTime(key, clockInLocal, TZ);

        const overtime = rand() > 0.68 ? between(30, 105) : 0;
        overtimeMinutes = overtime;
        const endMinute = 17 * 60 + 30 + overtime;
        const clockOutLocal = `${String(Math.floor(endMinute / 60)).padStart(2, "0")}:${String(endMinute % 60).padStart(2, "0")}`;
        clockOut = isToday ? null : zonedDateTime(key, clockOutLocal, TZ);
        if (isToday && roll > 0.5) clockOut = null;
        workedMinutes = clockOut ? Math.max(0, Math.round((clockOut.getTime() - clockIn.getTime()) / 60000) - 60) : 0;
      }

      attendanceRows.push({
        tenantId,
        employeeId,
        date: dayOnly,
        clockIn,
        clockOut,
        status,
        source: pick(["WEB", "WEB", "MOBILE"]),
        scheduleId: scheduleRegular.id,
        locationId: location.id,
        clockInLat: clockIn ? location.latitude + (rand() - 0.5) * 0.0009 : undefined,
        clockInLng: clockIn ? location.longitude + (rand() - 0.5) * 0.0009 : undefined,
        accuracyMeters: clockIn ? Math.round(between(8, 45)) : undefined,
        distanceMeters: clockIn ? Math.round(between(12, 180)) : undefined,
        geofencePassed: clockIn ? true : undefined,
        lateMinutes,
        earlyLeaveMinutes: 0,
        overtimeMinutes,
        workedMinutes,
      });

      if (dayOnly >= prevMonth.start && dayOnly <= prevMonth.end && ["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(status)) {
        const summary = attendanceSummary.get(employeeId) ?? { presentDays: 0, overtimeMinutes: 0 };
        summary.presentDays += 1;
        summary.overtimeMinutes += overtimeMinutes;
        attendanceSummary.set(employeeId, summary);
      }
    }
  }

  // Make today's picture realistic for the dashboard demo: a few late arrivals.
  const todaysRows = attendanceRows.filter((row) => row.date.getTime() === today.getTime() && row.clockIn);
  for (const [index, offset] of [22, 37, 9, 48].entries()) {
    const row = todaysRows[index];
    if (!row) continue;
    const totalMinutes = 8 * 60 + 45 + offset;
    row.clockIn = zonedDateTime(
      TODAY_KEY,
      `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`,
      TZ,
    );
    row.status = "LATE";
    row.lateMinutes = offset;
    row.clockOut = null;
    row.workedMinutes = 0;
    row.overtimeMinutes = 0;
  }

  for (let i = 0; i < attendanceRows.length; i += 500) {
    await prisma.attendanceRecord.createMany({ data: attendanceRows.slice(i, i + 500) });
  }
  console.log(`  ${attendanceRows.length} catatan kehadiran`);

  // Attendance correction requests
  const budiAttendance = await prisma.attendanceRecord.findFirst({
    where: { employeeId: employeeIdByCode.get(budi)!, clockIn: { not: null } },
    orderBy: { date: "desc" },
  });
  if (budiAttendance) {
    await prisma.attendanceCorrection.create({
      data: {
        tenantId,
        attendanceId: budiAttendance.id,
        employeeId: employeeIdByCode.get(budi)!,
        requestedClockIn: new Date(budiAttendance.clockIn!.getTime() - 35 * 60000),
        reason: "Clock-in gagal karena aplikasi menutup sendiri. Mohon koreksi 35 menit lebih awal.",
        status: "PENDING",
      },
    });
  }
  const andiAttendance = await prisma.attendanceRecord.findFirst({
    where: { employeeId: employeeIdByCode.get(andi)!, clockOut: { not: null } },
    orderBy: { date: "desc" },
  });
  if (andiAttendance) {
    await prisma.attendanceCorrection.create({
      data: {
        tenantId,
        attendanceId: andiAttendance.id,
        employeeId: employeeIdByCode.get(andi)!,
        requestedClockOut: new Date(andiAttendance.clockOut!.getTime() + 45 * 60000),
        reason: "Menyelesaikan deployment produksi, clock-out terlambat tercatat.",
        status: "APPROVED",
        reviewedById: userIdByEmail.get("sari.hr@nexahr.co.id"),
        reviewNote: "Terverifikasi melalui log deployment.",
        reviewedAt: new Date(Date.now() - 2 * 86400000),
      },
    });
  }

  // Payroll configuration & policy
  const policy = await prisma.payrollPolicy.create({
    data: {
      tenantId,
      name: "Kebijakan Payroll 2026",
      version: 1,
      effectiveFrom: dateOnly(`${year}-01-01`),
      isActive: true,
      notes:
        "Konfigurasi contoh: tarif BPJS, PTKP, dan lapisan PPh 21 dapat diubah administrator. Bukan nasihat hukum; sesuaikan dengan regulasi yang berlaku.",
      config: {
        currency: "IDR",
        workingDaysPerMonth: 21,
        overtime: { weekdayMultiplier: 1.5, holidayMultiplier: 2, divisorHoursPerMonth: 173 },
        bpjs: {
          kesehatan: { employeePercent: 1, employerPercent: 4, maxBase: 12_000_000 },
          jht: { employeePercent: 2, employerPercent: 3.7 },
          jp: { employeePercent: 1, employerPercent: 2, maxBase: 10_042_300 },
          jkk: { employerPercent: 0.24 },
          jkm: { employerPercent: 0.3 },
        },
        tax: {
          method: "PROGRESIF_TAHUNAN",
          ptkp: { "TK/0": 54_000_000, "TK/1": 58_500_000, "TK/2": 63_000_000, "TK/3": 67_500_000, "K/0": 58_500_000, "K/1": 63_000_000, "K/2": 67_500_000, "K/3": 72_000_000 },
          brackets: [
            { upTo: 60_000_000, rate: 5 },
            { upTo: 250_000_000, rate: 15 },
            { upTo: 500_000_000, rate: 25 },
            { upTo: 5_000_000_000, rate: 30 },
            { upTo: null, rate: 35 },
          ],
        },
        rounding: "NEAREST_RUPIAH",
      },
    },
  });

  const componentsDef = [
    { code: "TUNJ_JABATAN", name: "Tunjangan Jabatan", type: "EARNING" as const, amount: 0, isTaxable: true, sortOrder: 1, description: "Tunjangan struktural sesuai level jabatan." },
    { code: "TUNJ_TRANSPORT", name: "Tunjangan Transport", type: "EARNING" as const, amount: 750_000, isTaxable: true, sortOrder: 2, description: "Biaya transportasi bulanan." },
    { code: "TUNJ_MAKAN", name: "Tunjangan Makan", type: "EARNING" as const, amount: 600_000, isTaxable: true, sortOrder: 3, description: "Uang makan bulanan." },
    { code: "TUNJ_KOMUNIKASI", name: "Tunjangan Komunikasi", type: "EARNING" as const, amount: 250_000, isTaxable: true, sortOrder: 4, description: "Paket data dan komunikasi." },
    { code: "POT_KOPERASI", name: "Simpanan Koperasi", type: "DEDUCTION" as const, amount: 200_000, isTaxable: false, sortOrder: 5, description: "Potongan sukarela koperasi karyawan." },
  ];
  const componentByCode = new Map<string, string>();
  for (const def of componentsDef) {
    const created = await prisma.payrollComponent.create({ data: { tenantId, calculation: "FIXED", isStatutory: false, isActive: true, ...def } });
    componentByCode.set(def.code, created.id);
  }

  for (const spec of specs) {
    const employeeId = employeeIdByCode.get(spec.code)!;
    const isLead = ["Manager", "Head", "Chief", "Direktur"].some((word) => spec.title.includes(word));
    const allowance = isLead ? 4_000_000 : spec.title.includes("Senior") ? 2_000_000 : 1_000_000;
    await prisma.employeePayrollComponent.create({
      data: { employeeId, componentId: componentByCode.get("TUNJ_JABATAN")!, amount: new Decimal(allowance), effectiveFrom: spec.hireDate },
    });
    await prisma.employeePayrollComponent.create({
      data: { employeeId, componentId: componentByCode.get("TUNJ_TRANSPORT")!, amount: new Decimal(750_000), effectiveFrom: spec.hireDate },
    });
    await prisma.employeePayrollComponent.create({
      data: { employeeId, componentId: componentByCode.get("TUNJ_MAKAN")!, amount: new Decimal(600_000), effectiveFrom: spec.hireDate },
    });
    if (rand() > 0.6) {
      await prisma.employeePayrollComponent.create({
        data: { employeeId, componentId: componentByCode.get("TUNJ_KOMUNIKASI")!, amount: new Decimal(250_000), effectiveFrom: spec.hireDate },
      });
    }
    if (rand() > 0.75) {
      await prisma.employeePayrollComponent.create({
        data: { employeeId, componentId: componentByCode.get("POT_KOPERASI")!, amount: new Decimal(200_000), effectiveFrom: spec.hireDate },
      });
    }
  }

  const policyConfig = parsePolicyConfig(policy.config);
  const allComponents = await prisma.payrollComponent.findMany({ where: { tenantId } });
  const employeeComponents = await prisma.employeePayrollComponent.findMany({ where: { employee: { tenantId } } });

  async function buildPeriod(offset: number, status: "PAID" | "DRAFT") {
    const info = monthInfo(offset);
    const code = `PR-${info.year}${String(info.month).padStart(2, "0")}`;
    const name = `Payroll ${new Date(Date.UTC(info.year, info.month - 1, 1)).toLocaleString("id-ID", { month: "long", year: "numeric" })}`;
    const period = await prisma.payrollPeriod.create({
      data: {
        tenantId,
        name,
        code,
        startDate: info.start,
        endDate: info.end,
        payDate: new Date(Date.UTC(info.year, info.month, 25)),
        status,
        policyId: policy.id,
        processedAt: status === "PAID" ? new Date(Date.UTC(info.year, info.month, 24)) : null,
        approvedAt: status === "PAID" ? new Date(Date.UTC(info.year, info.month, 24)) : null,
        approvedById: status === "PAID" ? userIdByEmail.get("sari.hr@nexahr.co.id") : null,
        paidAt: status === "PAID" ? new Date(Date.UTC(info.year, info.month, 25)) : null,
      },
    });

    if (status !== "PAID") return period;

    let grossTotal = new Decimal(0);
    let deductionTotal = new Decimal(0);
    let netTotal = new Decimal(0);
    let count = 0;

    for (const spec of specs) {
      if (spec.status === "RESIGNED") continue;
      const employeeId = employeeIdByCode.get(spec.code)!;
      const summary = attendanceSummary.get(employeeId) ?? { presentDays: 21, overtimeMinutes: 0 };
      const components = employeeComponents
        .filter((row) => row.employeeId === employeeId)
        .map((row) => {
          const component = allComponents.find((c) => c.id === row.componentId)!;
          return {
            component: {
              code: component.code,
              name: component.name,
              type: component.type,
              calculation: component.calculation,
              amount: component.amount.toString(),
              percent: component.percent?.toString() ?? null,
              isTaxable: component.isTaxable,
              isStatutory: component.isStatutory,
            },
            amount: row.amount.toString(),
          };
        });

      const result = computePayroll(
        {
          employeeId,
          employeeCode: spec.code,
          employeeName: `${spec.first} ${spec.last}`,
          basicSalary: spec.salary,
          ptkpStatus: spec.ptkp,
          components,
          attendance: { presentDays: summary.presentDays, unpaidLeaveDays: 0, overtimeMinutes: summary.overtimeMinutes },
        },
        policyConfig,
      );

      const record = await prisma.payrollRecord.create({
        data: {
          tenantId,
          periodId: period.id,
          employeeId,
          basicSalary: new Decimal(result.basicSalary),
          grossPay: new Decimal(result.grossPay),
          taxableGross: new Decimal(result.taxableGross),
          totalDeductions: new Decimal(result.totalDeductions),
          netPay: new Decimal(result.netPay),
          overtimeHours: new Decimal(result.overtimeHours),
          overtimePay: new Decimal(result.overtimePay),
          attendanceDays: result.attendanceDays,
          unpaidLeaveDays: new Decimal(result.unpaidLeaveDays),
          items: { lines: result.lines, employerContributions: result.employerContributions } as object,
          status: "PAID",
        },
      });
      await prisma.payslip.create({
        data: {
          payrollRecordId: record.id,
          number: `PS/${info.year}${String(info.month).padStart(2, "0")}/${spec.code}`,
          issuedAt: new Date(Date.UTC(info.year, info.month, 25)),
        },
      });

      grossTotal = grossTotal.plus(new Decimal(result.grossPay));
      deductionTotal = deductionTotal.plus(new Decimal(result.totalDeductions));
      netTotal = netTotal.plus(new Decimal(result.netPay));
      count += 1;
    }

    await prisma.payrollPeriod.update({
      where: { id: period.id },
      data: { grossTotal, deductionTotal, netTotal, employeeCount: count },
    });
    return period;
  }

  await buildPeriod(-1, "PAID");
  await buildPeriod(0, "DRAFT");
  await buildPeriod(-2, "PAID");
  console.log("  payroll: 2 periode dibayar, 1 periode draf");

  // Recruitment
  const requisitionApproved = await prisma.jobRequisition.create({
    data: { tenantId, title: "Senior Software Engineer", departmentId: deptByCode.get("TECH"), headcount: 2, reason: "Ekspansi tim platform.", status: "APPROVED", requestedById: employeeIdByCode.get(andi), approvedById: userIdByEmail.get("sari.hr@nexahr.co.id") },
  });
  const requisitionPending = await prisma.jobRequisition.create({
    data: { tenantId, title: "Product Designer", departmentId: deptByCode.get("PRD"), headcount: 1, reason: "Pengganti karyawan yang mengundurkan diri.", status: "PENDING", requestedById: employeeIdByCode.get(citra) },
  });
  await prisma.jobRequisition.create({
    data: { tenantId, title: "Account Executive", departmentId: deptByCode.get("SLS"), headcount: 2, reason: "Target ekspansi wilayah Surabaya.", status: "PENDING", requestedById: employeeIdByCode.get(yoga) },
  });

  const vacancyDefs = [
    { title: "Senior Software Engineer", code: "VAC-TECH-001", dept: "TECH", position: "Senior Software Engineer", status: "OPEN" as const, openings: 2, requisitionId: requisitionApproved.id, salaryMin: 17_000_000, salaryMax: 24_000_000, mode: "HYBRID", description: "Bergabung dengan tim platform untuk membangun layanan HRIS berskala enterprise. Anda akan memimpin desain modul, meninjau kode, dan meningkatkan keandalan sistem." },
    { title: "Product Designer", code: "VAC-PRD-002", dept: "PRD", position: "Product Designer", status: "OPEN" as const, openings: 1, requisitionId: requisitionPending.id, salaryMin: 13_000_000, salaryMax: 18_000_000, mode: "REMOTE", description: "Rancang alur kerja HR yang kompleks menjadi pengalaman yang sederhana, didukung riset pengguna dan design system internal." },
    { title: "Payroll Specialist", code: "VAC-FIN-003", dept: "FIN", position: "Payroll Specialist", status: "OPEN" as const, openings: 1, salaryMin: 10_000_000, salaryMax: 14_000_000, mode: "ONSITE", description: "Mengelola siklus payroll bulanan, kepatuhan BPJS, dan rekonsiliasi komponen gaji." },
    { title: "Account Executive", code: "VAC-SLS-004", dept: "SLS", position: "Account Executive", status: "ON_HOLD" as const, openings: 2, salaryMin: 11_000_000, salaryMax: 16_000_000, mode: "FIELD", description: "Membangun pipeline pelanggan enterprise di wilayah Jawa Timur." },
    { title: "Content Strategist", code: "VAC-MKT-005", dept: "MKT", position: "Content Strategist", status: "DRAFT" as const, openings: 1, salaryMin: 10_000_000, salaryMax: 13_000_000, mode: "HYBRID", description: "Menyusun strategi konten untuk kanal LinkedIn dan blog perusahaan." },
  ];

  const vacancyIds: string[] = [];
  for (const [index, def] of vacancyDefs.entries()) {
    const vacancy = await prisma.jobVacancy.create({
      data: {
        tenantId,
        title: def.title,
        code: def.code,
        departmentId: deptByCode.get(def.dept),
        positionId: positionByTitle.get(def.position),
        requisitionId: def.requisitionId,
        employmentType: "PERMANENT",
        location: LOCATIONS.find((l) => l.code === "JKT")!.name,
        workMode: def.mode,
        description: def.description,
        requirements: "Pengalaman minimal 3 tahun pada peran serupa. Kemampuan komunikasi dan kolaborasi yang kuat.",
        salaryMin: new Decimal(def.salaryMin),
        salaryMax: new Decimal(def.salaryMax),
        openings: def.openings,
        status: def.status,
        publishedAt: def.status === "OPEN" ? new Date(Date.now() - (index + 2) * 86400000) : null,
        closingDate: new Date(Date.now() + 30 * 86400000),
      },
    });
    vacancyIds.push(vacancy.id);
  }

  const candidateNames = ["Alya Ramadhani", "Bagus Firmansyah", "Clara Wijaya", "Dedi Kurniawan", "Erika Putri", "Farhan Maulana", "Gita Puspitasari", "Hadi Susanto", "Indah Cahyani", "Joko Setiawan", "Kirana Maharani", "Lukman Hakim", "Mira Andini", "Naufal Rizki", "Oktavia Sari", "Pandu Wibowo", "Qori Amalia", "Rangga Pratama", "Sella Marlina", "Taufik Hidayat", "Umi Kalsum", "Vina Anggraini", "Wahyu Saputra", "Yuni Astuti"];
  const stages: ("APPLIED" | "SCREENING" | "INTERVIEW" | "ASSESSMENT" | "OFFERING" | "HIRED" | "REJECTED")[] = [
    "APPLIED", "APPLIED", "APPLIED", "SCREENING", "SCREENING", "SCREENING", "INTERVIEW", "INTERVIEW", "INTERVIEW", "ASSESSMENT", "ASSESSMENT", "OFFERING", "OFFERING", "HIRED", "HIRED", "REJECTED", "REJECTED", "SCREENING", "INTERVIEW", "APPLIED", "ASSESSMENT", "REJECTED", "SCREENING", "APPLIED",
  ];

  const applicationIds: string[] = [];
  for (let i = 0; i < candidateNames.length; i += 1) {
    const name = candidateNames[i]!;
    const [first, ...rest] = name.split(" ");
    const stage = stages[i]!;
    const vacancyIndex = i % 3;
    const application = await prisma.recruitmentApplication.create({
      data: {
        tenantId,
        vacancyId: vacancyIds[vacancyIndex]!,
        candidateName: name,
        candidateEmail: `${first}.${rest.join("")}`.toLowerCase() + "@candidate.example",
        candidatePhone: `+62 8${between(11, 19)}-${between(1000, 9999)}-${between(1000, 9999)}`,
        source: pick(["CAREERS_PAGE", "LINKEDIN", "REFERRAL", "JOB_PORTAL"]),
        stage,
        rating: stage === "APPLIED" ? null : between(2, 5),
        notes: stage === "REJECTED" ? "Tidak melanjutkan proses rekrutmen." : null,
        appliedAt: new Date(Date.now() - between(2, 26) * 86400000),
      },
    });
    applicationIds.push(application.id);
  }

  for (let i = 0; i < 6; i += 1) {
    await prisma.interview.create({
      data: {
        tenantId,
        applicationId: applicationIds[6 + i]!,
        scheduledAt: new Date(Date.now() + (i - 2) * 86400000 + 3 * 3600000),
        durationMinutes: 60,
        mode: i % 3 === 0 ? "ONSITE" : "ONLINE",
        interviewerName: ["Andi Kurniawan", "Citra Lestari", "Fajar Nugroho"][i % 3],
        location: i % 3 === 0 ? "Jakarta HQ — Ruang Merapi" : "Google Meet",
        notes: "Wawancara teknis & diskusi studi kasus.",
        score: i < 3 ? between(3, 5) : null,
        recommendation: i < 3 ? pick(["STRONG_HIRE", "HIRE", "CONSIDER"]) : null,
        completedAt: i < 3 ? new Date(Date.now() - (i + 1) * 86400000) : null,
      },
    });
  }

  await prisma.offer.createMany({
    data: [
      { tenantId, applicationId: applicationIds[13]!, positionTitle: "Senior Software Engineer", salary: new Decimal(20_500_000), startDate: new Date(Date.now() + 21 * 86400000), status: "SENT", expiresAt: new Date(Date.now() + 7 * 86400000), notes: "Penawaran awal, termasuk tunjangan transport dan komunikasi." },
      { tenantId, applicationId: applicationIds[14]!, positionTitle: "Product Designer", salary: new Decimal(15_000_000), startDate: new Date(Date.now() + 30 * 86400000), status: "ACCEPTED", expiresAt: new Date(Date.now() + 5 * 86400000), notes: "Kandidat menerima penawaran melalui email." },
      { tenantId, applicationId: applicationIds[0]!, positionTitle: "Senior Software Engineer", salary: new Decimal(19_000_000), startDate: new Date(Date.now() + 45 * 86400000), status: "DRAFT" },
    ],
  });

  const onboardingTemplate = ["Tanda tangan kontrak kerja", "Verifikasi dokumen KTP & NPWP", "Pendaftaran BPJS Kesehatan & Ketenagakerjaan", "Penyiapan laptop dan akun email", "Orientasi budaya perusahaan", "Penetapan mentor 30 hari pertama", "Pengenalan SOP keamanan informasi"];
  for (const [index, title] of onboardingTemplate.entries()) {
    await prisma.onboardingTask.create({
      data: {
        tenantId,
        applicationId: applicationIds[14]!,
        title,
        category: index < 3 ? "ADMINISTRASI" : index < 5 ? "ONBOARDING" : "IT",
        assignee: index < 2 ? "Rizky Pratama" : "Nadia Permata",
        dueDate: new Date(Date.now() + (index + 1) * 86400000),
        isCompleted: index < 3,
        completedAt: index < 3 ? new Date(Date.now() - 86400000) : null,
        sortOrder: index,
      },
    });
  }

  // Performance
  const cycle = await prisma.reviewCycle.create({
    data: {
      tenantId,
      name: `Siklus Kinerja Semester II ${year}`,
      description: "Penilaian kinerja semester kedua dengan penilaian diri, review manajer, dan kalibrasi.",
      periodStart: dateOnly(`${year}-07-01`),
      periodEnd: dateOnly(`${year}-12-31`),
      status: "ACTIVE",
    },
  });
  await prisma.reviewCycle.create({
    data: { tenantId, name: `Siklus Kinerja Semester I ${year}`, description: "Siklus yang telah ditutup.", periodStart: dateOnly(`${year}-01-01`), periodEnd: dateOnly(`${year}-06-30`), status: "CLOSED" },
  });

  const reviewTargets = specs.filter((s) => !["MGT"].includes(s.dept) && s.status !== "RESIGNED").slice(0, 22);
  for (const [index, spec] of reviewTargets.entries()) {
    const reviewerSpec = specs.find((s) => s.code === spec.managerCode);
    const status = index % 5 === 0 ? "COMPLETED" : index % 4 === 0 ? "MANAGER_REVIEW" : index % 3 === 0 ? "SELF_ASSESSED" : "DRAFT";
    const managerScore = status === "COMPLETED" || status === "MANAGER_REVIEW" ? (3.2 + rand() * 1.6).toFixed(2) : null;
    await prisma.performanceReview.create({
      data: {
        tenantId,
        cycleId: cycle.id,
        employeeId: employeeIdByCode.get(spec.code)!,
        reviewerId: reviewerSpec ? employeeIdByCode.get(reviewerSpec.code)! : null,
        status,
        selfAssessment:
          status === "DRAFT"
            ? null
            : "Saya berhasil menyelesaikan inisiatif utama semester ini dan meningkatkan kolaborasi lintas tim.",
        managerAssessment: managerScore ? "Kontribusi konsisten, inisiatif tinggi, dan mampu memimpin inisiatif lintas fungsi." : null,
        selfScore: status === "DRAFT" ? null : new Decimal((3.4 + rand() * 1.3).toFixed(2)),
        managerScore: managerScore ? new Decimal(managerScore) : null,
        finalScore: status === "COMPLETED" && managerScore ? new Decimal(managerScore) : null,
        rating: status === "COMPLETED" ? pick(["MEETS_EXPECTATIONS", "EXCEEDS_EXPECTATIONS", "OUTSTANDING"]) : null,
        strengths: managerScore ? "Kolaborasi, kepemilikan tugas, dan kualitas eksekusi." : null,
        improvements: managerScore ? "Perlu meningkatkan dokumentasi keputusan teknis." : null,
        completedAt: status === "COMPLETED" ? new Date(Date.now() - between(1, 20) * 86400000) : null,
      },
    });
  }

  for (const [index, spec] of reviewTargets.slice(0, 16).entries()) {
    const target = [5, 10, 8, 3][index % 4]!;
    const current = Math.round(target * (0.4 + rand() * 0.75));
    await prisma.performanceGoal.create({
      data: {
        tenantId,
        employeeId: employeeIdByCode.get(spec.code)!,
        cycleId: cycle.id,
        title: ["Meningkatkan keandalan layanan", "Menurunkan waktu rekrutmen", "Menyelesaikan roadmap produk", "Meningkatkan kepuasan pelanggan"][index % 4]!,
        description: "Tujuan individu yang disepakati bersama atasan langsung pada awal siklus.",
        metric: ["Uptime platform", "Hari per rekrutmen", "Fitur rilis", "Skor CSAT"][index % 4]!,
        targetValue: new Decimal(target),
        currentValue: new Decimal(current),
        unit: ["%", "hari", "fitur", "poin"][index % 4]!,
        weight: [30, 25, 25, 20][index % 4]!,
        status: current >= target ? "ACHIEVED" : current > 0 ? "IN_PROGRESS" : "NOT_STARTED",
        dueDate: dateOnly(`${year}-12-31`),
      },
    });
  }

  // Documents with real, downloadable PDFs
  const uploadsRoot = path.resolve(process.env.UPLOADS_DIR ?? ".uploads");
  const documentDefs: { employee: string; type: "KONTRAK" | "KTP" | "IJAZAH" | "NPWP" | "SERTIFIKAT"; name: string }[] = [];
  for (const code of [budi, sari, andi, specs[14]!.code, specs[21]!.code, specs[30]!.code]) {
    documentDefs.push({ employee: code, type: "KONTRAK", name: "Kontrak Kerja" });
    documentDefs.push({ employee: code, type: "KTP", name: "Kartu Tanda Penduduk" });
  }
  documentDefs.push({ employee: budi, type: "IJAZAH", name: "Ijazah Sarjana Teknik Informatika" });
  documentDefs.push({ employee: sari, type: "SERTIFIKAT", name: "Sertifikasi CHRP" });

  let documentSeq = 0;
  for (const doc of documentDefs) {
    documentSeq += 1;
    const employeeId = employeeIdByCode.get(doc.employee)!;
    const spec = specs.find((s) => s.code === doc.employee)!;
    const storageKey = `${tenantId}/${doc.employee}/doc-${documentSeq}.pdf`;
    const filePath = path.join(uploadsRoot, storageKey);
    mkdirSync(path.dirname(filePath), { recursive: true });
    const pdf = buildPdf(doc.name, [
      `Nama: ${spec.first} ${spec.last}`,
      `ID Karyawan: ${spec.code}`,
      `Departemen: ${DEPARTMENTS.find((d) => d.code === spec.dept)?.name}`,
      `Jabatan: ${spec.title}`,
      `Tanggal bergabung: ${spec.hireDate.toISOString().slice(0, 10)}`,
      "",
      "Dokumen ini dihasilkan otomatis oleh seed NexaHR untuk keperluan demonstrasi.",
    ]);
    writeFileSync(filePath, pdf);
    await prisma.employeeDocument.create({
      data: {
        tenantId,
        employeeId,
        type: doc.type,
        name: doc.name,
        fileName: `${doc.type.toLowerCase()}-${spec.code}.pdf`,
        storageKey,
        mimeType: "application/pdf",
        sizeBytes: pdf.byteLength,
        uploadedById: userIdByEmail.get("rizky.hr@nexahr.co.id"),
      },
    });
  }

  // Notifications
  const notifications: { email: string; type: "INFO" | "APPROVAL" | "ALERT" | "SYSTEM"; title: string; body: string; href: string; read: boolean; hoursAgo: number }[] = [
    { email: "sari.hr@nexahr.co.id", type: "APPROVAL", title: "3 pengajuan cuti menunggu verifikasi HR", body: "Termasuk pengajuan Andi Kurniawan dan Rizky Pratama.", href: "/leave?status=HR_REVIEW", read: false, hoursAgo: 1 },
    { email: "sari.hr@nexahr.co.id", type: "ALERT", title: "Payroll bulan ini belum diproses", body: "Periode payroll berjalan masih berstatus draf. Batas proses tanggal 25.", href: "/payroll", read: false, hoursAgo: 5 },
    { email: "sari.hr@nexahr.co.id", type: "INFO", title: "Kontrak akan berakhir dalam 30 hari", body: "2 karyawan kontrak mendekati tanggal berakhir kontrak.", href: "/employees?status=CONTRACT", read: true, hoursAgo: 26 },
    { email: "andi.manager@nexahr.co.id", type: "APPROVAL", title: "Pengajuan cuti Budi Santoso", body: "Cuti tahunan 3 hari, menunggu persetujuan Anda.", href: "/leave", read: false, hoursAgo: 2 },
    { email: "andi.manager@nexahr.co.id", type: "INFO", title: "Penilaian kinerja tim", body: "Semester II: 4 anggota tim belum menyelesaikan penilaian diri.", href: "/performance", read: true, hoursAgo: 40 },
    { email: "budi.santoso@nexahr.co.id", type: "INFO", title: "Slip gaji tersedia", body: "Slip gaji periode lalu sudah dapat diunduh.", href: "/payroll", read: false, hoursAgo: 20 },
    { email: "budi.santoso@nexahr.co.id", type: "APPROVAL", title: "Koreksi kehadiran diajukan", body: "Permintaan koreksi clock-in sedang ditinjau atasan langsung.", href: "/attendance", read: true, hoursAgo: 30 },
    { email: "admin@nexahr.co.id", type: "SYSTEM", title: "Selamat datang di NexaHR", body: "Tenant Nusantara Digital Group berhasil dikonfigurasi dengan data demonstrasi.", href: "/settings", read: false, hoursAgo: 8 },
    { email: "rizky.hr@nexahr.co.id", type: "ALERT", title: "7 karyawan belum melengkapi dokumen", body: "Lengkapi NPWP dan BPJS sebelum proses payroll berikutnya.", href: "/documents", read: false, hoursAgo: 12 },
  ];
  for (const notification of notifications) {
    const userId = userIdByEmail.get(notification.email);
    if (!userId) continue;
    await prisma.notification.create({
      data: {
        tenantId,
        userId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        href: notification.href,
        readAt: notification.read ? new Date(Date.now() - (notification.hoursAgo - 1) * 3600000) : null,
        createdAt: new Date(Date.now() - notification.hoursAgo * 3600000),
      },
    });
  }

  // System settings
  await prisma.systemSetting.createMany({
    data: [
      { tenantId, key: "attendance.policy", category: "kehadiran", value: { geofenceRequired: false, remoteAllowed: true, faceVerificationEnabled: false, lateGraceMinutes: 15, correctionWindowDays: 14 } },
      { tenantId, key: "payroll.cutoff", category: "payroll", value: { cutoffDay: 25, autoProcessEnabled: false, requiresApproval: true } },
      { tenantId, key: "ai.config", category: "ai", value: { enabled: false, allowConfidentialData: false, model: "gpt-4o-mini", provider: "openai-compatible" } },
      { tenantId, key: "notification.email", category: "notifikasi", value: { leaveSubmitted: true, leaveDecided: true, payslipIssued: true, contractExpiring: true } },
      { tenantId, key: "branding", category: "umum", value: { primaryColor: "#4f46e5", locale: "id-ID", dateFormat: "dd MMM yyyy" } },
    ],
  });

  // Audit trail samples
  const auditSeeds = [
    { actor: "sari.hr@nexahr.co.id", action: "employee.viewed_sensitive", module: "karyawan", entity: "Employee", note: "Melihat detail NIK karyawan" },
    { actor: "sari.hr@nexahr.co.id", action: "leave.approved", module: "cuti", entity: "LeaveRequest", note: "Menyetujui cuti tahunan" },
    { actor: "admin@nexahr.co.id", action: "role.permissions_updated", module: "pengaturan", entity: "Role", note: "Memperbarui izin HR Staff" },
    { actor: "andi.manager@nexahr.co.id", action: "attendance.correction_approved", module: "kehadiran", entity: "AttendanceCorrection", note: "Menyetujui koreksi clock-out" },
    { actor: "sari.hr@nexahr.co.id", action: "payroll.approved", module: "payroll", entity: "PayrollPeriod", note: "Menyetujui payroll periode lalu" },
    { actor: "rizky.hr@nexahr.co.id", action: "document.uploaded", module: "dokumen", entity: "EmployeeDocument", note: "Mengunggah kontrak kerja" },
    { actor: "sari.hr@nexahr.co.id", action: "leave.rejected", module: "cuti", entity: "LeaveRequest", note: "Menolak pengajuan cuti sakit tanpa surat" },
    { actor: "admin@nexahr.co.id", action: "payroll.policy_updated", module: "payroll", entity: "PayrollPolicy", note: "Memperbarui konfigurasi kebijakan payroll" },
  ];
  for (const [index, item] of auditSeeds.entries()) {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorId: userIdByEmail.get(item.actor),
        actorName: demoUsers.find((u) => u.email === item.actor)?.name,
        action: item.action,
        module: item.module,
        entityType: item.entity,
        metadata: { note: item.note },
        ipAddress: "103.28.14.22",
        createdAt: new Date(Date.now() - (index + 1) * 5 * 3600000),
      },
    });
  }

  const counts = {
    employees: specs.length,
    attendance: attendanceRows.length,
    leaveRequests: leaveSeeds.length,
    vacancies: vacancyDefs.length,
    applications: candidateNames.length,
    reviews: reviewTargets.length,
  };
  console.log("Seed selesai:", counts);
  console.log("Masuk dengan: sari.hr@nexahr.co.id / NexaHR#2026 (HR Manager)");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
