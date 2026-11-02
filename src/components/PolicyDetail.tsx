"use client";

import { ChevronDown, FileUp, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { ageOn, formatDate } from "@/lib/domain/dates";
import { formatMoney, percentOf } from "@/lib/domain/money";
import {
  collectionState,
  FREQUENCY_LABEL,
  overdueDays,
  POLICY_STATUS_LABEL,
  POLICY_TYPE_LABEL,
} from "@/lib/domain/policies";
import type { Installment, Policy, PolicyDocument } from "@/lib/domain/types";
import { PaymentModal, ReminderModal } from "./collections";
import { Badge, Button, CollectionBadge, cn, Field, Modal, TD, TH } from "./ui/primitives";

const STATUS_TONE = { activa: "success", anulada: "danger", renovada: "info", vencida: "neutral" } as const;

export function PolicyStatusBadge({ policy }: { policy: Policy }) {
  return <Badge tone={STATUS_TONE[policy.status]}>{POLICY_STATUS_LABEL[policy.status]}</Badge>;
}

export function PolicyDetail({ policy, defaultOpen = false }: { policy: Policy; defaultOpen?: boolean }) {
  const { db, indexes, run, api, today } = useDb();
  const { can } = useAuth();
  const [open, setOpen] = useState(defaultOpen);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reminder, setReminder] = useState<Installment | null>(null);
  const [payment, setPayment] = useState<Installment | null>(null);
  const [docKind, setDocKind] = useState<PolicyDocument["kind"]>("poliza");
  const fileRef = useRef<HTMLInputElement>(null);

  const installments = db.installments
    .filter((i) => i.policyId === policy.id)
    .sort((a, b) => a.sequence - b.sequence);
  const paid = installments.filter((i) => i.status === "verificado").length;

  async function upload(file: File) {
    await run(api.addDocument(policy.id, { name: file.name, sizeBytes: file.size, kind: docKind }), "Documento adjuntado");
  }

  return (
    <div className="rounded border border-outline-variant bg-surface-container-low">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-4 text-left cursor-pointer">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-on-surface">{policy.product} · {POLICY_TYPE_LABEL[policy.policyType]}</p>
            <PolicyStatusBadge policy={policy} />
            {policy.isRenewal && <Badge>Renovación</Badge>}
          </div>
          <p className="num mt-0.5 text-xs text-on-surface-variant">
            {policy.number} · {indexes.companyName(policy.companyId)} · {formatDate(policy.startDate)} → {formatDate(policy.endDate)}
          </p>
        </div>
        <div className="text-right">
          <p className="num font-semibold">{formatMoney(policy.annualPremium)}</p>
          <p className="text-xs text-on-surface-variant">{FREQUENCY_LABEL[policy.frequency]} · {paid}/{installments.length} pagadas</p>
        </div>
        <ChevronDown className={cn("size-5 text-outline transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="border-t border-outline-variant p-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-body-sm lg:col-span-1">
              <dt className="text-on-surface-variant">Suma asegurada</dt><dd className="num text-right">{formatMoney(policy.sumInsured)}</dd>
              <dt className="text-on-surface-variant">Prima anual</dt><dd className="num text-right">{formatMoney(policy.annualPremium)}</dd>
              {can("viewFinancials") && (
                <>
                  <dt className="text-on-surface-variant">Comisión</dt>
                  <dd className="num text-right">{policy.commissionRate}% · {formatMoney(percentOf(policy.annualPremium, policy.commissionRate))}</dd>
                </>
              )}
              <dt className="text-on-surface-variant">Frecuencia</dt><dd className="text-right">{FREQUENCY_LABEL[policy.frequency]}</dd>
              {policy.cancelledAt && (
                <>
                  <dt className="text-error">Anulada</dt>
                  <dd className="text-right text-error">{formatDate(policy.cancelledAt)}</dd>
                  <dt className="text-on-surface-variant">Motivo</dt><dd className="text-right">{policy.cancelReason}</dd>
                </>
              )}
            </dl>
            <div className="lg:col-span-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Cobertura contratada</p>
              <p className="text-body-sm text-on-surface">{policy.coverage || "—"}</p>
              <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Asegurados</p>
              <ul className="flex flex-wrap gap-2">
                {policy.insured.map((i) => (
                  <li key={i.id} className="rounded border border-outline-variant px-2 py-1 text-xs">
                    {i.name} <span className="text-outline">· {i.relationship} · {ageOn(i.birthDate, today)} años</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Schedule */}
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Cronograma de cobro</p>
          <div className="overflow-x-auto rounded border border-outline-variant">
            <table className="w-full min-w-[600px] text-body-sm">
              <thead className="bg-surface-container">
                <tr>
                  <th className={TH}>#</th>
                  <th className={TH}>Vencimiento</th>
                  <th className={cn(TH, "text-right")}>Monto</th>
                  <th className={TH}>Estado</th>
                  <th className={TH}>Pago</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody>
                {installments.map((i) => (
                  <tr key={i.id} className="border-t border-outline-variant/60">
                    <td className={cn(TD, "num text-on-surface-variant")}>{i.sequence}/{i.totalInSchedule}</td>
                    <td className={cn(TD, "num")}>{formatDate(i.dueDate)}</td>
                    <td className={cn(TD, "num text-right")}>{formatMoney(i.amount)}</td>
                    <td className={TD}><CollectionBadge state={collectionState(i, today)} days={overdueDays(i, today)} /></td>
                    <td className={cn(TD, "text-xs text-on-surface-variant")}>
                      {i.method ? `${i.method} · ${i.reference} · ${formatDate(i.reportedAt)}` : "—"}
                    </td>
                    <td className={cn(TD, "text-right")}>
                      {i.status === "pendiente" && policy.status === "activa" && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setReminder(i)}>Recordar</Button>
                          <Button size="sm" variant="secondary" onClick={() => setPayment(i)}>Pagó</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {installments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-4 text-center text-outline">Sin cuotas.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Documents */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Documentos (póliza y condicionado)</p>
            <div className="flex items-center gap-2">
              <select value={docKind} onChange={(e) => setDocKind(e.target.value as PolicyDocument["kind"])} className="input-base !w-auto !py-1 text-xs">
                <option value="poliza">Póliza</option>
                <option value="condicionado">Condicionado</option>
                <option value="anexo">Anexo</option>
              </select>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.png,.doc,.docx" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
                <FileUp className="size-3.5" /> Adjuntar
              </Button>
            </div>
          </div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {policy.documents.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded border border-outline-variant p-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded bg-error/10 text-[9px] font-bold text-error">PDF</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm">{d.name}</p>
                  <p className="text-[11px] text-outline">{d.kind} · {(d.sizeBytes / 1024).toFixed(0)} KB · {formatDate(d.uploadedAt)}</p>
                </div>
                <button onClick={() => run(api.removeDocument(policy.id, d.id), "Documento eliminado")} className="p-1 text-outline hover:text-error cursor-pointer" aria-label="Eliminar documento">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
            {policy.documents.length === 0 && <li className="text-body-sm text-outline">Sin documentos. En la demo se guarda solo el nombre y tamaño del archivo.</li>}
          </ul>

          {policy.status === "activa" && can("managePolicies") && (
            <div className="mt-6 flex justify-end">
              <Button variant="danger" size="sm" onClick={() => setCancelOpen(true)}>Anular póliza</Button>
            </div>
          )}
        </div>
      )}

      <ReminderModal installment={reminder} onClose={() => setReminder(null)} />
      {payment && <PaymentModal installment={payment} onClose={() => setPayment(null)} />}
      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        title={`Anular póliza ${policy.number}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>Volver</Button>
            <Button
              variant="danger"
              disabled={!reason.trim()}
              onClick={async () => {
                await run(api.cancelPolicy(policy.id, reason.trim()), "Póliza anulada");
                setCancelOpen(false);
              }}
            >
              Confirmar anulación
            </Button>
          </>
        }
      >
        <p className="mb-4 text-body-md text-on-surface-variant">
          La póliza saldrá de la cartera activa y sus cuotas pendientes dejarán de cobrarse. Los pagos ya verificados se conservan.
        </p>
        <Field label="Motivo de anulación">
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="input-base">
            <option value="">Selecciona un motivo</option>
            <option>Falta de pago</option>
            <option>Cliente migró a otra compañía</option>
            <option>Precio / ajuste de presupuesto</option>
            <option>Venta del bien asegurado</option>
            <option>Insatisfacción con el servicio</option>
            <option>Otro</option>
          </select>
        </Field>
      </Modal>
    </div>
  );
}
