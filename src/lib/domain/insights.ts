import { addMonths, ageOn, MONTHS_LONG_ES, parts } from "./dates";
import { formatMoney, formatPercent } from "./money";
import {
  dashboardMetrics,
  liveInstallments,
  monthlySeries,
  upcomingBirthdays,
  upcomingRenewals,
} from "./metrics";
import { CRITICAL_OVERDUE_DAYS, FREQUENCY_LABEL, overdueDays } from "./policies";
import type { Client, Database, ISODate, Product } from "./types";

export type InsightTone = "growth" | "risk" | "info";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail: string;
  action?: { label: string; href: string };
}

/** Products that usually complement what a client already has. */
const COMPLEMENTS: Partial<Record<Product, Product[]>> = {
  Salud: ["Vida", "Accidentes Personales", "Funerario"],
  Vida: ["Salud", "Accidentes Personales"],
  Automóvil: ["Accidentes Personales", "Hogar"],
  Hogar: ["Incendio", "Automóvil"],
  Funerario: ["Vida", "Salud"],
};

export interface CrossSellOpportunity {
  client: Client;
  has: Product[];
  suggest: Product;
}

export function crossSellOpportunities(db: Database): CrossSellOpportunity[] {
  const result: CrossSellOpportunity[] = [];
  for (const c of db.clients) {
    const has = [
      ...new Set(
        db.policies.filter((p) => p.clientId === c.id && p.status === "activa").map((p) => p.product),
      ),
    ];
    if (has.length === 0 || has.length > 2) continue;
    const suggest = has.flatMap((p) => COMPLEMENTS[p] ?? []).find((s) => !has.includes(s));
    if (suggest) result.push({ client: c, has, suggest });
  }
  return result;
}

/** Rule-based "AI" analysis of the portfolio. Deterministic, so numbers always match the data. */
export function portfolioInsights(db: Database, today: ISODate): Insight[] {
  const m = dashboardMetrics(db, today);
  const insights: Insight[] = [];
  const active = db.policies.filter((p) => p.status === "activa");

  // Concentration by company
  const byCompany = new Map<string, number>();
  for (const p of active) byCompany.set(p.companyId, (byCompany.get(p.companyId) ?? 0) + p.annualPremium);
  const top = [...byCompany.entries()].sort((a, b) => b[1] - a[1])[0];
  if (top && m.portfolioPremium > 0) {
    const share = (top[1] / m.portfolioPremium) * 100;
    const name = db.companies.find((c) => c.id === top[0])?.name ?? "";
    insights.push({
      id: "concentration",
      tone: share > 45 ? "risk" : "info",
      title: `${name} concentra el ${formatPercent(share)} de tus primas`,
      detail:
        share > 45
          ? "Alta dependencia de una sola compañía. Diversificar reduce el riesgo ante cambios de tarifas o condiciones."
          : "Tu cartera está razonablemente diversificada entre compañías.",
    });
  }

  // Payment frequency mix
  const monthly = active.filter((p) => p.frequency === "mensual").length;
  if (active.length > 0 && monthly / active.length > 0.4) {
    insights.push({
      id: "frequency",
      tone: "growth",
      title: `${formatPercent((monthly / active.length) * 100, 0)} de tus pólizas paga ${FREQUENCY_LABEL.mensual.toLowerCase()}`,
      detail:
        "Más cuotas significan más gestiones de cobro y más riesgo de mora. Ofrece pasar a pago trimestral o anual en la próxima renovación.",
      action: { label: "Ver cobranza", href: "/cobranza" },
    });
  }

  // Overdue
  if (m.criticalOverdueCount > 0) {
    insights.push({
      id: "overdue",
      tone: "risk",
      title: `${m.criticalOverdueCount} cuotas superan ${CRITICAL_OVERDUE_DAYS} días de mora`,
      detail: `Hay ${formatMoney(m.overdueAmount)} vencidos en total. Prioriza llamadas directas a estos clientes antes de que la compañía suspenda la cobertura.`,
      action: { label: "Gestionar mora", href: "/cobranza?filtro=mora" },
    });
  }

  // Best months
  const series = monthlySeries(db, today, 12);
  const best = [...series].sort((a, b) => b.emissionsPremium - a.emissionsPremium).slice(0, 2);
  if (best[0]?.emissionsCount) {
    const names = best.map((b) => MONTHS_LONG_ES[parts(`${b.key}-01`).m - 1]);
    insights.push({
      id: "best-months",
      tone: "info",
      title: `Tus mejores meses de emisión: ${names.join(" y ")}`,
      detail:
        "Planifica campañas de prospección uno o dos meses antes de esos picos para aprovechar la tendencia.",
    });
  }

  // Cross-sell
  const cross = crossSellOpportunities(db);
  if (cross.length > 0) {
    insights.push({
      id: "cross-sell",
      tone: "growth",
      title: `${cross.length} clientes con oportunidad de producto complementario`,
      detail: `Ejemplo: ${cross[0].client.name} tiene ${cross[0].has.join(", ")}; le encaja un plan de ${cross[0].suggest}.`,
      action: { label: "Ver oportunidades", href: "/reportes#oportunidades" },
    });
  }

  // Dependents turning 18 within the next 6 months
  const sixMonths = addMonths(today, 6);
  const turning18 = active.flatMap((p) =>
    p.insured.filter(
      (i) => i.relationship === "Hijo(a)" && ageOn(i.birthDate, today) === 17 && ageOn(i.birthDate, sixMonths) >= 18,
    ),
  );
  if (turning18.length > 0) {
    insights.push({
      id: "turning-18",
      tone: "growth",
      title: `${turning18.length} asegurado(s) cumplen 18 años en los próximos 6 meses`,
      detail: "Es el momento ideal para ofrecerles su propia póliza individual o de vida.",
    });
  }

  // Seniors
  const seniors = active.flatMap((p) => p.insured.filter((i) => ageOn(i.birthDate, today) >= 60));
  if (seniors.length > 0) {
    insights.push({
      id: "seniors",
      tone: "info",
      title: `${seniors.length} asegurados tienen 60 años o más`,
      detail: "Revisa topes de edad y aumentos por rango etario en sus próximas renovaciones para anticipar objeciones.",
    });
  }

  // Renewals
  const renewals = upcomingRenewals(db, today, 60);
  if (renewals.length > 0) {
    insights.push({
      id: "renewals",
      tone: "growth",
      title: `${renewals.length} renovaciones en los próximos 60 días`,
      detail: "Contacta antes del vencimiento: es la mejor ocasión para ajustar suma asegurada y ofrecer coberturas adicionales.",
      action: { label: "Ver renovaciones", href: "/renovaciones" },
    });
  }

  // Cancellations
  if (m.cancelledYearCount > 0) {
    insights.push({
      id: "cancelled",
      tone: "risk",
      title: `${m.cancelledYearCount} pólizas salieron de cartera este año`,
      detail: "Registra el motivo de cada anulación para detectar patrones (precio, servicio, competencia).",
    });
  }

  return insights;
}

