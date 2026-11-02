"use client";

import { BarChart3, Download, Lightbulb, PieChart, Send, ShieldAlert, TrendingUp, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MonthlyBars, RankedBars } from "@/components/charts";
import { SendMessageModal } from "@/components/collections";
import { RequirePermission } from "@/components/layout/AppShell";
import { Badge, Button, Card, CardHeader, cn, PageHeader, Tabs, TD, TH } from "@/components/ui/primitives";
import { useDb } from "@/context/DataContext";
import { exportCsv } from "@/lib/browser";
import { formatDate, formatDateLong, formatMonth } from "@/lib/domain/dates";
import { crossSellOpportunities, portfolioInsights, type CrossSellOpportunity, type InsightTone } from "@/lib/domain/insights";
import { crossSellMessage } from "@/lib/domain/messages";
import { breakdownBy, dashboardMetrics, liveInstallments, monthlySeries } from "@/lib/domain/metrics";
import { formatCompactMoney, formatMoney, percentOf, sumMoney } from "@/lib/domain/money";
import { FREQUENCY_LABEL, POLICY_TYPE_LABEL } from "@/lib/domain/policies";

type SeriesKey = "emissionsPremium" | "collected" | "commissions";
type BreakdownKey = "company" | "product" | "type" | "frequency";

const TONE_STYLE: Record<InsightTone, string> = {
  growth: "border-secondary/30 bg-secondary/5",
  risk: "border-tertiary/30 bg-tertiary/5",
  info: "border-outline-variant bg-surface-container-low",
};
const TONE_LABEL: Record<InsightTone, { text: string; tone: "success" | "warning" | "info" }> = {
  growth: { text: "Crecimiento", tone: "success" },
  risk: { text: "Riesgo", tone: "warning" },
  info: { text: "Análisis", tone: "info" },
};

