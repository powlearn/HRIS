import type { Metadata } from "next";
import { Briefcase, CalendarClock, CheckSquare, Inbox, MapPin, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { VacancyDialog } from "@/components/recruitment/vacancy-dialog";
import { StageSelect } from "@/components/recruitment/stage-select";
import { OnboardingToggle } from "@/components/recruitment/onboarding-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/empty-state";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { APPLICATION_STAGE, RECRUITMENT_STAGES, VACANCY_STATUS } from "@/lib/design";
import { formatDate, formatDateTime } from "@/lib/time";
import { formatIDR } from "@/lib/money";

export const metadata: Metadata = { title: "Rekrutmen" };
export const dynamic = "force-dynamic";

export default async function RecruitmentPage() {
  const user = await requirePage("recruitment.read");
  const canManage = hasPermission(user.permissions, "recruitment.manage");

  const [vacancies, applications, interviews, offers, onboarding, departments, locations] = await Promise.all([
    prisma.jobVacancy.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: { department: { select: { name: true } }, _count: { select: { applications: true } } },
    }),
    prisma.recruitmentApplication.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { appliedAt: "desc" },
      include: { vacancy: { select: { title: true, code: true } } },
    }),
    prisma.interview.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { scheduledAt: "asc" },
      take: 8,
      include: { application: { select: { candidateName: true, vacancy: { select: { title: true } } } } },
    }),
    prisma.offer.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: { application: { select: { candidateName: true } } },
    }),
    prisma.onboardingTask.findMany({
      where: { tenantId: user.tenantId },
      orderBy: [{ sortOrder: "asc" }],
      take: 10,
    }),
    prisma.department.findMany({ where: { tenantId: user.tenantId }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.workLocation.findMany({ where: { tenantId: user.tenantId }, select: { name: true } }),
  ]);

  const openPositions = vacancies.filter((vacancy) => vacancy.status === "OPEN").reduce((acc, vacancy) => acc + vacancy.openings, 0);
  const activeCandidates = applications.filter((application) => !["HIRED", "REJECTED"].includes(application.stage)).length;
  const grouped = RECRUITMENT_STAGES.map((stage) => ({
    stage,
    items: applications.filter((application) => application.stage === stage),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pertumbuhan"
        title="Rekrutmen & onboarding"
        description="Kelola lowongan, pipeline kandidat, wawancara, penawaran, dan checklist onboarding dalam satu alur."
        actions={canManage ? <VacancyDialog departments={departments} locationOptions={locations.map((location) => location.name)} /> : null}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Lowongan terbuka" value={vacancies.filter((vacancy) => vacancy.status === "OPEN").length} icon={Briefcase} tone="primary" hint={`${openPositions} posisi dibutuhkan`} />
        <KpiCard label="Kandidat aktif" value={activeCandidates} icon={Users} tone="success" hint={`${applications.length} pelamar total`} />
        <KpiCard label="Wawancara terjadwal" value={interviews.filter((interview) => !interview.completedAt).length} icon={CalendarClock} tone="warning" hint="Termasuk minggu ini" />
        <KpiCard label="Penawaran terkirim" value={offers.filter((offer) => offer.status === "SENT").length} icon={Inbox} hint={`${offers.filter((offer) => offer.status === "ACCEPTED").length} diterima`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline rekrutmen</CardTitle>
          <CardDescription>Geser tahap kandidat sesuai hasil seleksi</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {grouped.map((column) => (
              <div key={column.stage} className="rounded-lg border border-border/70 bg-muted/25 p-2">
                <div className="mb-2 flex items-center justify-between px-1">
                  <p className="text-[11px] font-semibold">{APPLICATION_STAGE[column.stage]?.label ?? column.stage}</p>
                  <span className="rounded bg-card px-1.5 text-[10px] text-muted-foreground">{column.items.length}</span>
                </div>
                <div className="space-y-1.5">
                  {column.items.length === 0 ? (
                    <p className="px-1 py-3 text-center text-[10px] text-muted-foreground">Kosong</p>
                  ) : (
                    column.items.map((application) => (
                      <div key={application.id} className="rounded-md border border-border bg-card p-2">
                        <p className="text-[11px] font-medium leading-tight">{application.candidateName}</p>
                        <p className="mt-0.5 truncate text-[9px] text-muted-foreground">{application.vacancy.title}</p>
                        <div className="mt-1.5 flex items-center justify-between gap-1">
                          <span className="text-[9px] text-muted-foreground">{application.rating ? `★ ${application.rating}` : "—"}</span>
                          {canManage ? <StageSelect applicationId={application.id} stage={application.stage} /> : (
                            <span className="text-[9px] text-muted-foreground">{APPLICATION_STAGE[application.stage]?.label}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>Lowongan</CardTitle><CardDescription>Requisition dan status publikasi</CardDescription></CardHeader>
          <CardContent className="p-0">
            {vacancies.length === 0 ? (
              <EmptyState icon={Briefcase} title="Belum ada lowongan" description="Buat lowongan pertama untuk memulai pipeline rekrutmen." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Posisi</TableHead>
                    <TableHead>Departemen</TableHead>
                    <TableHead>Kebutuhan</TableHead>
                    <TableHead>Pelamar</TableHead>
                    <TableHead>Rentang gaji</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vacancies.map((vacancy) => (
                    <TableRow key={vacancy.id}>
                      <TableCell>
                        <p className="text-[12px] font-medium">{vacancy.title}</p>
                        <p className="text-[10px] text-muted-foreground">{vacancy.code} · {vacancy.workMode}</p>
                      </TableCell>
                      <TableCell className="text-[12px]">{vacancy.department?.name ?? "—"}</TableCell>
                      <TableCell className="numeric text-[12px]">{vacancy.openings}</TableCell>
                      <TableCell className="numeric text-[12px]">{vacancy._count.applications}</TableCell>
                      <TableCell className="numeric text-[11px] text-muted-foreground">
                        {vacancy.salaryMin ? `${formatIDR(vacancy.salaryMin)} – ${vacancy.salaryMax ? formatIDR(vacancy.salaryMax) : ""}` : "—"}
                      </TableCell>
                      <TableCell><Badge variant={VACANCY_STATUS[vacancy.status]?.tone ?? "neutral"}>{VACANCY_STATUS[vacancy.status]?.label ?? vacancy.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Wawancara</CardTitle><CardDescription>Jadwal terdekat</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {interviews.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Belum ada wawancara terjadwal.</p>
              ) : (
                interviews.map((interview) => (
                  <div key={interview.id} className="rounded-lg border border-border/70 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-medium">{interview.application.candidateName}</p>
                      <Badge variant={interview.completedAt ? "success" : "warning"}>{interview.completedAt ? "Selesai" : "Terjadwal"}</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{interview.application.vacancy.title}</p>
                    <p className="numeric mt-1 text-[10px] text-muted-foreground">{formatDateTime(interview.scheduledAt)} · {interview.mode}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Penawaran</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {offers.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Belum ada penawaran.</p>
              ) : (
                offers.map((offer) => (
                  <div key={offer.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <div>
                      <p className="font-medium">{offer.application.candidateName}</p>
                      <p className="text-[10px] text-muted-foreground">{offer.positionTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="numeric text-[11px]">{formatIDR(offer.salary)}</p>
                      <Badge variant={offer.status === "ACCEPTED" ? "success" : offer.status === "DECLINED" ? "danger" : "outline"} className="scale-90">
                        {offer.status}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare className="size-4 text-muted-foreground" /> Checklist onboarding</CardTitle>
          <CardDescription>Persiapan karyawan baru</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {onboarding.map((task) => (
            <div key={task.id} className="flex items-start gap-2 rounded-lg border border-border/70 p-2.5">
              <OnboardingToggle taskId={task.id} isCompleted={task.isCompleted} />
              <div className="min-w-0 flex-1">
                <p className={`text-[12px] ${task.isCompleted ? "text-muted-foreground line-through" : "font-medium"}`}>{task.title}</p>
                <p className="text-[10px] text-muted-foreground">
                  {task.category} · {task.assignee ?? "—"} · jatuh tempo {formatDate(task.dueDate)}
                </p>
              </div>
            </div>
          ))}
          {onboarding.length === 0 ? (
            <p className="text-[12px] text-muted-foreground">Belum ada checklist onboarding.</p>
          ) : null}
        </CardContent>
      </Card>

      <p className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
        <MapPin className="mt-px size-3 shrink-0" />
        Ekstraksi dokumen (OCR) direncanakan melalui antarmuka penyedia opsional; data identitas tidak pernah dikarang otomatis.
      </p>
    </div>
  );
}
