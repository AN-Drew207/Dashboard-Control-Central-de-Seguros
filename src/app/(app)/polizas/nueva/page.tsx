"use client";

import { ArrowLeft, CalendarDays, Plus, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ClientFormModal } from "@/components/ClientFormModal";
import { RequirePermission } from "@/components/layout/AppShell";
import { Button, Card, CardHeader, cn, Field, TD, TH } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { ageOn, formatDate } from "@/lib/domain/dates";
import { formatMoney, percentOf } from "@/lib/domain/money";
import {
  buildSchedule,
  FREQUENCIES,
  FREQUENCY_LABEL,
  policyEndDate,
  POLICY_TYPE_LABEL,
  POLICY_TYPES,
  PRODUCTS,
} from "@/lib/domain/policies";
import type { Frequency, Insured, PolicyType, Product, Relationship } from "@/lib/domain/types";

type InsuredDraft = Omit<Insured, "id"> & { key: number };
const RELATIONSHIPS: Relationship[] = ["Titular", "Cónyuge", "Hijo(a)", "Padre/Madre", "Otro"];

function NewPolicyForm() {
  const { db, run, api, today } = useDb();
  const { can } = useAuth();
  const router = useRouter();

  const [clientId, setClientId] = useState("");
  const [companyId, setCompanyId] = useState(db.companies[0]?.id ?? "");
  const [product, setProduct] = useState<Product>("Salud");
  const [policyType, setPolicyType] = useState<PolicyType>("individual");
  const [frequency, setFrequency] = useState<Frequency>("mensual");
  const [startDate, setStartDate] = useState(today);
  const [annualPremium, setAnnualPremium] = useState("");
  const [sumInsured, setSumInsured] = useState("");
  const [commissionRate, setCommissionRate] = useState(String(db.companies[0]?.defaultCommissionRate ?? 15));
  const [number, setNumber] = useState("");
  const [coverage, setCoverage] = useState("");
  const [insured, setInsured] = useState<InsuredDraft[]>([]);
  const [newClient, setNewClient] = useState(false);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("cliente");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (preset) setClientId(preset);
  }, []);

  const client = db.clients.find((c) => c.id === clientId);

  // Prefill the holder as first insured when a person is selected.
  useEffect(() => {
    if (!client || client.kind !== "persona" || !client.birthDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInsured((list) =>
      list.some((i) => i.relationship === "Titular")
        ? list.map((i) => (i.relationship === "Titular" ? { ...i, name: client.name, birthDate: client.birthDate! } : i))
        : [{ key: Date.now(), name: client.name, relationship: "Titular", birthDate: client.birthDate! }, ...list],
    );
  }, [client]);

  const premium = Number(annualPremium);
  const schedule = useMemo(
    () => (premium > 0 && startDate ? buildSchedule(startDate, premium, frequency) : []),
    [premium, startDate, frequency],
  );

  const insuredValid = insured.every((i) => i.name.trim() && i.birthDate && i.birthDate <= today);
  const valid = client && companyId && premium > 0 && Number(sumInsured) > 0 && startDate && insuredValid && insured.length > 0;

  async function submit() {
    if (!valid) return;
    const { policy } = await run(
      api.createPolicy({
        clientId,
        companyId,
        product,
        policyType,
        frequency,
        startDate,
        annualPremium: Math.round(premium * 100) / 100,
        sumInsured: Number(sumInsured),
        commissionRate: Number(commissionRate),
        insured: insured.map(({ key: _k, ...rest }) => { void _k; return rest; }),
        coverage,
        number,
      }),
      "Póliza emitida y cronograma de cobro generado",
    );
    router.push(`/clientes/${policy.clientId}?tab=polizas`);
  }

  return (
    <>
      <Link href="/polizas" className="mb-4 inline-flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary">
        <ArrowLeft className="size-4" /> Pólizas
      </Link>
      <h2 className="mb-6 text-headline-md sm:text-display-lg">Nueva póliza</h2>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="1. Titular" />
            <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <Field label="Cliente" className="flex-1">
                <select value={clientId} onChange={(e) => setClientId(e.target.value)} className="input-base">
                  <option value="">Selecciona un cliente</option>
                  {[...db.clients].sort((a, b) => a.name.localeCompare(b.name)).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} · {c.documentId}</option>
                  ))}
                </select>
              </Field>
              <Button variant="secondary" onClick={() => setNewClient(true)}><UserPlus className="size-4" /> Cliente nuevo</Button>
            </div>
          </Card>

          <Card>
            <CardHeader title="2. Datos de la póliza" />
            <div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Compañía">
                <select
                  value={companyId}
                  onChange={(e) => {
                    setCompanyId(e.target.value);
                    const c = db.companies.find((x) => x.id === e.target.value);
                    if (c) setCommissionRate(String(c.defaultCommissionRate));
                  }}
                  className="input-base"
                >
                  {db.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Producto">
                <select value={product} onChange={(e) => setProduct(e.target.value as Product)} className="input-base">
                  {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Tipo de póliza">
                <select value={policyType} onChange={(e) => setPolicyType(e.target.value as PolicyType)} className="input-base">
                  {POLICY_TYPES.map((t) => <option key={t} value={t}>{POLICY_TYPE_LABEL[t]}</option>)}
                </select>
              </Field>
              <Field label="N° de póliza" hint="Déjalo vacío para generarlo automáticamente.">
                <input value={number} onChange={(e) => setNumber(e.target.value)} className="input-base num" placeholder="Automático" />
              </Field>
              <Field label="Inicio de vigencia" hint={startDate ? `Vence el ${formatDate(policyEndDate(startDate))}` : undefined}>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-base" />
              </Field>
              <Field label="Frecuencia de pago">
                <select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} className="input-base">
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>)}
                </select>
              </Field>
              <Field label="Prima anual (USD)">
                <input type="number" min="0" step="0.01" value={annualPremium} onChange={(e) => setAnnualPremium(e.target.value)} className="input-base num" placeholder="0.00" />
              </Field>
              <Field label="Suma asegurada (USD)">
                <input type="number" min="0" step="1000" value={sumInsured} onChange={(e) => setSumInsured(e.target.value)} className="input-base num" placeholder="0" />
              </Field>
              <Field label="Comisión (%)" hint={can("viewFinancials") && premium > 0 ? `${formatMoney(percentOf(premium, Number(commissionRate)))} al año` : undefined}>
                <input type="number" min="0" max="100" step="0.5" value={commissionRate} onChange={(e) => setCommissionRate(e.target.value)} className="input-base num" />
              </Field>
              <Field label="Cobertura contratada / condiciones relevantes" className="sm:col-span-2 lg:col-span-3">
                <textarea value={coverage} onChange={(e) => setCoverage(e.target.value)} rows={3} className="input-base resize-y" placeholder="Ej: hospitalización, maternidad, deducible, exclusiones, carencias..." />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="3. Asegurados"
              action={
                <Button size="sm" variant="ghost" onClick={() => setInsured((l) => [...l, { key: Date.now(), name: "", relationship: l.length ? "Hijo(a)" : "Titular", birthDate: "" }])}>
                  <Plus className="size-3.5" /> Agregar
                </Button>
              }
            />
            <div className="flex flex-col gap-3 p-4">
              {insured.length === 0 && <p className="text-body-sm text-outline">Agrega al menos un asegurado. Las fechas de nacimiento activan las felicitaciones automáticas.</p>}
              {insured.map((ins, idx) => (
                <div key={ins.key} className="grid items-end gap-3 rounded border border-outline-variant p-3 sm:grid-cols-[1fr_150px_160px_auto]">
                  <Field label="Nombre">
                    <input value={ins.name} onChange={(e) => setInsured((l) => l.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))} className="input-base" />
                  </Field>
                  <Field label="Parentesco">
                    <select value={ins.relationship} onChange={(e) => setInsured((l) => l.map((x, i) => (i === idx ? { ...x, relationship: e.target.value as Relationship } : x)))} className="input-base">
                      {RELATIONSHIPS.map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label={ins.birthDate ? `Nacimiento · ${ageOn(ins.birthDate, today)} años` : "Nacimiento"}>
                    <input type="date" max={today} value={ins.birthDate} onChange={(e) => setInsured((l) => l.map((x, i) => (i === idx ? { ...x, birthDate: e.target.value } : x)))} className="input-base" />
                  </Field>
                  <button onClick={() => setInsured((l) => l.filter((_, i) => i !== idx))} className="mb-2 p-1 text-outline hover:text-error cursor-pointer" aria-label="Quitar asegurado">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
          <Card>
            <CardHeader icon={<CalendarDays />} title="Cronograma de cobro" />
            <div className="max-h-[420px] overflow-y-auto">
              {schedule.length === 0 ? (
                <p className="px-4 py-8 text-center text-body-sm text-outline">Ingresa la prima anual y la fecha de inicio para ver las cuotas exactas.</p>
              ) : (
                <table className="w-full text-body-sm">
                  <thead className="sticky top-0 bg-surface-container">
                    <tr>
                      <th className={TH}>#</th>
                      <th className={TH}>Vencimiento</th>
                      <th className={cn(TH, "text-right")}>Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((s) => (
                      <tr key={s.sequence} className="border-t border-outline-variant/60">
                        <td className={cn(TD, "num text-on-surface-variant")}>{s.sequence}</td>
                        <td className={cn(TD, "num")}>{formatDate(s.dueDate)}</td>
                        <td className={cn(TD, "num text-right")}>{formatMoney(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-outline-variant bg-surface-container">
                      <td className={TD} colSpan={2}>Total</td>
                      <td className={cn(TD, "num text-right font-semibold")}>{formatMoney(premium)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </Card>
          <Button onClick={submit} disabled={!valid} className="w-full py-3">Emitir póliza</Button>
          {!valid && <p className="text-center text-xs text-outline">Completa titular, prima, suma asegurada y asegurados.</p>}
        </div>
      </div>

      <ClientFormModal open={newClient} onClose={() => setNewClient(false)} onSaved={(c) => setClientId(c.id)} />
    </>
  );
}

export default function NewPolicyPage() {
  return (
    <RequirePermission permission="managePolicies">
      <NewPolicyForm />
    </RequirePermission>
  );
}
