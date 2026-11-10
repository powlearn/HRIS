"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ChevronsLeft,
  ChevronsRight,
  ChevronRight,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PanelLeft,
  Search,
  Settings,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { NAV_GROUPS, findNavItem } from "@/components/shell/nav";
import { CommandPalette } from "@/components/command-palette";
import { NotificationCenter } from "@/components/shell/notification-center";
import { Button } from "@/components/ui/button";
import { PersonAvatar, Tooltip, TooltipProvider } from "@/components/ui/primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { hasPermission } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { ROLE_LABEL } from "@/lib/design";

type ShellUser = {
  id: string;
  name: string;
  email: string;
  roleSlug: string;
  roleName: string;
  tenantName: string;
  permissions: string[];
  avatarUrl?: string | null;
};

function BrandMark({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden>
          <path d="M6 18V6.8L18 17.2V6" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {!compact ? (
        <div className="leading-none">
          <p className="text-[15px] font-semibold tracking-[-0.02em]">
            Nexa<span className="text-primary">HR</span>
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">HR Platform</p>
        </div>
      ) : null}
    </div>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  onToggle,
  user,
  pendingApprovals,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggle?: () => void;
  user: ShellUser;
  pendingApprovals: number;
}) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 items-center border-b border-sidebar-border px-4", collapsed && "justify-center px-0")}>
        <Link href="/dashboard" aria-label="NexaHR" onClick={onNavigate}>
          <BrandMark compact={collapsed} />
        </Link>
      </div>

      <div className="px-3 pt-4">
        {!collapsed ? (
          <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-card/60 px-2.5 py-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
              {user.tenantName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold">{user.tenantName}</p>
              <p className="truncate text-[10px] text-muted-foreground">{ROLE_LABEL[user.roleSlug] ?? user.roleName}</p>
            </div>
            <span className="rounded border border-border px-1 py-0.5 text-[9px] font-medium text-muted-foreground">PRO</span>
          </div>
        ) : (
          <Tooltip content={user.tenantName} side="right">
            <div className="mx-auto flex size-8 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
              {user.tenantName.slice(0, 2).toUpperCase()}
            </div>
          </Tooltip>
        )}
      </div>

      <nav className="sidebar-scroll mt-3 flex-1 overflow-y-auto px-2 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => hasPermission(user.permissions, item.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              {!collapsed ? (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/80">
                  {group.label}
                </p>
              ) : (
                <div className="mx-auto mb-2 h-px w-6 bg-sidebar-border" />
              )}
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const showBadge = item.badgeKey === "pendingApprovals" && pendingApprovals > 0;
                  const link = (
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg py-1.5 text-[13px] font-medium transition-colors",
                        collapsed ? "justify-center px-2" : "px-2.5",
                        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {active ? (
                        <motion.span
                          layoutId="sidebar-active"
                          transition={{ type: "spring", stiffness: 420, damping: 34 }}
                          className="absolute inset-0 rounded-lg border border-sidebar-border bg-sidebar-accent"
                        />
                      ) : null}
                      <item.icon
                        className={cn("relative z-10 size-4 shrink-0 transition-colors", active && "text-primary")}
                        strokeWidth={active ? 2.2 : 1.9}
                      />
                      {!collapsed ? (
                        <>
                          <span className="relative z-10 flex-1 truncate">{item.label}</span>
                          {showBadge ? (
                            <span className="relative z-10 flex min-w-4 items-center justify-center rounded bg-primary/12 px-1 text-[10px] font-semibold text-primary">
                              {pendingApprovals}
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </Link>
                  );
                  return (
                    <li key={item.href}>
                      {collapsed ? (
                        <Tooltip content={item.label} side="right">
                          {link}
                        </Tooltip>
                      ) : (
                        link
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className={cn("border-t border-sidebar-border p-2", collapsed && "flex flex-col items-center gap-1")}>
        <Link
          href="/profile"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-lg p-1.5 transition hover:bg-sidebar-accent",
            collapsed ? "justify-center" : "w-full",
          )}
        >
          <PersonAvatar name={user.name} src={user.avatarUrl} className="size-7" />
          {!collapsed ? (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium">{user.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">{user.email}</p>
            </div>
          ) : null}
        </Link>
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            className={cn(
              "mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] text-muted-foreground transition hover:bg-sidebar-accent hover:text-foreground",
              collapsed ? "justify-center" : "w-full",
            )}
            aria-label={collapsed ? "Perluas sidebar" : "Ciutkan sidebar"}
          >
            {collapsed ? <ChevronsRight className="size-3.5" /> : <ChevronsLeft className="size-3.5" />}
            {!collapsed ? "Ciutkan sidebar" : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted ? resolvedTheme === "dark" : false;
  return (
    <Tooltip content={isDark ? "Mode terang" : "Mode gelap"}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Ubah tema"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="text-muted-foreground"
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </Button>
    </Tooltip>
  );
}

function Breadcrumbs({ pathname }: { pathname: string }) {
  const item = findNavItem(pathname);
  const segments = pathname.split("/").filter(Boolean);
  const extra = segments.slice(1);
  return (
    <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 text-[13px] md:flex">
      <Link href="/dashboard" className="text-muted-foreground transition hover:text-foreground">
        NexaHR
      </Link>
      {item ? (
        <>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <Link
            href={item.href}
            className={cn("transition hover:text-foreground", extra.length === 0 ? "font-medium text-foreground" : "text-muted-foreground")}
          >
            {item.label}
          </Link>
        </>
      ) : null}
      {extra.map((segment, index) => (
        <React.Fragment key={segment + index}>
          <ChevronRight className="size-3.5 text-muted-foreground/60" />
          <span className="max-w-[12rem] truncate font-medium text-foreground">
            {/^[a-z0-9]{20,}$/i.test(segment) ? "Detail" : segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, " ")}
          </span>
        </React.Fragment>
      ))}
    </nav>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full p-0.5 transition hover:ring-2 hover:ring-border"
          aria-label="Menu pengguna"
        >
          <PersonAvatar name={user.name} src={user.avatarUrl} className="size-7" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <span className="block text-[13px] font-semibold text-foreground">{user.name}</span>
          <span className="block truncate text-[11px] font-normal text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/profile")}>Profil saya</DropdownMenuItem>
        {hasPermission(user.permissions, "settings.read") ? (
          <DropdownMenuItem onSelect={() => router.push("/settings")}>
            <Settings className="size-4" /> Pengaturan
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          destructive
          onSelect={async () => {
            toast.loading("Keluar dari sesi…", { id: "logout" });
            await signOut({ redirect: false });
            window.location.href = "/login";
          }}
        >
          <LogOut className="size-4" /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  user,
  unreadCount,
  pendingApprovals,
  children,
}: {
  user: ShellUser;
  unreadCount: number;
  pendingApprovals: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  React.useEffect(() => {
    setCollapsed(window.localStorage.getItem("nexahr.sidebar") === "collapsed");
  }, []);

  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleCollapsed() {
    setCollapsed((value) => {
      window.localStorage.setItem("nexahr.sidebar", value ? "expanded" : "collapsed");
      return !value;
    });
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 hidden border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:block",
            collapsed ? "w-[68px]" : "w-[256px]",
          )}
        >
          <SidebarContent
            collapsed={collapsed}
            onToggle={toggleCollapsed}
            user={user}
            pendingApprovals={pendingApprovals}
          />
        </aside>

        <AnimatePresence>
          {mobileOpen ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
                onClick={() => setMobileOpen(false)}
              />
              <motion.aside
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", stiffness: 400, damping: 36 }}
                className="relative h-full w-[272px] border-r border-sidebar-border bg-sidebar"
              >
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="absolute right-3 top-4 z-10 rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Tutup menu"
                >
                  <X className="size-4" />
                </button>
                <SidebarContent
                  collapsed={false}
                  onNavigate={() => setMobileOpen(false)}
                  user={user}
                  pendingApprovals={pendingApprovals}
                />
              </motion.aside>
            </div>
          ) : null}
        </AnimatePresence>

        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-[256px]")}>
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <Menu className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden text-muted-foreground lg:inline-flex"
              onClick={toggleCollapsed}
              aria-label="Ciutkan sidebar"
            >
              <PanelLeft className="size-4" />
            </Button>
            <Breadcrumbs pathname={pathname} />

            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="mr-1 hidden h-8 w-56 items-center gap-2 rounded-lg border border-border bg-card px-2.5 text-left text-[12px] text-muted-foreground transition hover:border-ring/40 hover:bg-muted/50 sm:flex"
              >
                <Search className="size-3.5" />
                <span className="flex-1">Cari apa saja…</span>
                <span className="kbd">⌘K</span>
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground sm:hidden"
                onClick={() => setPaletteOpen(true)}
                aria-label="Pencarian"
              >
                <Search className="size-4" />
              </Button>
              <ThemeToggle />
              <NotificationCenter initialUnread={unreadCount} />
              <div className="mx-1 h-5 w-px bg-border" />
              <UserMenu user={user} />
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-6">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </main>
          <footer className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-2 px-4 pb-6 text-[11px] text-muted-foreground sm:px-6">
            <span>© {new Date().getFullYear()} NexaHR · Data demonstrasi fiktif</span>
            <span className="flex items-center gap-1.5">
              <Monitor className="size-3" /> Zona waktu tenant: {user.tenantName ? "Asia/Jakarta" : "—"}
            </span>
          </footer>
        </div>

        <CommandPalette permissions={user.permissions} open={paletteOpen} onOpenChange={setPaletteOpen} />
      </div>
    </TooltipProvider>
  );
}
