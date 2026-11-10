"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { NOTIFICATION_TYPE } from "@/lib/design";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { relativeLabel } from "@/lib/client-format";

type NotificationItem = {
  id: string;
  title: string;
  body: string | null;
  href: string | null;
  type: string;
  readAt: string | null;
  createdAt: string;
};

export function NotificationCenter({ initialUnread }: { initialUnread: number }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<NotificationItem[]>([]);
  const [unread, setUnread] = React.useState(initialUnread);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/notifications", { cache: "no-store" });
      if (res.ok) {
        const payload = (await res.json()) as { data: { items: NotificationItem[]; unread: number } };
        setItems(payload.data.items);
        setUnread(payload.data.unread);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function markAllRead() {
    const res = await fetch("/api/v1/notifications/read-all", { method: "POST" });
    if (res.ok) {
      setItems((prev) => prev.map((item) => ({ ...item, readAt: new Date().toISOString() })));
      setUnread(0);
      router.refresh();
    } else {
      toast.error("Gagal menandai notifikasi.");
    }
  }

  async function openNotification(item: NotificationItem) {
    if (!item.readAt) {
      await fetch(`/api/v1/notifications/${item.id}/read`, { method: "POST" });
      setItems((prev) => prev.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)));
      setUnread((value) => Math.max(0, value - 1));
      router.refresh();
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifikasi">
          <Bell className="size-4" />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-primary-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          ) : null}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[min(92vw,23rem)] overflow-hidden rounded-xl border border-border bg-popover shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Notifikasi</p>
              <p className="text-[11px] text-muted-foreground">{unread} belum dibaca</p>
            </div>
            <Button variant="ghost" size="xs" onClick={markAllRead} disabled={unread === 0}>
              <CheckCheck className="size-3.5" /> Tandai semua
            </Button>
          </div>
          <div className="max-h-[22rem] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="shimmer h-14 rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <Inbox className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">Belum ada notifikasi</p>
                <p className="text-xs text-muted-foreground">Aktivitas persetujuan dan pengingat akan muncul di sini.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {items.map((item) => {
                  const meta = NOTIFICATION_TYPE[item.type] ?? NOTIFICATION_TYPE.INFO;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(item)}
                        className={cn(
                          "flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-muted/60",
                          !item.readAt && "bg-primary/[0.03]",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              item.readAt ? "bg-transparent" : "bg-primary",
                            )}
                          />
                          <span className="flex-1 truncate text-[13px] font-medium">{item.title}</span>
                          <Badge variant={meta.tone === "neutral" ? "outline" : meta.tone}>{meta.label}</Badge>
                        </div>
                        {item.body ? <p className="pl-3.5 text-xs text-muted-foreground">{item.body}</p> : null}
                        <p className="pl-3.5 text-[11px] text-muted-foreground/80">{relativeLabel(item.createdAt)}</p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="border-t border-border p-2">
            <Button asChild variant="ghost" size="sm" className="w-full justify-center">
              <Link href="/notifications" onClick={() => setOpen(false)}>
                Lihat semua notifikasi
              </Link>
            </Button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
