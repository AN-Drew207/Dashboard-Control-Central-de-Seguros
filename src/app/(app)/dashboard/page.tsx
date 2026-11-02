"use client";

import {
  AlertTriangle,
  Cake,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FilePlus2,
  HandCoins,
  Lightbulb,
  Send,
  TrendingUp,
  Wallet,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { MonthlyBars, ProgressBar } from "@/components/charts";
import { PaymentModal, ReminderModal, SendMessageModal } from "@/components/collections";
import { Badge, Button, Card, CardHeader, CollectionBadge, cn, EmptyState, PageHeader, TD, TH } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { addDays, formatDate, formatDateLong, relativeDays } from "@/lib/domain/dates";
import { portfolioInsights } from "@/lib/domain/insights";
import { birthdayMessage } from "@/lib/domain/messages";
import {
  dashboardMetrics,
  liveInstallments,
  monthlySeries,
  upcomingBirthdays,
  upcomingRenewals,
  type BirthdayEvent,
} from "@/lib/domain/metrics";
import { formatCompactMoney, formatMoney, formatPercent } from "@/lib/domain/money";
import { collectionState, overdueDays } from "@/lib/domain/policies";
import type { Installment } from "@/lib/domain/types";

function Kpi({
  label,
  value,
  icon,
  children,
  tone = "default",
  href,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  children?: ReactNode;
  tone?: "default" | "alert";
  href?: string;
}) {
  const body = (
    <div
      className={cn(
        "h-full rounded border p-5 transition-colors",
        tone === "alert"
          ? "border-tertiary/40 bg-gradient-to-br from-tertiary/10 to-surface-container-low"
          : "border-outline-variant bg-surface-container-low",
        href && "hover:border-primary-container/60",
      )}
    >
      <div className="mb-3 flex items-start justify-between">
        <p className={cn("text-sm font-semibold", tone === "alert" ? "text-tertiary" : "text-on-surface-variant")}>{label}</p>
        <span className={cn("[&>svg]:size-5", tone === "alert" ? "text-tertiary" : "text-outline")}>{icon}</span>
      </div>
      <p className="num text-[28px] font-bold leading-9 tracking-tight text-on-surface sm:text-[32px]">{value}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function MiniStat({ label, value, sub, icon }: { label: string; value: string; sub?: ReactNode; icon: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded border border-outline-variant bg-surface-container-low px-4 py-3">
      <span className="text-outline [&>svg]:size-5">{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-xs text-on-surface-variant">{label}</p>
        <p className="num text-body-lg font-semibold text-on-surface">{value}</p>
        {sub && <div className="text-[11px] text-outline">{sub}</div>}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { db, indexes, today } = useDb();
  const { can, user } = useAuth();
  const financial = can("viewFinancials");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [reminder, setReminder] = useState<Installment | null>(null);
  const [payment, setPayment] = useState<Installment | null>(null);
  const [greeting, setGreeting] = useState<BirthdayEvent | null>(null);

  const m = useMemo(() => dashboardMetrics(db, today), [db, today]);
  const series = useMemo(() => monthlySeries(db, today, 12), [db, today]);
  const insights = useMemo(() => (financial ? portfolioInsights(db, today).slice(0, 3) : []), [db, today, financial]);
  const renewals = useMemo(() => upcomingRenewals(db, today, 30), [db, today]);
  const birthdays = useMemo(() => upcomingBirthdays(db, today, 7), [db, today]);

  const pending = useMemo(() => {
    const horizon = addDays(today, 15);
    return liveInstallments(db)
      .filter((i) => i.status !== "verificado" && i.dueDate <= horizon)
      .filter((i) => companyFilter === "all" || indexes.policyById.get(i.policyId)?.companyId === companyFilter)
      .sort((a, b) => {
        // reported payments first (they need verification), then by due date
        if (a.status !== b.status) return a.status === "reportado" ? -1 : 1;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [db, indexes, today, companyFilter]);

  const goalProgress = (m.emissionsMonthCount / Math.max(1, db.settings.monthlyEmissionGoal)) * 100;

  return (
    <>
      <PageHeader
        title="Control Central de Seguros"
        subtitle={`Hola, ${user?.name.split(" ")[0]}. Resumen al ${formatDateLong(today)}.`}
        actions={
          <Button variant="secondary" onClick={() => window.print()}>
            <Download className="size-4" /> Exportar PDF
          </Button>
        }
      />

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {financial ? (
          <>
            <Kpi label="Primas de cartera (anual)" value={formatCompactMoney(m.portfolioPremium)} icon={<WalletCards />}>
              <p className="text-body-sm text-on-surface-variant">
                <span className="num text-on-surface">{m.activePolicies}</span> pólizas · <span className="num text-on-surface">{m.activeClients}</span> clientes
              </p>
            </Kpi>
            <Kpi label="Comisiones por cobrar" value={formatMoney(m.commissionsReceivable)} icon={<HandCoins />}>
              <Badge tone="warning">{m.commissionsReceivableCount} cuotas</Badge>
            </Kpi>
          </>
        ) : (
          <>
            <Kpi label="Primas por cobrar (mes)" value={formatMoney(m.premiumsDueThisMonth)} icon={<Wallet />} href="/cobranza">
              <p className="text-body-sm text-on-surface-variant">Cuotas que vencen este mes</p>
            </Kpi>
            <Kpi label="Pagos por verificar" value={String(m.pendingVerificationCount)} icon={<ClipboardCheck />} href="/cobranza?filtro=reportado">
              <p className="text-body-sm text-on-surface-variant">Reportados por clientes</p>
            </Kpi>
          </>
        )}
        <Kpi label="Primas cobradas (mes)" value={formatMoney(m.premiumsCollectedThisMonth)} icon={<CheckCircle2 />}>
          <ProgressBar value={m.collectionRate} />
          <p className="mt-1 text-right num text-xs text-on-surface-variant">{formatPercent(m.collectionRate, 0)} de lo que vence este mes</p>
        </Kpi>
        <Kpi label="Clientes en mora" value={String(m.overdueClients)} icon={<AlertTriangle />} tone="alert" href="/cobranza?filtro=mora">
          <p className="text-body-sm text-on-surface-variant">
            Total riesgo: <span className="num text-on-surface">{formatMoney(m.overdueAmount)}</span>
          </p>
          {m.criticalOverdueCount > 0 && <p className="mt-1 text-xs text-error">{m.criticalOverdueCount} cuotas con más de 14 días</p>}
        </Kpi>
      </div>

      {/* Secondary stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat
          label="Emisiones del mes"
          value={`${m.emissionsMonthCount} / ${db.settings.monthlyEmissionGoal}`}
          icon={<FilePlus2 />}
          sub={
            goalProgress >= 100 ? <span className="text-secondary">Meta superada 🎉</span> : `${formatMoney(m.emissionsMonthPremium)} en primas`
          }
        />
        {financial ? (
          <>
            <MiniStat label="Comisiones cobradas (mes)" value={formatMoney(m.commissionsCollectedMonth)} icon={<TrendingUp />} sub={`Año: ${formatMoney(m.commissionsCollectedYear)}`} />
            <MiniStat label="Comisiones estimadas (año)" value={formatCompactMoney(m.commissionsEstimatedYear)} icon={<HandCoins />} sub="Según cuotas programadas" />
          </>
        ) : (
          <>
            <MiniStat label="Primas cobradas (mes)" value={formatMoney(m.premiumsCollectedThisMonth)} icon={<CheckCircle2 />} />
            <MiniStat label="Renovaciones (30 días)" value={String(renewals.length)} icon={<CalendarClock />} />
          </>
        )}
        <MiniStat label="Pólizas anuladas" value={`${m.cancelledMonthCount} este mes`} icon={<XCircle />} sub={`${m.cancelledYearCount} en el año`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {/* Pending collections */}
          <Card className="overflow-hidden">
            <CardHeader
              icon={<Wallet />}
              title="Cobranzas pendientes"
              action={
                <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} className="input-base !w-auto !py-1.5 text-sm">
                  <option value="all">Todas las compañías</option>
                  {db.companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-body-md">
                <thead className="bg-surface-container-lowest/60">
                  <tr>
                    <th className={TH}>Cliente / Póliza</th>
                    <th className={TH}>Compañía</th>
                    <th className={cn(TH, "text-right")}>Monto</th>
                    <th className={TH}>Vencimiento</th>
                    <th className={TH}>Estado</th>
                    <th className={TH}></th>
                  </tr>
                </thead>
                <tbody>
                  {pending.slice(0, 8).map((inst) => {
                    const p = indexes.policyById.get(inst.policyId)!;
                    const c = indexes.clientById.get(p.clientId)!;
                    const state = collectionState(inst, today);
                    const overdue = overdueDays(inst, today) > 0;
                    return (
                      <tr key={inst.id} className="border-t border-outline-variant/60 hover:bg-surface-container">
                        <td className={TD}>
                          <Link href={`/clientes/${c.id}`} className="font-semibold text-on-surface hover:text-primary">{c.name}</Link>
                          <p className="num text-xs text-on-surface-variant">{p.number}</p>
                        </td>
                        <td className={cn(TD, "text-on-surface-variant")}>{indexes.companyName(p.companyId)}</td>
                        <td className={cn(TD, "text-right num font-semibold")}>{formatMoney(inst.amount)}</td>
                        <td className={cn(TD, "whitespace-nowrap", overdue ? "text-error" : "text-on-surface-variant")}>{formatDate(inst.dueDate)}</td>
                        <td className={TD}><CollectionBadge state={state} days={overdueDays(inst, today)} /></td>
                        <td className={cn(TD, "text-right whitespace-nowrap")}>
                          {inst.status === "pendiente" ? (
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="ghost" onClick={() => setReminder(inst)}>Recordar</Button>
                              <Button size="sm" variant="secondary" onClick={() => setPayment(inst)}>Pagó</Button>
                            </div>
                          ) : (
                            <Link href="/cobranza?filtro=reportado" className="text-xs font-semibold text-primary hover:underline">Verificar</Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {pending.length === 0 && <EmptyState icon={<CheckCircle2 />} title="Sin cobranzas pendientes" detail="No hay cuotas por cobrar en los próximos 15 días." />}
            </div>
            <Link href="/cobranza" className="block border-t border-outline-variant py-3 text-center text-sm font-semibold text-primary hover:bg-surface-container">
              Ver todas las cobranzas ({pending.length})
            </Link>
          </Card>

          {financial && (
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader icon={<TrendingUp />} title="Primas cobradas · 12 meses" />
                <div className="p-4">
                  <MonthlyBars data={series.map((s) => ({ key: s.key, value: s.collected }))} format={formatMoney} />
                </div>
              </Card>
              <Card>
                <CardHeader
                  icon={<Lightbulb />}
                  title="Ideas de crecimiento"
                  action={<Link href="/reportes" className="text-xs font-semibold text-primary hover:underline">Ver todas</Link>}
                />
                <ul className="divide-y divide-outline-variant/60">
                  {insights.map((ins) => (
                    <li key={ins.id} className="px-4 py-3">
                      <p className={cn("text-body-md font-semibold", ins.tone === "risk" ? "text-tertiary" : ins.tone === "growth" ? "text-secondary" : "text-on-surface")}>
                        {ins.title}
                      </p>
                      <p className="mt-0.5 text-body-sm text-on-surface-variant">{ins.detail}</p>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6">
          {/* Renewals */}
          <Card>
            <CardHeader icon={<CalendarClock />} title="Renovaciones (30d)" action={<Badge tone="info">{renewals.length}</Badge>} />
            <ul className="divide-y divide-outline-variant/60">
              {renewals.slice(0, 5).map(({ policy, daysAway }) => {
                const c = indexes.clientById.get(policy.clientId)!;
                return (
                  <li key={policy.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-md font-semibold">{policy.product} · {c.name}</p>
                      <p className="num truncate text-xs text-on-surface-variant">
                        {db.companies.find((x) => x.id === policy.companyId)?.shortName} · {policy.number}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("num text-xs font-semibold", daysAway <= 7 ? "text-tertiary" : "text-on-surface-variant")}>{relativeDays(daysAway)}</p>
                      <Link href="/renovaciones" className="text-xs font-semibold text-primary hover:underline">Gestionar</Link>
                    </div>
                  </li>
                );
              })}
              {renewals.length === 0 && <li className="px-4 py-6 text-center text-body-sm text-on-surface-variant">Sin renovaciones próximas.</li>}
            </ul>
          </Card>

          {/* Birthdays */}
          <Card>
            <div id="eventos" />
            <CardHeader icon={<Cake />} title="Cumpleaños de la semana" action={<Badge tone="success">{birthdays.length}</Badge>} />
            <ul className="divide-y divide-outline-variant/60">
              {birthdays.map((b) => (
                <li key={`${b.name}-${b.date}`} className="flex items-center gap-3 px-4 py-3">
                  <div className={cn("flex size-9 shrink-0 items-center justify-center rounded border", b.daysAway === 0 ? "border-secondary/40 bg-secondary/15 text-secondary" : "border-outline-variant bg-surface-container text-outline")}>
                    <Cake className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link href={`/clientes/${b.clientId}`} className="block truncate text-body-md hover:text-primary">{b.name}</Link>
                    <p className="num text-xs text-on-surface-variant">
                      {b.daysAway === 0 ? "Hoy" : relativeDays(b.daysAway)} · {formatDate(b.date)} · {b.turning} años{!b.isHolder && " · asegurado"}
                    </p>
                  </div>
                  <button onClick={() => setGreeting(b)} className="rounded p-2 text-primary hover:bg-primary/10 cursor-pointer" aria-label={`Felicitar a ${b.name}`}>
                    <Send className="size-4" />
                  </button>
                </li>
              ))}
              {birthdays.length === 0 && <li className="px-4 py-6 text-center text-body-sm text-on-surface-variant">Sin cumpleaños esta semana.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <ReminderModal installment={reminder} onClose={() => setReminder(null)} />
      {payment && <PaymentModal installment={payment} onClose={() => setPayment(null)} />}
      {greeting && (
        <SendMessageModal
          open
          onClose={() => setGreeting(null)}
          title={`Felicitar a ${greeting.name}`}
          clientId={greeting.clientId}
          kind="cumpleanos"
          initialMessage={birthdayMessage(greeting.name, db.settings.brokerName)}
          subject="¡Feliz cumpleaños!"
          phone={greeting.phone}
          email={greeting.email}
        />
      )}
    </>
  );
}
