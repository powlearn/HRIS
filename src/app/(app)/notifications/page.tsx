import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Inbox } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";
import { MarkAllRead } from "@/components/notifications/mark-all-read";
import { requirePage } from "@/lib/page-guard";
import { prisma } from "@/lib/prisma";
import { NOTIFICATION_TYPE } from "@/lib/design";
import { formatDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Notifikasi" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePage();
  const notifications = await prisma.notification.findMany({
    where: { tenantId: user.tenantId, userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });
  const unread = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Akun"
        title="Pusat notifikasi"
        description="Persetujuan, pengingat, dan pembaruan sistem untuk akun Anda."
        actions={<MarkAllRead disabled={unread === 0} />}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="size-4 text-muted-foreground" /> Semua notifikasi</CardTitle>
          <CardDescription>{unread} belum dibaca dari {notifications.length} notifikasi</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {notifications.length === 0 ? (
            <EmptyState icon={Inbox} title="Belum ada notifikasi" description="Aktivitas persetujuan dan pengingat akan muncul di sini." />
          ) : (
            <ul className="divide-y divide-border/60">
              {notifications.map((notification) => {
                const meta = NOTIFICATION_TYPE[notification.type] ?? NOTIFICATION_TYPE.INFO;
                return (
                  <li key={notification.id} className={notification.readAt ? "" : "bg-primary/[0.03]"}>
                    <Link href={notification.href ?? "/dashboard"} className="flex items-start gap-3 px-5 py-3 transition hover:bg-muted/40">
                      <span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-primary"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[13px] font-medium">{notification.title}</p>
                          <Badge variant={meta.tone === "neutral" ? "outline" : meta.tone}>{meta.label}</Badge>
                        </div>
                        {notification.body ? <p className="text-[11px] text-muted-foreground">{notification.body}</p> : null}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">{formatDateTime(notification.createdAt)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