function Reports() {
  const { db, indexes, today } = useDb();
  const [seriesKey, setSeriesKey] = useState<SeriesKey>("emissionsPremium");
  const [breakdown, setBreakdown] = useState<BreakdownKey>("company");
  const [offer, setOffer] = useState<CrossSellOpportunity | null>(null);

  const m = useMemo(() => dashboardMetrics(db, today), [db, today]);
  const series = useMemo(() => monthlySeries(db, today, 12), [db, today]);
  const insights = useMemo(() => portfolioInsights(db, today), [db, today]);
  const opportunities = useMemo(() => crossSellOpportunities(db), [db]);
  const active = useMemo(() => db.policies.filter((p) => p.status === "activa"), [db]);

  const breakdownRows = useMemo(() => {
    const keyOf = {
      company: (p: (typeof active)[number]) => indexes.companyName(p.companyId),
      product: (p: (typeof active)[number]) => p.product,
      type: (p: (typeof active)[number]) => POLICY_TYPE_LABEL[p.policyType],
      frequency: (p: (typeof active)[number]) => FREQUENCY_LABEL[p.frequency],
    }[breakdown];
    return breakdownBy(active, keyOf).map((b) => ({ label: b.label, value: b.value, sub: `${b.count} pól.` }));
  }, [active, breakdown, indexes]);

  const commissionsByCompany = useMemo(() => {
    const insts = liveInstallments(db);
    return db.companies
      .map((c) => {
        const policies = db.policies.filter((p) => p.companyId === c.id);
        const ids = new Map(policies.map((p) => [p.id, p]));
        const mine = insts.filter((i) => ids.has(i.policyId));
        const comm = (list: typeof mine) => sumMoney(list.map((i) => percentOf(i.amount, ids.get(i.policyId)!.commissionRate)));
        const year = today.slice(0, 4);
        return {
          company: c,
          premium: sumMoney(policies.filter((p) => p.status === "activa").map((p) => p.annualPremium)),
          collected: comm(mine.filter((i) => i.status === "verificado" && i.verifiedAt?.startsWith(year))),
          receivable: comm(mine.filter((i) => i.status !== "verificado" && i.dueDate <= today)),
          estimated: comm(mine.filter((i) => i.dueDate.startsWith(year))),
        };
      })
      .filter((r) => r.premium > 0 || r.collected > 0)
      .sort((a, b) => b.premium - a.premium);
  }, [db, today]);

  const cancelled = db.policies
    .filter((p) => p.status === "anulada")
    .sort((a, b) => (b.cancelledAt ?? "").localeCompare(a.cancelledAt ?? ""));

  return (
    <>
      <PageHeader
        title="Reportes de cartera"
        subtitle={`Rendimiento y comportamiento de tu cartera al ${formatDateLong(today)}.`}
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                exportCsv(
                  [["Mes", "Emisiones (#)", "Emisiones (prima)", "Cobrado", "Comisiones cobradas", "Anuladas"], ...series.map((s) => [formatMonth(s.key), s.emissionsCount, s.emissionsPremium.toFixed(2), s.collected.toFixed(2), s.commissions.toFixed(2), s.cancelled])],
                  `reporte-mensual-${today}.csv`,
                )
              }
            >
              <Download className="size-4" /> CSV mensual
            </Button>
            <Button onClick={() => window.print()}>
              <Download className="size-4" /> Exportar PDF
            </Button>
          </>
        }
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Primas de cartera", value: formatCompactMoney(m.portfolioPremium), sub: `${m.activePolicies} pólizas activas` },
          { label: "Comisiones cobradas (año)", value: formatMoney(m.commissionsCollectedYear), sub: `Mes: ${formatMoney(m.commissionsCollectedMonth)}` },
          { label: "Comisiones por cobrar", value: formatMoney(m.commissionsReceivable), sub: `Estimado anual: ${formatCompactMoney(m.commissionsEstimatedYear)}` },
          { label: "Emisiones del mes", value: formatMoney(m.emissionsMonthPremium), sub: `${m.emissionsMonthCount} pólizas · meta ${db.settings.monthlyEmissionGoal}` },
        ].map((s) => (
          <div key={s.label} className="rounded border border-outline-variant bg-surface-container-low p-4">
            <p className="text-xs text-on-surface-variant">{s.label}</p>
            <p className="num mt-1 text-headline-sm sm:text-headline-md">{s.value}</p>
            <p className="mt-1 text-[11px] text-outline">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardHeader icon={<BarChart3 />} title="Últimos 12 meses" />
          <div className="px-4 pt-2">
            <Tabs<SeriesKey>
              value={seriesKey}
              onChange={setSeriesKey}
              tabs={[
                { value: "emissionsPremium", label: "Emisiones (prima)" },
                { value: "collected", label: "Primas cobradas" },
                { value: "commissions", label: "Comisiones cobradas" },
              ]}
            />
          </div>
          <div className="p-4">
            <MonthlyBars data={series.map((s) => ({ key: s.key, value: s[seriesKey] }))} format={formatMoney} height={220} />
          </div>
        </Card>

        <Card>
          <CardHeader icon={<PieChart />} title="Composición de cartera" />
          <div className="px-4 pt-2">
            <Tabs<BreakdownKey>
              value={breakdown}
              onChange={setBreakdown}
              tabs={[
                { value: "company", label: "Compañía" },
                { value: "product", label: "Producto" },
                { value: "type", label: "Tipo" },
                { value: "frequency", label: "Frecuencia" },
              ]}
            />
          </div>
          <div className="p-4">
            <RankedBars rows={breakdownRows} format={formatCompactMoney} />
          </div>
        </Card>
      </div>

      {/* Insights */}
      <Card className="mb-6">
        <CardHeader icon={<Lightbulb />} title="Conclusiones e ideas de crecimiento" action={<Badge tone="info">Análisis automático</Badge>} />
        <div className="grid gap-3 p-4 md:grid-cols-2">
          {insights.map((ins) => (
            <div key={ins.id} className={cn("rounded border p-4", TONE_STYLE[ins.tone])}>
              <Badge tone={TONE_LABEL[ins.tone].tone}>{TONE_LABEL[ins.tone].text}</Badge>
              <p className="mt-2 font-semibold text-on-surface">{ins.title}</p>
              <p className="mt-1 text-body-sm text-on-surface-variant">{ins.detail}</p>
              {ins.action && (
                <Link href={ins.action.href} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
                  {ins.action.label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Commissions by company */}
      <Card className="mb-6 overflow-hidden">
        <CardHeader icon={<TrendingUp />} title="Comisiones por compañía" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-body-md">
            <thead className="bg-surface-container-lowest/60">
              <tr>
                <th className={TH}>Compañía</th>
                <th className={cn(TH, "text-right")}>Primas activas</th>
                <th className={cn(TH, "text-right")}>Cobradas (año)</th>
                <th className={cn(TH, "text-right")}>Por cobrar (vencidas)</th>
                <th className={cn(TH, "text-right")}>Estimado anual</th>
              </tr>
            </thead>
            <tbody>
              {commissionsByCompany.map((r) => (
                <tr key={r.company.id} className="border-t border-outline-variant/60">
                  <td className={TD}>{r.company.name} <span className="text-xs text-outline">· {r.company.defaultCommissionRate}%</span></td>
                  <td className={cn(TD, "num text-right")}>{formatMoney(r.premium)}</td>
                  <td className={cn(TD, "num text-right text-secondary")}>{formatMoney(r.collected)}</td>
                  <td className={cn(TD, "num text-right text-tertiary")}>{formatMoney(r.receivable)}</td>
                  <td className={cn(TD, "num text-right")}>{formatMoney(r.estimated)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-outline-variant bg-surface-container font-semibold">
                <td className={TD}>Total</td>
                <td className={cn(TD, "num text-right")}>{formatMoney(sumMoney(commissionsByCompany.map((r) => r.premium)))}</td>
                <td className={cn(TD, "num text-right")}>{formatMoney(sumMoney(commissionsByCompany.map((r) => r.collected)))}</td>
                <td className={cn(TD, "num text-right")}>{formatMoney(sumMoney(commissionsByCompany.map((r) => r.receivable)))}</td>
                <td className={cn(TD, "num text-right")}>{formatMoney(sumMoney(commissionsByCompany.map((r) => r.estimated)))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="overflow-hidden">
          <div id="oportunidades" />
          <CardHeader icon={<Send />} title="Oportunidades de producto complementario" action={<Badge tone="success">{opportunities.length}</Badge>} />
          <ul className="max-h-[420px] divide-y divide-outline-variant/60 overflow-y-auto">
            {opportunities.map((o) => (
              <li key={o.client.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link href={`/clientes/${o.client.id}`} className="text-body-md hover:text-primary">{o.client.name}</Link>
                  <p className="text-xs text-on-surface-variant">
                    Tiene {o.has.join(", ")} → ofrecer <span className="font-semibold text-secondary">{o.suggest}</span>
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setOffer(o)}>Proponer</Button>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader icon={<XCircle />} title="Pólizas que salieron de cartera" action={<Badge tone="danger">{cancelled.length}</Badge>} />
          <ul className="max-h-[420px] divide-y divide-outline-variant/60 overflow-y-auto">
            {cancelled.map((p) => (
              <li key={p.id} className="px-4 py-3">
                <div className="flex justify-between gap-2">
                  <Link href={`/clientes/${p.clientId}?tab=historico`} className="text-body-md hover:text-primary">{indexes.clientById.get(p.clientId)?.name}</Link>
                  <span className="num text-xs text-outline">{formatDate(p.cancelledAt)}</span>
                </div>
                <p className="text-xs text-on-surface-variant">
                  {p.product} · {indexes.companyName(p.companyId)} · <span className="num">{formatMoney(p.annualPremium)}</span>
                </p>
                <p className="text-xs text-tertiary">{p.cancelReason}</p>
              </li>
            ))}
            {cancelled.length === 0 && (
              <li className="flex items-center gap-2 px-4 py-6 text-body-sm text-outline"><ShieldAlert className="size-4" /> Sin anulaciones.</li>
            )}
          </ul>
        </Card>
      </div>

      {offer && (
        <SendMessageModal
          open
          onClose={() => setOffer(null)}
          title={`Propuesta de ${offer.suggest} · ${offer.client.name}`}
          clientId={offer.client.id}
          kind="producto"
          initialMessage={crossSellMessage(offer.client, offer.suggest, db.settings.brokerName)}
          subject={`Propuesta: plan de ${offer.suggest}`}
          phone={offer.client.phone}
          email={offer.client.email}
        />
      )}
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequirePermission permission="viewReports">
      <Reports />
    </RequirePermission>
  );
}
