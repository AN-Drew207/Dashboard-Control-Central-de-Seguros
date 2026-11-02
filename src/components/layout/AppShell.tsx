"use client";

import {
  Bell,
  Cake,
  CalendarClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { useData } from "@/context/DataContext";
import { buildNotifications, type NotificationLevel } from "@/lib/domain/insights";
import { upcomingBirthdays } from "@/lib/domain/metrics";
import { ROLE_LABEL, type Permission } from "@/lib/domain/permissions";
import { cn, Initials } from "@/components/ui/primitives";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  permission?: Permission;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard /> },
  { href: "/clientes", label: "Clientes", icon: <Users /> },
  { href: "/polizas", label: "Pólizas", icon: <FileText /> },
  { href: "/cobranza", label: "Cobranza", icon: <Wallet /> },
  { href: "/renovaciones", label: "Renovaciones", icon: <CalendarClock /> },
  { href: "/reportes", label: "Reportes", icon: <BarChart3 />, permission: "viewReports" },
  { href: "/asistente", label: "Asistente IA", icon: <Sparkles />, permission: "useAssistant" },
];

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { can, logout } = useAuth();
  const router = useRouter();

  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClose}
        className={cn(
          "relative flex items-center gap-3 rounded px-4 py-2.5 text-body-md transition-colors [&>svg]:size-5",
          active
            ? "bg-primary-container/15 text-primary font-semibold before:absolute before:left-0 before:top-1 before:bottom-1 before:w-1 before:rounded-r before:bg-primary-container"
            : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
        )}
      >
        {item.icon}
        {item.label}
      </Link>
    );
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={onClose} />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-outline-variant bg-surface-container px-2 py-4 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-3">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-md border border-primary/30 bg-primary-container/20 text-primary">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h1 className="text-headline-sm font-bold text-primary">InsureFlow</h1>
              <p className="text-[11px] text-on-surface-variant">Corredor de Seguros</p>
            </div>
          </div>
          <button className="lg:hidden text-on-surface-variant" onClick={onClose} aria-label="Cerrar menú">
            <X className="size-5" />
          </button>
        </div>

        {can("managePolicies") && (
          <Link
            href="/polizas/nueva"
            onClick={onClose}
            className="mx-2 mb-6 flex items-center justify-center gap-2 rounded bg-primary py-2 text-sm font-semibold text-on-primary hover:shadow-[0_0_12px_rgba(163,201,255,0.35)]"
          >
            <Plus className="size-4" /> Nueva Póliza
          </Link>
        )}

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
          {NAV.filter((i) => !i.permission || can(i.permission)).map(link)}
        </nav>

        <div className="mt-4 flex flex-col gap-1 border-t border-outline-variant pt-4">
          {can("manageSettings") && link({ href: "/configuracion", label: "Configuración", icon: <Settings /> })}
          <button
            onClick={() => {
              logout();
              router.replace("/login");
            }}
            className="flex items-center gap-3 rounded px-4 py-2.5 text-body-md text-error hover:bg-error/10 cursor-pointer"
          >
            <LogOut className="size-5" /> Cerrar sesión
          </button>
        </div>
      </aside>
    </>
  );
}

const LEVEL_DOT: Record<NotificationLevel, string> = {
  critical: "bg-error",
  warning: "bg-tertiary",
  success: "bg-secondary",
  info: "bg-primary",
};

function useClickOutside(ref: React.RefObject<HTMLElement | null>, onOutside: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ref, onOutside]);
}

