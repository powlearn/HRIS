import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { dateOnly, formatDate } from "@/lib/time";
import { decimalFromDb } from "@/lib/money";
import { PAYROLL_STATUS, LEAVE_STATUS } from "@/lib/design";
import { chatCompletion, getAiRuntime } from "@/modules/ai/provider";

export type CopilotContext = {
  headcount: number;
  inactive: number;
  present30: number;
  late30: number;
  absent30: number;
  onLeave30: number;
  overtimeHours30: number;
  pendingLeave: number;
  openVacancies: number;
  activeCandidates: number;
  incompleteRecords: { name: string; missing: string[] }[];
  leaveTypes: { name: string; quota: number; requiresDocument: boolean; isPaid: boolean }[];
  contractsExpiring: number;
  latestPayroll: { name: string; status: string; employees: number; netTotal: string } | null;
  myBalance: { name: string; remaining: number }[];
};

export async function buildCopilotContext(user: SessionUser): Promise<CopilotContext> {
  const tenantId = user.tenantId;
  const monthAgo = new Date(Date.now() - 30 * 86400000);
  const today = dateOnly(new Date().toISOString().slice(0, 10));
  const canSeeSensitive = hasPermission(user.permissions, "employee.sensitive.read");
  const canReadEmployees = hasPermission(user.permissions, ["employee.read", "employee.read.team"]);

  const [headcount, inactive, attendance, pendingLeave, leaveTypes, vacancies, candidates, employees, contractsExpiring, payroll, balances] =
    await Promise.all([
      prisma.employee.count({ where: { tenantId, status: { in: ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"] } } }),
      prisma.employee.count({ where: { tenantId, status: { in: ["RESIGNED", "TERMINATED"] } } }),
      prisma.attendanceRecord.findMany({
        where: { tenantId, date: { gte: monthAgo } },
        select: { status: true, overtimeMinutes: true },
      }),
      prisma.leaveRequest.count({ where: { tenantId, status: { in: ["SUBMITTED", "MANAGER_REVIEW", "HR_REVIEW"] } } }),
      prisma.leaveType.findMany({ where: { tenantId, isActive: true }, orderBy: { name: "asc" } }),
      prisma.jobVacancy.count({ where: { tenantId, status: "OPEN" } }),
      prisma.recruitmentApplication.count({ where: { tenantId, stage: { notIn: ["HIRED", "REJECTED"] } } }),
      canReadEmployees
        ? prisma.employee.findMany({
            where: { tenantId, status: { in: ["PERMANENT", "CONTRACT", "PROBATION", "INTERN"] } },
            select: {
              firstName: true,
              lastName: true,
              employeeCode: true,
              npwpEnc: true,
              bankAccountEnc: true,
              contracts: { select: { id: true, status: true } },
            },
          })
        : Promise.resolve([]),
      prisma.employmentContract.count({
        where: { tenantId, status: "ACTIVE", endDate: { gte: today, lte: new Date(today.getTime() + 45 * 86400000) } },
      }),
      prisma.payrollPeriod.findFirst({ where: { tenantId }, orderBy: { startDate: "desc" } }),
      user.employeeId
        ? prisma.leaveBalance.findMany({
            where: { tenantId, employeeId: user.employeeId, year: new Date().getUTCFullYear() },
            include: { leaveType: { select: { name: true } } },
          })
        : Promise.resolve([]),
    ]);

  const incompleteRecords = employees
    .map((employee) => {
      const missing: string[] = [];
      if (!employee.npwpEnc) missing.push("NPWP");
      if (!employee.bankAccountEnc) missing.push("rekening bank");
      if (!employee.contracts.some((contract) => contract.status === "ACTIVE")) missing.push("kontrak aktif");
      return { name: `${employee.firstName} ${employee.lastName ?? ""}`.trim(), missing };
    })
    .filter((row) => row.missing.length > 0)
    .slice(0, 12);

  return {
    headcount,
    inactive,
    present30: attendance.filter((row) => ["PRESENT", "LATE", "REMOTE", "HALF_DAY"].includes(row.status)).length,
    late30: attendance.filter((row) => row.status === "LATE").length,
    absent30: attendance.filter((row) => row.status === "ABSENT").length,
    onLeave30: attendance.filter((row) => row.status === "ON_LEAVE").length,
    overtimeHours30: Math.round(attendance.reduce((acc, row) => acc + row.overtimeMinutes, 0) / 60),
    pendingLeave,
    openVacancies: vacancies,
    activeCandidates: candidates,
    incompleteRecords: canSeeSensitive ? incompleteRecords : incompleteRecords.map((row) => ({ name: "Karyawan", missing: row.missing })),
    leaveTypes: leaveTypes.map((type) => ({ name: type.name, quota: type.annualQuota, requiresDocument: type.requiresDocument, isPaid: type.isPaid })),
    contractsExpiring,
    latestPayroll: payroll
      ? {
          name: payroll.name,
          status: PAYROLL_STATUS[payroll.status]?.label ?? payroll.status,
          employees: payroll.employeeCount,
          netTotal: decimalFromDb(payroll.netTotal).toFixed(0),
        }
      : null,
    myBalance: balances.map((balance) => ({
      name: balance.leaveType.name,
      remaining: Math.max(
        0,
        decimalFromDb(balance.entitled)
          .plus(decimalFromDb(balance.carriedOver))
          .minus(decimalFromDb(balance.used))
          .minus(decimalFromDb(balance.pending))
          .toNumber(),
      ),
    })),
  };
}

function localAnswer(message: string, context: CopilotContext): string {
  const text = message.toLowerCase();
  if (/(cuti|izin|libur|leave)/.test(text)) {
    const quotas = context.leaveTypes
      .map((type) => `• ${type.name}: kuota ${type.quota} hari${type.requiresDocument ? ", wajib dokumen" : ""}${type.isPaid ? "" : ", tidak berbayar"}`)
      .join("\n");
    const mine = context.myBalance.map((balance) => `${balance.name}: sisa ${balance.remaining} hari`).join(", ");
    return [
      "Kebijakan cuti tenant Anda:",
      quotas || "• Belum ada jenis cuti dikonfigurasi.",
      context.myBalance.length ? `\nSaldo Anda: ${mine}.` : "",
      `\nSaat ini ada ${context.pendingLeave} pengajuan menunggu persetujuan. Alur standar: atasan langsung → HR → disetujui.`,
      "\nBuka menu Cuti & Izin untuk mengajukan. Pengajuan otomatis memeriksa bentrok tanggal dan saldo.",
    ]
      .filter(Boolean)
      .join("\n");
  }
  if (/(kehadiran|absensi|terlambat|lembur|attendance)/.test(text)) {
    const total = context.present30 + context.late30 + context.absent30 + context.onLeave30;
    const rate = total > 0 ? ((context.present30 / total) * 100).toFixed(1) : "0";
    return [
      `Ringkasan 30 hari terakhir: ${context.present30} catatan hadir, ${context.late30} terlambat, ${context.absent30} tidak hadir, ${context.onLeave30} cuti.`,
      `Tingkat kehadiran ${rate}% dengan total lembur ${context.overtimeHours30} jam.`,
      "\nCatatan: verifikasi lokasi berbasis GPS bersifat indikatif dan tidak anti-manipulasi. Koreksi kehadiran harus disetujui atasan dan tercatat di audit log.",
    ].join("\n");
  }
  if (/(gaji|payroll|slip|tunjangan|pph|bpjs)/.test(text)) {
    return [
      context.latestPayroll
        ? `Periode payroll terakhir: ${context.latestPayroll.name} (${context.latestPayroll.status}), ${context.latestPayroll.employees} karyawan, total bersih Rp ${Number(context.latestPayroll.netTotal).toLocaleString("id-ID")}.`
        : "Belum ada periode payroll tercatat.",
      "\nProses: draf → proses (perhitungan Decimal berdasarkan kebijakan berversi) → persetujuan HR → dibayar. Tarif BPJS/PPh 21 dibaca dari kebijakan tenant, bukan dari kode program.",
      "AI tidak dapat menyetujui atau mengubah nilai payroll. Semua keputusan memerlukan persetujuan manusia dan tercatat di audit log.",
    ].join("\n");
  }
  if (/(lengkapi|tidak lengkap|data karyawan|dokumen|npwp|rekening)/.test(text)) {
    if (context.incompleteRecords.length === 0) {
      return "Semua karyawan aktif memiliki NPWP, rekening bank, dan kontrak aktif. Tidak ada catatan yang perlu dilengkapi.";
    }
    const rows = context.incompleteRecords.map((row) => `• ${row.name} — belum: ${row.missing.join(", ")}`).join("\n");
    return `Terdapat ${context.incompleteRecords.length} karyawan dengan data belum lengkap:\n${rows}\n\nLengkapi melalui halaman Karyawan → detail → Ubah data.`;
  }
  if (/(rekrutmen|lowongan|kandidat|onboarding)/.test(text)) {
    return `Saat ini ada ${context.openVacancies} lowongan terbuka dan ${context.activeCandidates} kandidat aktif dalam pipeline. Tahapan: Applied → Screening → Interview → Assessment → Offering → Hired/Rejected. Buka menu Rekrutmen untuk memindahkan tahap kandidat dan memantau checklist onboarding.`;
  }
  if (/(kontrak|berakhir|expired)/.test(text)) {
    return `Terdapat ${context.contractsExpiring} kontrak aktif yang berakhir dalam 45 hari ke depan. Tinjau melalui Direktori Karyawan dengan filter status Kontrak, lalu perbarui kontrak atau proses offboarding.`;
  }
  if (/(navigasi|cara|menu|bantuan|help|di mana)/.test(text)) {
    return [
      "Saya dapat membantu Anda menavigasi NexaHR:",
      "• Dasbor — metrik kehadiran, headcount, turnover, dan ringkasan payroll.",
      "• Karyawan — direktori, profil, riwayat, dan dokumen.",
      "• Kehadiran — clock-in/out, rekap, dan koreksi.",
      "• Cuti & Izin — pengajuan, saldo, kalender, persetujuan berjenjang.",
      "• Payroll — proses, persetujuan, slip gaji, ekspor CSV.",
      "• Rekrutmen, Kinerja, Laporan, dan Pengaturan (peran, kebijakan, audit).",
      "\nTips: tekan ⌘K / Ctrl+K untuk pencarian global.",
    ].join("\n");
  }
  return [
    "Saya adalah AI HR Copilot NexaHR (mode lokal tanpa API key).",
    `Konteks tenant: ${context.headcount} karyawan aktif, ${context.pendingLeave} pengajuan cuti menunggu, ${context.openVacancies} lowongan terbuka.`,
    "\nSaya dapat menjelaskan kebijakan cuti, merangkum tren kehadiran, menjelaskan proses payroll, mengidentifikasi data karyawan yang belum lengkap, atau membantu navigasi aplikasi.",
    "Untuk jawaban berbasis model bahasa, administrator perlu mengaktifkan AI dan mengonfigurasi API key pada variabel lingkungan server.",
  ].join("\n");
}

function buildSystemPrompt(context: CopilotContext, runtimeAllowConfidential: boolean): string {
  return [
    "Anda adalah AI HR Copilot untuk NexaHR, HRIS multi-tenant berbahasa Indonesia.",
    "Jawab ringkas, profesional, dan berbasis data konteks yang diberikan.",
    "Anda TIDAK boleh menyetujui cuti, memproses payroll, mengubah data, atau menjanjikan tindakan apa pun. Sarankan langkah yang harus dilakukan manusia.",
    "Jangan mengarang kebijakan. Jika data tidak tersedia, katakan demikian dan arahkan ke menu terkait.",
    "Hormati batas tenant dan izin pengguna. Jangan membocorkan data di luar konteks.",
    runtimeAllowConfidential
      ? "Administrator mengizinkan data operasional (bukan data sensitif penuh) untuk konteks ini."
      : "Jangan meminta atau menyimpulkan NIK, nomor rekening, NPWP, atau gaji individu.",
    "",
    `Konteks agregat tenant: ${JSON.stringify(context)}`,
  ].join("\n");
}

export async function askCopilot(user: SessionUser, message: string, conversationId?: string) {
  const runtime = await getAiRuntime(user.tenantId);
  const context = await buildCopilotContext(user);

  let conversation = conversationId
    ? await prisma.aiConversation.findFirst({ where: { id: conversationId, tenantId: user.tenantId, userId: user.id } })
    : null;
  if (!conversation) {
    conversation = await prisma.aiConversation.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        title: message.slice(0, 60),
      },
    });
  }

  const history = await prisma.aiMessage.findMany({
    where: { conversationId: conversation.id },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: "user", content: message },
  });

  let reply: string;
  let mode: "remote" | "local" = "local";
  if (runtime.available) {
    try {
      reply = await chatCompletion(
        [
          { role: "system", content: buildSystemPrompt(context, runtime.allowConfidential) },
          ...history.map((item) => ({ role: item.role as "user" | "assistant", content: item.content })),
          { role: "user", content: message },
        ],
        runtime,
      );
      mode = "remote";
    } catch (error) {
      console.error("[ai] provider error", error);
      reply = [
        "Penyedia AI tidak dapat dihubungi saat ini. Berikut ringkasan dari mode lokal:",
        "",
        localAnswer(message, context),
      ].join("\n");
    }
  } else {
    reply = localAnswer(message, context);
  }

  await prisma.aiMessage.create({
    data: { conversationId: conversation.id, role: "assistant", content: reply },
  });
  await prisma.aiConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  return { conversationId: conversation.id, reply, mode, runtime };
}

export async function getCopilotStatus(user: SessionUser) {
  const runtime = await getAiRuntime(user.tenantId);
  const [conversations, suggestions] = await Promise.all([
    prisma.aiConversation.findMany({
      where: { tenantId: user.tenantId, userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 6,
      include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } },
    }),
    Promise.resolve([
      "Bagaimana kebijakan cuti tahunan di perusahaan ini?",
      "Ringkas tren kehadiran 30 hari terakhir.",
      "Jelaskan alur proses payroll dan siapa yang menyetujui.",
      "Karyawan mana yang datanya belum lengkap?",
      "Beri panduan navigasi fitur NexaHR.",
    ]),
  ]);
  return {
    runtime,
    conversations: conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updatedAt,
      lastMessage: conversation.messages[0]?.content.slice(0, 120) ?? "",
    })),
    suggestions,
  };
}
