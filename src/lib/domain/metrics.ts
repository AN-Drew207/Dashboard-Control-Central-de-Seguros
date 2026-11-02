import {
  ageOn,
  diffDays,
  endOfMonth,
  isSameMonth,
  lastMonthKeys,
  monthKey,
  nextBirthday,
} from "./dates";
import { percentOf, sumMoney } from "./money";
import { CRITICAL_OVERDUE_DAYS, overdueDays } from "./policies";
import type { Client, Database, Installment, ISODate, Policy } from "./types";

export interface Indexes {
  clientById: Map<string, Client>;
  policyById: Map<string, Policy>;
  companyName: (id: string) => string;
}

export function buildIndexes(db: Database): Indexes {
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const policyById = new Map(db.policies.map((p) => [p.id, p]));
  const companies = new Map(db.companies.map((c) => [c.id, c.name]));
  return { clientById, policyById, companyName: (id) => companies.get(id) ?? "—" };
}

/** Installments that still count for collection (policy not cancelled). */
export function liveInstallments(db: Database): Installment[] {
  const policies = new Map(db.policies.map((p) => [p.id, p]));
  return db.installments.filter((i) => {
    const p = policies.get(i.policyId);
    return p && p.status !== "anulada";
  });
}

function commission(inst: Installment, policyById: Map<string, Policy>): number {
  const p = policyById.get(inst.policyId);
  return p ? percentOf(inst.amount, p.commissionRate) : 0;
}

export interface DashboardMetrics {
  portfolioPremium: number;
  activePolicies: number;
  activeClients: number;
  premiumsDueThisMonth: number;
  premiumsCollectedThisMonth: number;
  collectionRate: number;
  commissionsReceivable: number;
  commissionsReceivableCount: number;
  commissionsCollectedMonth: number;
  commissionsCollectedYear: number;
  commissionsEstimatedYear: number;
  emissionsMonthCount: number;
  emissionsMonthPremium: number;
  cancelledMonthCount: number;
  cancelledYearCount: number;
  overdueClients: number;
  overdueAmount: number;
  criticalOverdueCount: number;
  pendingVerificationCount: number;
}

export function dashboardMetrics(db: Database, today: ISODate): DashboardMetrics {
  const { policyById } = buildIndexes(db);
  const active = db.policies.filter((p) => p.status === "activa");
  const insts = liveInstallments(db);
  const monthEnd = endOfMonth(today);
  const year = today.slice(0, 4);

  const dueThisMonth = insts.filter((i) => isSameMonth(i.dueDate, today));
  const collectedThisMonth = insts.filter(
    (i) => i.status === "verificado" && i.verifiedAt && isSameMonth(i.verifiedAt, today),
  );
  const outstanding = insts.filter((i) => i.status !== "verificado" && i.dueDate <= monthEnd);
  const overdue = insts.filter((i) => overdueDays(i, today) > 0);
  const verifiedYear = insts.filter(
    (i) => i.status === "verificado" && i.verifiedAt?.startsWith(year),
  );
  const scheduledYear = insts.filter((i) => i.dueDate.startsWith(year));

  const emissions = db.policies.filter((p) => !p.isRenewal && isSameMonth(p.startDate, today));
  const cancelled = db.policies.filter((p) => p.status === "anulada" && p.cancelledAt);

  const dueTotal = sumMoney(dueThisMonth.map((i) => i.amount));
  const dueCollected = sumMoney(
    dueThisMonth.filter((i) => i.status === "verificado").map((i) => i.amount),
  );

  return {
    portfolioPremium: sumMoney(active.map((p) => p.annualPremium)),
    activePolicies: active.length,
    activeClients: new Set(active.map((p) => p.clientId)).size,
    premiumsDueThisMonth: sumMoney(
      dueThisMonth.filter((i) => i.status !== "verificado").map((i) => i.amount),
    ),
    premiumsCollectedThisMonth: sumMoney(collectedThisMonth.map((i) => i.amount)),
    collectionRate: dueTotal > 0 ? (dueCollected / dueTotal) * 100 : 0,
    commissionsReceivable: sumMoney(outstanding.map((i) => commission(i, policyById))),
    commissionsReceivableCount: outstanding.length,
    commissionsCollectedMonth: sumMoney(collectedThisMonth.map((i) => commission(i, policyById))),
    commissionsCollectedYear: sumMoney(verifiedYear.map((i) => commission(i, policyById))),
    commissionsEstimatedYear: sumMoney(scheduledYear.map((i) => commission(i, policyById))),
    emissionsMonthCount: emissions.length,
    emissionsMonthPremium: sumMoney(emissions.map((p) => p.annualPremium)),
    cancelledMonthCount: cancelled.filter((p) => isSameMonth(p.cancelledAt!, today)).length,
    cancelledYearCount: cancelled.filter((p) => p.cancelledAt!.startsWith(year)).length,
    overdueClients: new Set(overdue.map((i) => policyById.get(i.policyId)?.clientId)).size,
    overdueAmount: sumMoney(overdue.map((i) => i.amount)),
    criticalOverdueCount: overdue.filter((i) => overdueDays(i, today) > CRITICAL_OVERDUE_DAYS)
      .length,
    pendingVerificationCount: insts.filter((i) => i.status === "reportado").length,
  };
}

