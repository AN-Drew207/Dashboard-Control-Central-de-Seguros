"use client";

import { CalendarClock, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Button, Card, cn, EmptyState, Field, Modal, PageHeader, Tabs, TD, TH } from "@/components/ui/primitives";
import { useDb } from "@/context/DataContext";
import { formatDate, relativeDays } from "@/lib/domain/dates";
import { formatMoney } from "@/lib/domain/money";
import { FREQUENCIES, FREQUENCY_LABEL, POLICY_TYPE_LABEL, policyEndDate } from "@/lib/domain/policies";
import { upcomingRenewals } from "@/lib/domain/metrics";
import type { Frequency, Policy } from "@/lib/domain/types";

type Range = "30" | "60" | "90";

export default function RenewalsPage() {
  const { db, indexes, today, run, api } = useDb();
  const [range, setRange] = useState<Range>("60");
  const [renewing, setRenewing] = useState<Policy | null>(null);

  const all = useMemo(() => upcomingRenewals(db, today, 90), [db, today]);
  const rows = all.filter((r) => r.daysAway <= Number(range));

  return (
    <>
      <PageHeader title="Renovaciones" subtitle="Pólizas que vencen pronto: el mejor momento para retener y ampliar coberturas." />

      <Tabs<Range>
        value={range}
        onChange={setRange}
        tabs={[
          { value: "30", label: "30 días", count: all.filter((r) => r.daysAway <= 30).length },
          { value: "60", label: "60 días", count: all.filter((r) => r.daysAway <= 60).length },
          { value: "90", label: "90 días", count: all.length },
        ]}
      />

      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-body-md">
            <thead className="bg-surface-container">
              <tr>
                <th className={TH}>Cliente / Póliza</th>
                <th className={TH}>Producto</th>
                <th className={TH}>Compañía</th>
                <th className={TH}>Vence</th>
                <th className={cn(TH, "text-right")}>Prima actual</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ policy, daysAway }) => {
                const c = indexes.clientById.get(policy.clientId)!;
                return (
                  <tr key={policy.id} className="border-t border-outline-variant/60 hover:bg-surface-container">
                    <td className={TD}>
                      <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-primary">{c.name}</Link>
                      <p className="num text-xs text-on-surface-variant">{policy.number}</p>
                    </td>
                    <td className={TD}>
                      {policy.product}
                      <p className="text-xs text-outline">{POLICY_TYPE_LABEL[policy.policyType]}</p>
                    </td>
                    <td className={cn(TD, "text-on-surface-variant")}>{indexes.companyName(policy.companyId)}</td>
                    <td className={TD}>
                      <p className="num">{formatDate(policy.endDate)}</p>
                      <Badge tone={daysAway < 0 ? "danger" : daysAway <= 7 ? "warning" : "neutral"}>{relativeDays(daysAway)}</Badge>
                    </td>
                    <td className={cn(TD, "num text-right")}>
                      {formatMoney(policy.annualPremium)}
                      <p className="text-xs text-outline">{FREQUENCY_LABEL[policy.frequency]}</p>
                    </td>
                    <td className={cn(TD, "text-right")}>
                      <Button size="sm" onClick={() => setRenewing(policy)}>
                        <RefreshCw className="size-3.5" /> Renovar
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon={<CalendarClock />} title="Sin renovaciones en este rango" />}
        </div>
      </Card>

      {renewing && (
        <RenewModal
          policy={renewing}
          onClose={() => setRenewing(null)}
          onConfirm={async (changes) => {
            await run(api.renewPolicy(renewing.id, changes), "Póliza renovada y nuevo cronograma generado");
            setRenewing(null);
          }}
        />
      )}
    </>
  );
}

function RenewModal({
  policy,
  onClose,
  onConfirm,
}: {
  policy: Policy;
  onClose: () => void;
  onConfirm: (c: { annualPremium: number; frequency: Frequency; sumInsured: number }) => void;
}) {
  const [premium, setPremium] = useState(String(policy.annualPremium));
  const [sum, setSum] = useState(String(policy.sumInsured));
  const [frequency, setFrequency] = useState<Frequency>(policy.frequency);
  const change = ((Number(premium) - policy.annualPremium) / policy.annualPremium) * 100;

  return (
    <Modal
      open
      onClose={onClose}
      title={`Renovar ${policy.number}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            disabled={!(Number(premium) > 0 && Number(sum) > 0)}
            onClick={() => onConfirm({ annualPremium: Math.round(Number(premium) * 100) / 100, sumInsured: Number(sum), frequency })}
          >
            Confirmar renovación
          </Button>
        </>
      }
    >
      <p className="mb-4 text-body-sm text-on-surface-variant">
        Nueva vigencia: <span className="num text-on-surface">{formatDate(policy.endDate)} → {formatDate(policyEndDate(policy.endDate))}</span>
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nueva prima anual (USD)" hint={Number.isFinite(change) && change !== 0 ? `${change > 0 ? "+" : ""}${change.toFixed(1)}% vs. período anterior` : undefined}>
          <input type="number" step="0.01" value={premium} onChange={(e) => setPremium(e.target.value)} className="input-base num" />
        </Field>
        <Field label="Suma asegurada (USD)">
          <input type="number" value={sum} onChange={(e) => setSum(e.target.value)} className="input-base num" />
        </Field>
        <Field label="Frecuencia de pago" hint="Sugerencia: pago anual o trimestral reduce la mora." className="sm:col-span-2">
          <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="input-base">
            {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}
