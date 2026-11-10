import type { Metadata } from "next";
import Link from "next/link";
import { Award, CalendarRange, Star, Target, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { KpiCard } from "@/components/kpi-card";
import { ReviewDialog } from "@/components/performance/review-dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PersonAvatar } from "@/components/ui/primitives";
import { EmptyState } from "@/components/empty-state";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { REVIEW_STATUS } from "@/lib/design";
import { formatDate } from "@/lib/time";
import { decimalFromDb } from "@/lib/money";

export const metadata: Metadata = { title: "Kinerja" };
export const dynamic = "force-dynamic";

const RATING_LABEL: Record<string, string> = {
  BELOW_EXPECTATIONS: "Di bawah ekspektasi",
  MEETS_EXPECTATIONS: "Sesuai ekspektasi",
  EXCEEDS_EXPECTATIONS: "Melebihi ekspektasi",
  OUTSTANDING: "Istimewa",
};

export default async function PerformancePage() {
  const user = await requirePage("performance.read");
  const canManage = hasPermission(user.permissions, "performance.manage");

  const cycles = await prisma.reviewCycle.findMany({
    where: { tenantId: user.tenantId },
    orderBy: { periodStart: "desc" },
    include: { _count: { select: { reviews: true } } },
  });
  const activeCycle = cycles.find((cycle) => cycle.status === "ACTIVE") ?? cycles[0] ?? null;

  const [reviews, myReview, goals, myGoals] = await Promise.all([
    activeCycle
      ? prisma.performanceReview.findMany({
          where: {
            tenantId: user.tenantId,
            cycleId: activeCycle.id,
            ...(canManage ? {} : user.employeeId ? { OR: [{ employeeId: user.employeeId }, { reviewerId: user.employeeId }] } : { employeeId: "__none__" }),
          },
          include: {
            employee: { select: { id: true, firstName: true, lastName: true, employeeCode: true, department: { select: { name: true } } } },
            reviewer: { select: { firstName: true, lastName: true } },
          },
          orderBy: { employee: { firstName: "asc" } },
        })
      : Promise.resolve([]),
    user.employeeId && activeCycle
      ? prisma.performanceReview.findFirst({ where: { tenantId: user.tenantId, cycleId: activeCycle.id, employeeId: user.employeeId } })
      : Promise.resolve(null),
    activeCycle
      ? prisma.performanceGoal.findMany({
          where: { tenantId: user.tenantId, cycleId: activeCycle.id },
          include: { employee: { select: { firstName: true, lastName: true } } },
          orderBy: { weight: "desc" },
          take: 12,
        })
      : Promise.resolve([]),
    user.employeeId && activeCycle
      ? prisma.performanceGoal.findMany({ where: { tenantId: user.tenantId, cycleId: activeCycle.id, employeeId: user.employeeId } })
      : Promise.resolve([]),
  ]);

  const completed = reviews.filter((review) => review.status === "COMPLETED");
  const averageScore =
    completed.length > 0
      ? (completed.reduce((acc, review) => acc + (review.finalScore ? decimalFromDb(review.finalScore).toNumber() : 0), 0) / completed.length).toFixed(2)
      : "—";

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Tenaga Kerja"
        title="Manajemen kinerja"
        description="Siklus penilaian, penilaian diri, evaluasi manajer, dan tujuan individu yang terukur."
        actions={
          myReview ? (
            <ReviewDialog
              reviewId={myReview.id}
              kind="self"
              employeeName={user.name}
              initial={{
                selfAssessment: myReview.selfAssessment,
                selfScore: myReview.selfScore ? decimalFromDb(myReview.selfScore).toNumber() : null,
              }}
              trigger={
                <Button size="sm" variant="outline">
                  <Star className="size-3.5" /> Isi penilaian diri
                </Button>
              }
            />
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Siklus aktif" value={activeCycle ? activeCycle.name.replace(/Siklus Kinerja /, "") : "—"} icon={CalendarRange} tone="primary" hint={activeCycle ? `${formatDate(activeCycle.periodStart)} – ${formatDate(activeCycle.periodEnd)}` : "Belum ada siklus"} />
        <KpiCard label="Penilaian" value={reviews.length} icon={Users} hint={`${completed.length} selesai`} />
        <KpiCard label="Rata-rata skor" value={averageScore} icon={TrendingUp} tone="success" hint="Skor akhir karyawan selesai" />
        <KpiCard label="Tujuan tercatat" value={goals.length} icon={Target} tone="warning" hint="KPI pada siklus aktif" />
      </div>

      <div className="flex flex-wrap gap-2">
        {cycles.map((cycle) => (
          <div key={cycle.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-[11px]">
            <span className="font-medium">{cycle.name}</span>
            <Badge variant={cycle.status === "ACTIVE" ? "success" : cycle.status === "CLOSED" ? "neutral" : "outline"} className="scale-90">{cycle.status}</Badge>
            <span className="text-muted-foreground">{cycle._count.reviews} penilaian</span>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Penilaian kinerja</CardTitle>
            <CardDescription>{canManage ? "Seluruh karyawan pada siklus aktif" : "Penilaian Anda dan anggota tim"}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {reviews.length === 0 ? (
              <EmptyState icon={Award} title="Belum ada penilaian" description="Penilaian akan muncul setelah siklus kinerja diaktifkan." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Karyawan</TableHead>
                    <TableHead>Reviewer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Skor</TableHead>
                    <TableHead>Rating</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reviews.map((review) => {
                    const name = `${review.employee.firstName} ${review.employee.lastName ?? ""}`.trim();
                    const meta = REVIEW_STATUS[review.status];
                    return (
                      <TableRow key={review.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <PersonAvatar name={name} className="size-7" />
                            <div>
                              <p className="text-[12px] font-medium">{name}</p>
                              <p className="text-[10px] text-muted-foreground">{review.employee.department?.name ?? "—"}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">
                          {review.reviewer ? `${review.reviewer.firstName} ${review.reviewer.lastName ?? ""}` : "—"}
                        </TableCell>
                        <TableCell><Badge variant={meta?.tone ?? "neutral"}>{meta?.label ?? review.status}</Badge></TableCell>
                        <TableCell className="numeric text-[12px]">
                          {review.finalScore ? decimalFromDb(review.finalScore).toFixed(2) : review.selfScore ? `diri ${decimalFromDb(review.selfScore).toFixed(1)}` : "—"}
                        </TableCell>
                        <TableCell className="text-[11px] text-muted-foreground">{review.rating ? RATING_LABEL[review.rating] ?? review.rating : "—"}</TableCell>
                        <TableCell className="text-right">
                          {canManage ? (
                            <ReviewDialog
                              reviewId={review.id}
                              kind="manager"
                              employeeName={name}
                              initial={{
                                managerAssessment: review.managerAssessment,
                                managerScore: review.managerScore ? decimalFromDb(review.managerScore).toNumber() : null,
                                strengths: review.strengths,
                                improvements: review.improvements,
                                rating: review.rating,
                              }}
                              trigger={<Button size="xs" variant="outline">Nilai</Button>}
                            />
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Tujuan saya</CardTitle><CardDescription>Siklus aktif</CardDescription></CardHeader>
            <CardContent className="space-y-3">
              {myGoals.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Belum ada tujuan yang ditetapkan.</p>
              ) : (
                myGoals.map((goal) => {
                  const target = goal.targetValue ? decimalFromDb(goal.targetValue).toNumber() : 0;
                  const current = goal.currentValue ? decimalFromDb(goal.currentValue).toNumber() : 0;
                  const percent = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
                  return (
                    <div key={goal.id} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="font-medium">{goal.title}</span>
                        <span className="numeric text-muted-foreground">{percent}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground">Target {target} {goal.unit ?? ""} · bobot {goal.weight}%</p>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>KPI tim</CardTitle><CardDescription>Progres tujuan pada siklus</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {goals.length === 0 ? (
                <p className="text-[12px] text-muted-foreground">Belum ada data tujuan.</p>
              ) : (
                goals.map((goal) => (
                  <div key={goal.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="truncate">{goal.employee.firstName} {goal.employee.lastName ?? ""} · {goal.title}</span>
                    <Badge variant={goal.status === "ACHIEVED" ? "success" : goal.status === "IN_PROGRESS" ? "info" : "outline"} className="scale-90">
                      {goal.status.replace(/_/g, " ").toLowerCase()}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Catatan</CardTitle></CardHeader>
            <CardContent className="text-[11px] leading-relaxed text-muted-foreground">
              Penilaian bersifat rahasia. Karyawan dapat melihat penilaian diri sendiri; evaluasi manajer hanya terlihat
              oleh manajer terkait dan HR. Keputusan promosi tetap berada di tangan manusia.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
