"use client";

import { Check, CheckCircle2, Download, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PaymentModal, ReminderModal } from "@/components/collections";
import { Badge, Button, Card, CollectionBadge, cn, EmptyState, PageHeader, Pagination, Tabs, TD, TH } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { exportCsv, useInitialQueryParam } from "@/lib/browser";
import { addDays, formatDate, isSameMonth } from "@/lib/domain/dates";
import { liveInstallments } from "@/lib/domain/metrics";
import { formatMoney, sumMoney } from "@/lib/domain/money";
import {
  collectionState,
  COLLECTION_STATE_LABEL,
  CRITICAL_OVERDUE_DAYS,
  overdueDays,
  protocolStage,
} from "@/lib/domain/policies";
import type { Installment } from "@/lib/domain/types";

type Filter = "pendientes" | "hoy" | "mora" | "critica" | "reportado" | "proximos" | "verificados";
const PAGE_SIZE = 15;

export default function CollectionsPage() {
  const { db, indexes, today, run, api } = useDb();
  const { user } = useAuth();
  const [filter, setFilter] = useInitialQueryParam<Filter>("filtro", "pendientes");
  const [company, setCompany] = useState("all");
  const [page, setPage] = useState(1);
  const [reminder, setReminder] = useState<Installment | null>(null);
  const [payment, setPayment] = useState<Installment | null>(null);

  const all = useMemo(() => liveInstallments(db), [db]);

  const groups = useMemo(() => {
    const in30 = addDays(today, 30);
    const unpaid = all.filter((i) => i.status === "pendiente");
    return {
      pendientes: unpaid.filter((i) => i.dueDate <= today),
      hoy: unpaid.filter((i) => i.dueDate === today),
      mora: unpaid.filter((i) => overdueDays(i, today) > 0),
      critica: unpaid.filter((i) => overdueDays(i, today) > CRITICAL_OVERDUE_DAYS),
      reportado: all.filter((i) => i.status === "reportado"),
      proximos: unpaid.filter((i) => i.dueDate > today && i.dueDate <= in30),
      verificados: all.filter((i) => i.status === "verificado" && i.verifiedAt && isSameMonth(i.verifiedAt, today)),
    } satisfies Record<Filter, Installment[]>;
  }, [all, today]);

  const rows = useMemo(
    () =>
      groups[filter]
        .filter((i) => company === "all" || indexes.policyById.get(i.policyId)?.companyId === company)
        .sort((a, b) => (filter === "verificados" ? b.verifiedAt!.localeCompare(a.verifiedAt!) : a.dueDate.localeCompare(b.dueDate))),
    [groups, filter, company, indexes],
  );

  const total = sumMoney(rows.map((r) => r.amount));
  const lastReminder = (id: string) => db.reminders.find((r) => r.installmentId === id);

  const tabs: { value: Filter; label: string }[] = [
    { value: "pendientes", label: "Vencidas y de hoy" },
    { value: "hoy", label: "Vencen hoy" },
    { value: "mora", label: "En mora" },
    { value: "critica", label: `Mora +${CRITICAL_OVERDUE_DAYS}d` },
    { value: "reportado", label: "Por verificar" },
    { value: "proximos", label: "Próximos 30 días" },
    { value: "verificados", label: "Cobradas del mes" },
  ];

  return (
    <>
      <PageHeader
        title="Cobranza"
        subtitle="Mensual, trimestral, semestral y anual: todas tus cuotas con fechas exactas."
        actions={
          <Button
            variant="secondary"
            onClick={() =>
              exportCsv(
                [
                  ["Cliente", "Póliza", "Compañía", "Cuota", "Vencimiento", "Monto", "Estado", "Días de mora"],
                  ...rows.map((i) => {
                    const p = indexes.policyById.get(i.policyId)!;
                    return [indexes.clientById.get(p.clientId)?.name ?? "", p.number, indexes.companyName(p.companyId), `${i.sequence}/${i.totalInSchedule}`, i.dueDate, i.amount.toFixed(2), COLLECTION_STATE_LABEL[collectionState(i, today)], overdueDays(i, today)];
                  }),
                ],
                `cobranza-${filter}-${today}.csv`,
              )
            }
          >
            <Download className="size-4" /> Exportar
          </Button>
        }
      />

      {/* Protocol strip */}
      <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: "Recordatorio previo", sub: "Antes del vencimiento", tone: "text-primary" },
          { label: "Día de vencimiento", sub: "Mismo día", tone: "text-primary" },
          { label: "Recordatorio amable", sub: "1-7 días", tone: "text-tertiary" },
          { label: "Seguimiento firme", sub: "8-14 días", tone: "text-tertiary" },
          { label: "Escalamiento", sub: "+14 días · llamada", tone: "text-error" },
        ].map((s, i) => (
          <div key={s.label} className="rounded border border-outline-variant bg-surface-container-low px-3 py-2">
            <p className="num text-[10px] text-outline">PASO {i + 1}</p>
            <p className={cn("text-body-sm font-semibold", s.tone)}>{s.label}</p>
            <p className="text-[11px] text-on-surface-variant">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 flex-1">
          <Tabs<Filter>
            value={filter}
            onChange={(f) => {
              setFilter(f);
              setPage(1);
            }}
            tabs={tabs.map((t) => ({ ...t, count: groups[t.value].length }))}
          />
        </div>
        <select value={company} onChange={(e) => { setCompany(e.target.value); setPage(1); }} className="input-base lg:!w-56" aria-label="Compañía">
          <option value="all">Todas las compañías</option>
          {db.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-outline-variant bg-surface-container px-4 py-2 text-body-sm">
          <span className="text-on-surface-variant">{rows.length} cuotas</span>
          <span>Total: <span className="num font-semibold">{formatMoney(total)}</span></span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-body-md">
            <thead className="bg-surface-container-lowest/60">
              <tr>
                <th className={TH}>Cliente / Póliza</th>
                <th className={TH}>Compañía</th>
                <th className={TH}>Cuota</th>
                <th className={TH}>Vencimiento</th>
                <th className={cn(TH, "text-right")}>Monto</th>
                <th className={TH}>Estado</th>
                <th className={TH}>{filter === "reportado" || filter === "verificados" ? "Pago" : "Protocolo"}</th>
                <th className={TH}></th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((inst) => {
                const p = indexes.policyById.get(inst.policyId)!;
                const c = indexes.clientById.get(p.clientId)!;
                const days = overdueDays(inst, today);
                const stage = protocolStage(inst, today);
                const last = lastReminder(inst.id);
                return (
                  <tr key={inst.id} className="border-t border-outline-variant/60 hover:bg-surface-container">
                    <td className={TD}>
                      <Link href={`/clientes/${c.id}`} className="font-semibold hover:text-primary">{c.name}</Link>
                      <p className="num text-xs text-on-surface-variant">{p.number} · {p.product}</p>
                    </td>
                    <td className={cn(TD, "text-on-surface-variant")}>{indexes.companyName(p.companyId)}</td>
                    <td className={cn(TD, "num text-on-surface-variant")}>{inst.sequence}/{inst.totalInSchedule}</td>
                    <td className={cn(TD, "num whitespace-nowrap", days > 0 && "text-error")}>{formatDate(inst.dueDate)}</td>
                    <td className={cn(TD, "num text-right font-semibold")}>{formatMoney(inst.amount)}</td>
                    <td className={TD}><CollectionBadge state={collectionState(inst, today)} days={days} /></td>
                    <td className={cn(TD, "text-xs")}>
                      {inst.status === "pendiente" ? (
                        <>
                          <p className={cn(stage.key === "escalamiento" ? "text-error" : stage.key === "firme" ? "text-tertiary" : "text-on-surface-variant")}>{stage.label}</p>
                          {last && <p className="text-outline">Último aviso: {formatDate(last.sentAt)}</p>}
                        </>
                      ) : (
                        <p className="text-on-surface-variant">
                          {inst.method} · <span className="num">{inst.reference}</span>
                          <br />
                          <span className="text-outline">
                            {inst.status === "verificado" ? `Verificado ${formatDate(inst.verifiedAt)} · ${inst.verifiedBy}` : `Reportado ${formatDate(inst.reportedAt)}`}
                          </span>
                        </p>
                      )}
                    </td>
                    <td className={cn(TD, "whitespace-nowrap text-right")}>
                      {inst.status === "pendiente" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setReminder(inst)}>Recordar</Button>
                          <Button size="sm" variant="secondary" onClick={() => setPayment(inst)}>Registrar pago</Button>
                        </div>
                      )}
                      {inst.status === "reportado" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => run(api.rejectPayment(inst.id), "Pago rechazado: la cuota vuelve a pendiente")} title="Rechazar">
                            <Undo2 className="size-3.5" />
                          </Button>
                          <Button size="sm" variant="success" onClick={() => run(api.verifyPayment(inst.id, user?.name ?? ""), "Pago verificado")}>
                            <Check className="size-3.5" /> Verificar
                          </Button>
                        </div>
                      )}
                      {inst.status === "verificado" && <Badge tone="success">OK</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon={<CheckCircle2 />} title="Nada por aquí" detail="No hay cuotas en este estado." />}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
      </Card>

      <ReminderModal installment={reminder} onClose={() => setReminder(null)} />
      {payment && <PaymentModal installment={payment} onClose={() => setPayment(null)} />}
    </>
  );
}