export type NotificationLevel = "critical" | "warning" | "success" | "info";

export interface AppNotification {
  id: string;
  level: NotificationLevel;
  title: string;
  detail: string;
  href: string;
}

export function buildNotifications(db: Database, today: ISODate): AppNotification[] {
  const list: AppNotification[] = [];
  const m = dashboardMetrics(db, today);
  const policyById = new Map(db.policies.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));

  for (const inst of liveInstallments(db)) {
    const days = overdueDays(inst, today);
    if (days <= 0) continue;
    const policy = policyById.get(inst.policyId);
    const client = policy ? clientById.get(policy.clientId) : undefined;
    if (!policy || !client) continue;
    list.push({
      id: `mora-${inst.id}`,
      level: days > CRITICAL_OVERDUE_DAYS ? "critical" : "warning",
      title: days > CRITICAL_OVERDUE_DAYS ? `Mora de ${days} días` : `Cliente en mora (${days}d)`,
      detail: `${client.name} · ${policy.number} · ${formatMoney(inst.amount)}`,
      href: `/cobranza?filtro=mora`,
    });
  }

  for (const b of upcomingBirthdays(db, today, 7)) {
    list.push({
      id: `bday-${b.name}-${b.date}`,
      level: b.daysAway === 0 ? "success" : "info",
      title: b.daysAway === 0 ? "Cumpleaños hoy" : `Cumpleaños en ${b.daysAway} días`,
      detail: `${b.name} cumple ${b.turning} años`,
      href: `/clientes/${b.clientId}`,
    });
  }

  if (m.emissionsMonthCount >= db.settings.monthlyEmissionGoal) {
    list.unshift({
      id: "goal",
      level: "success",
      title: "¡Meta mensual de emisiones superada!",
      detail: `${m.emissionsMonthCount} pólizas emitidas (meta: ${db.settings.monthlyEmissionGoal})`,
      href: "/reportes",
    });
  }

  if (m.pendingVerificationCount > 0) {
    list.push({
      id: "verify",
      level: "info",
      title: "Pagos por verificar",
      detail: `${m.pendingVerificationCount} pagos reportados esperan verificación`,
      href: "/cobranza?filtro=reportado",
    });
  }

  const order: Record<NotificationLevel, number> = { critical: 0, success: 1, warning: 2, info: 3 };
  return list.sort((a, b) => order[a.level] - order[b.level]);
}
