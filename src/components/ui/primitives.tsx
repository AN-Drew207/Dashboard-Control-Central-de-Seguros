"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, type ButtonHTMLAttributes, type ReactNode } from "react";
import { COLLECTION_STATE_LABEL, type CollectionState } from "@/lib/domain/policies";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// --- Button -----------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-on-primary hover:bg-primary/90 hover:shadow-[0_0_12px_rgba(163,201,255,0.35)]",
  secondary: "border border-outline-variant bg-surface-container-high text-on-surface hover:bg-surface-container-highest",
  ghost: "text-primary hover:bg-primary/10",
  danger: "border border-error/40 text-error hover:bg-error/10",
  success: "bg-secondary text-on-secondary hover:bg-secondary/90",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-4 py-2 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

// --- Layout pieces ----------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded border border-outline-variant bg-surface-container-low", className)}>
      {children}
    </section>
  );
}

export function CardHeader({
  icon,
  title,
  action,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-outline-variant bg-surface-container px-4 py-3", className)}>
      <h3 className="flex items-center gap-2 text-headline-sm text-on-surface">
        {icon && <span className="text-on-surface-variant [&>svg]:size-5">{icon}</span>}
        {title}
      </h3>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-headline-md sm:text-display-lg text-on-surface">{title}</h2>
        {subtitle && <p className="mt-1 text-body-md text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, detail }: { icon?: ReactNode; title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="text-outline [&>svg]:size-8">{icon}</div>}
      <p className="text-body-lg text-on-surface">{title}</p>
      {detail && <p className="text-body-sm text-on-surface-variant max-w-sm">{detail}</p>}
    </div>
  );
}

// --- Badges -----------------------------------------------------------------------

type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral";

const BADGE_TONES: Record<BadgeTone, string> = {
  success: "bg-secondary/15 text-secondary",
  warning: "bg-tertiary/15 text-tertiary",
  danger: "bg-error/15 text-error",
  info: "bg-primary/15 text-primary",
  neutral: "bg-surface-container-highest text-on-surface-variant",
};

export function Badge({ tone = "neutral", children, className }: { tone?: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 num text-[11px] font-semibold", BADGE_TONES[tone], className)}>
      {children}
    </span>
  );
}

const STATE_TONE: Record<CollectionState, BadgeTone> = {
  verificado: "success",
  reportado: "info",
  por_vencer: "neutral",
  vence_hoy: "warning",
  mora: "warning",
  mora_critica: "danger",
};

export function CollectionBadge({ state, days }: { state: CollectionState; days?: number }) {
  const label =
    state === "mora" || state === "mora_critica" ? `Mora (${days}d)` : COLLECTION_STATE_LABEL[state];
  return <Badge tone={STATE_TONE[state]}>{label}</Badge>;
}

// --- Forms ------------------------------------------------------------------------

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-xs font-semibold text-on-surface-variant">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-outline">{hint}</span>}
    </label>
  );
}

// --- Modal ------------------------------------------------------------------------

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-surface-container-lowest/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-h-[92vh] overflow-y-auto rounded-t-lg sm:rounded-lg border border-outline-variant bg-surface-container shadow-[0_0_0_1px_rgba(163,201,255,0.08),0_20px_60px_rgba(0,0,0,0.5)] animate-in",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-outline-variant bg-surface-container px-5 py-4">
          <h3 className="text-headline-sm">{title}</h3>
          <button onClick={onClose} className="rounded p-1 text-on-surface-variant hover:bg-surface-container-high cursor-pointer" aria-label="Cerrar">
            <X className="size-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-outline-variant px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

// --- Tabs -------------------------------------------------------------------------

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-outline-variant" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cn(
            "whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors cursor-pointer",
            value === t.value
              ? "border-primary-container text-primary"
              : "border-transparent text-on-surface-variant hover:text-on-surface",
          )}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-2 num text-[11px] text-outline">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

// --- Pagination -------------------------------------------------------------------

export function Pagination({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-outline-variant px-4 py-3 text-body-sm text-on-surface-variant">
      <span>
        Mostrando {from} - {to} de {total} registros
      </span>
      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded p-1 hover:bg-surface-container-high disabled:opacity-30 cursor-pointer"
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="num text-on-surface">
          {page} <span className="text-outline">/ {pages}</span>
        </span>
        <button
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
          className="rounded p-1 hover:bg-surface-container-high disabled:opacity-30 cursor-pointer"
          aria-label="Página siguiente"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function Initials({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(" ")
    .filter((w) => /^[A-ZÁÉÍÓÚÑ]/.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div className={cn("flex shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary-container/20 font-semibold text-primary", className ?? "size-10 text-sm")}>
      {initials}
    </div>
  );
}

export const TH = "px-4 py-3 text-left text-xs font-semibold text-on-surface-variant whitespace-nowrap";
export const TD = "px-4 py-3 align-middle";