export interface BirthdayEvent {
  name: string;
  clientId: string;
  policyId: string | null;
  isHolder: boolean;
  date: ISODate;
  daysAway: number;
  turning: number;
  phone: string;
  email: string;
}

/** Birthdays of holders and insured people within the next `days` days (inclusive of today). */
export function upcomingBirthdays(db: Database, today: ISODate, days: number): BirthdayEvent[] {
  const events: BirthdayEvent[] = [];
  const seen = new Set<string>();
  const clientById = new Map(db.clients.map((c) => [c.id, c]));

  for (const c of db.clients) {
    if (!c.birthDate) continue;
    const date = nextBirthday(c.birthDate, today);
    const away = diffDays(today, date);
    if (away <= days) {
      seen.add(`${c.name}|${c.birthDate}`);
      events.push({
        name: c.name, clientId: c.id, policyId: null, isHolder: true, date, daysAway: away,
        turning: ageOn(c.birthDate, date), phone: c.phone, email: c.email,
      });
    }
  }
  for (const p of db.policies) {
    if (p.status !== "activa") continue;
    const holder = clientById.get(p.clientId);
    for (const ins of p.insured) {
      const key = `${ins.name}|${ins.birthDate}`;
      if (seen.has(key)) continue;
      const date = nextBirthday(ins.birthDate, today);
      const away = diffDays(today, date);
      if (away <= days) {
        seen.add(key);
        events.push({
          name: ins.name, clientId: p.clientId, policyId: p.id, isHolder: false, date,
          daysAway: away, turning: ageOn(ins.birthDate, date),
          phone: holder?.phone ?? "", email: holder?.email ?? "",
        });
      }
    }
  }
  return events.sort((a, b) => a.daysAway - b.daysAway);
}

export function upcomingRenewals(db: Database, today: ISODate, days: number) {
  return db.policies
    .filter((p) => p.status === "activa")
    .map((p) => ({ policy: p, daysAway: diffDays(today, p.endDate) }))
    .filter((r) => r.daysAway <= days)
    .sort((a, b) => a.daysAway - b.daysAway);
}

export interface MonthlyPoint {
  key: string;
  emissionsPremium: number;
  emissionsCount: number;
  collected: number;
  commissions: number;
  cancelled: number;
}

export function monthlySeries(db: Database, today: ISODate, months = 12): MonthlyPoint[] {
  const { policyById } = buildIndexes(db);
  const keys = lastMonthKeys(today, months);
  const map = new Map<string, MonthlyPoint>(
    keys.map((k) => [k, { key: k, emissionsPremium: 0, emissionsCount: 0, collected: 0, commissions: 0, cancelled: 0 }]),
  );
  for (const p of db.policies) {
    const point = map.get(monthKey(p.startDate));
    if (point && !p.isRenewal) {
      point.emissionsCount += 1;
      point.emissionsPremium = sumMoney([point.emissionsPremium, p.annualPremium]);
    }
    if (p.cancelledAt) {
      const c = map.get(monthKey(p.cancelledAt));
      if (c) c.cancelled += 1;
    }
  }
  for (const i of db.installments) {
    if (i.status !== "verificado" || !i.verifiedAt) continue;
    const point = map.get(monthKey(i.verifiedAt));
    if (!point) continue;
    point.collected = sumMoney([point.collected, i.amount]);
    point.commissions = sumMoney([point.commissions, commission(i, policyById)]);
  }
  return keys.map((k) => map.get(k)!);
}

export interface Breakdown {
  label: string;
  value: number;
  count: number;
}

export function breakdownBy(
  policies: Policy[],
  keyOf: (p: Policy) => string,
): Breakdown[] {
  const map = new Map<string, Breakdown>();
  for (const p of policies) {
    const label = keyOf(p);
    const b = map.get(label) ?? { label, value: 0, count: 0 };
    b.value = sumMoney([b.value, p.annualPremium]);
    b.count += 1;
    map.set(label, b);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}