function GlobalSearch() {
  const { db, indexes } = useData();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!db || term.length < 2) return [];
    const clients = db.clients
      .filter((c) => c.name.toLowerCase().includes(term) || c.documentId.toLowerCase().includes(term))
      .slice(0, 5)
      .map((c) => ({ href: `/clientes/${c.id}`, title: c.name, sub: c.documentId }));
    const policies = db.policies
      .filter((p) => p.number.toLowerCase().includes(term))
      .slice(0, 5)
      .map((p) => ({
        href: `/clientes/${p.clientId}?tab=polizas`,
        title: p.number,
        sub: `${indexes?.clientById.get(p.clientId)?.name ?? ""} · ${p.product}`,
      }));
    return [...clients, ...policies];
  }, [q, db, indexes]);

  return (
    <div ref={ref} className="relative w-full max-w-md">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-outline" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Buscar cliente, cédula o póliza..."
        className="input-base pl-9"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded border border-outline-variant bg-surface-container-high shadow-xl">
          {results.map((r) => (
            <Link
              key={r.href + r.title}
              href={r.href}
              onClick={() => {
                setOpen(false);
                setQ("");
              }}
              className="block px-4 py-2 hover:bg-surface-container-highest"
            >
              <p className="text-body-md text-on-surface">{r.title}</p>
              <p className="num text-[11px] text-on-surface-variant">{r.sub}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function Notifications() {
  const { db, today } = useData();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, () => setOpen(false));
  const items = useMemo(() => (db ? buildNotifications(db, today) : []), [db, today]);
  const urgent = items.filter((i) => i.level === "critical" || i.level === "success").length;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
        aria-label="Notificaciones"
      >
        <Bell className="size-5" />
        {items.length > 0 && (
          <span className={cn("absolute right-1 top-1 size-2 rounded-full", urgent ? "bg-error" : "bg-tertiary")} />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded border border-outline-variant bg-surface-container-high shadow-xl">
          <div className="flex items-center justify-between border-b border-outline-variant px-4 py-3">
            <p className="font-semibold">Notificaciones</p>
            <span className="num text-xs text-on-surface-variant">{items.length}</span>
          </div>
          <div className="max-h-[60vh] overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-body-sm text-on-surface-variant">Todo al día.</p>}
            {items.slice(0, 30).map((n) => (
              <Link
                key={n.id}
                href={n.href}
                onClick={() => setOpen(false)}
                className="flex gap-3 border-b border-outline-variant/50 px-4 py-3 hover:bg-surface-container-highest"
              >
                <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", LEVEL_DOT[n.level])} />
                <div>
                  <p className="text-body-md text-on-surface">{n.title}</p>
                  <p className="text-body-sm text-on-surface-variant">{n.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const { db, today } = useData();
  const todayBirthdays = useMemo(
    () => (db ? upcomingBirthdays(db, today, 0).length : 0),
    [db, today],
  );

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-outline-variant bg-background/90 px-4 backdrop-blur lg:px-6">
      <button className="lg:hidden rounded p-2 text-on-surface-variant hover:bg-surface-container-high" onClick={onMenu} aria-label="Abrir menú">
        <Menu className="size-5" />
      </button>
      <GlobalSearch />
      <div className="ml-auto flex items-center gap-1">
        <Notifications />
        <Link
          href="/dashboard#eventos"
          className="relative rounded p-2 text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
          aria-label="Cumpleaños de hoy"
          title={`${todayBirthdays} cumpleaños hoy`}
        >
          <Cake className="size-5" />
          {todayBirthdays > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-secondary num text-[10px] text-on-secondary">
              {todayBirthdays}
            </span>
          )}
        </Link>
        <div className="mx-2 hidden h-8 w-px bg-outline-variant sm:block" />
        {user && (
          <div className="hidden items-center gap-3 sm:flex">
            <div className="text-right">
              <p className="text-body-sm font-semibold text-on-surface">{user.name}</p>
              <p className="text-[11px] text-on-surface-variant">{ROLE_LABEL[user.role]}</p>
            </div>
            <Initials name={user.name} className="size-9 text-xs" />
          </div>
        )}
      </div>
    </header>
  );
}

export function FullScreenLoader({ label = "Cargando..." }: { label?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 text-on-surface-variant">
      <span className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      {label}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  const { db } = useData();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) return <FullScreenLoader />;
  if (!db) return <FullScreenLoader label="Sincronizando cartera..." />;

  return (
    <div className="min-h-screen">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="lg:pl-60">
        <Topbar onMenu={() => setMenuOpen(true)} />
        <main className="mx-auto max-w-[1440px] px-4 py-6 lg:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

/** Blocks a page when the current role lacks the permission. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(permission)) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <ShieldCheck className="size-10 text-outline" />
        <p className="text-headline-sm">Acceso restringido</p>
        <p className="max-w-sm text-body-md text-on-surface-variant">
          Esta sección contiene información financiera reservada para el corredor.
        </p>
        <Link href="/dashboard" className="text-primary hover:underline">
          Volver al dashboard
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
