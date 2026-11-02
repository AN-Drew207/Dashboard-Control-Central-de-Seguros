"use client";

import { ArrowLeft, Lightbulb, Mail, Pencil, Phone, Plus, ShieldPlus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ClientFormModal } from "@/components/ClientFormModal";
import { SendMessageModal } from "@/components/collections";
import { PolicyDetail, PolicyStatusBadge } from "@/components/PolicyDetail";
import { Badge, Button, Card, cn, EmptyState, Initials, Tabs, TD, TH } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { useInitialQueryParam } from "@/lib/browser";
import { ageOn, formatDate, formatDateLong, nextBirthday, diffDays } from "@/lib/domain/dates";
import { crossSellOpportunities } from "@/lib/domain/insights";
import { crossSellMessage } from "@/lib/domain/messages";
import { formatMoney, sumMoney } from "@/lib/domain/money";
import { FREQUENCY_LABEL, overdueDays, POLICY_TYPE_LABEL } from "@/lib/domain/policies";

type Tab = "asegurados" | "historico" | "notas" | "polizas";

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { db, indexes, today, run, api } = useDb();
  const { user } = useAuth();
  const [tab, setTab] = useInitialQueryParam<Tab>("tab", "polizas");
  const [editing, setEditing] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [offer, setOffer] = useState(false);

  const client = indexes.clientById.get(id);
  const policies = useMemo(
    () => db.policies.filter((p) => p.clientId === id).sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [db, id],
  );
  const opportunity = useMemo(() => crossSellOpportunities(db).find((o) => o.client.id === id), [db, id]);

  if (!client) {
    return <EmptyState title="Cliente no encontrado" detail="Puede que haya sido eliminado o el enlace no sea válido." />;
  }

  const active = policies.filter((p) => p.status === "activa");
  const policyIds = new Set(policies.map((p) => p.id));
  const installments = db.installments.filter((i) => policyIds.has(i.policyId));
  const nextDue = installments.filter((i) => i.status === "pendiente").sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const overdue = installments.filter((i) => overdueDays(i, today) > 0);
  const insured = active.flatMap((p) => p.insured.map((i) => ({ ...i, policy: p })));
  const reminders = db.reminders.filter((r) => r.clientId === client.id);

  const summary = active.length
    ? `Tiene ${active.length} póliza(s) activa(s): ${active
        .map((p) => `${p.product.toLowerCase()} ${POLICY_TYPE_LABEL[p.policyType].toLowerCase()} con ${indexes.companyName(p.companyId)} (${formatMoney(p.sumInsured)} de cobertura)`)
        .join("; ")}.`
    : "No tiene pólizas activas.";

  return (
    <>
      <Link href="/clientes" className="mb-4 inline-flex items-center gap-1 text-body-sm text-on-surface-variant hover:text-primary">
        <ArrowLeft className="size-4" /> Cartera de clientes
      </Link>

      <Card className="mb-6">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start">
          <Initials name={client.name} className="size-16 text-xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-headline-md sm:text-display-lg">{client.name}</h2>
              {client.vip && <Badge tone="info">VIP</Badge>}
              {overdue.length > 0 && <Badge tone="warning">{overdue.length} cuota(s) en mora</Badge>}
            </div>
            <p className="num mt-1 text-xs text-on-surface-variant">{client.documentId} · Cliente desde {formatDate(client.createdAt)}</p>
            <p className="mt-3 max-w-3xl text-body-md text-on-surface">{summary}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-on-surface-variant">
              {nextDue && (
                <span>
                  Próximo pago: <span className="num text-on-surface">{formatMoney(nextDue.amount)}</span> el{" "}
                  <span className="num text-on-surface">{formatDate(nextDue.dueDate)}</span>
                </span>
              )}
              {active[0] && <span>Frecuencia: <span className="text-on-surface">{FREQUENCY_LABEL[active[0].frequency]}</span></span>}
              {client.birthDate && (
                <span>
                  Cumpleaños: <span className="text-on-surface">{formatDateLong(client.birthDate)}</span> ({ageOn(client.birthDate, today)} años
                  {(() => {
                    const d = diffDays(today, nextBirthday(client.birthDate, today));
                    return d === 0 ? " · ¡hoy!" : d <= 7 ? ` · en ${d} días` : "";
                  })()}
                  )
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 lg:flex-col">
            <Button variant="secondary" onClick={() => setEditing(true)}><Pencil className="size-4" /> Editar</Button>
            <a href={`tel:${client.phone.replace(/\s/g, "")}`} className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
              <Phone className="size-4" /> Llamar
            </a>
            <a href={`mailto:${client.email}`} className="inline-flex items-center justify-center gap-2 rounded border border-outline-variant px-4 py-2 text-sm font-semibold hover:bg-surface-container-high">
              <Mail className="size-4" /> Correo
            </a>
          </div>
        </div>
        {opportunity && (
          <div className="flex flex-col gap-3 border-t border-outline-variant bg-secondary/5 px-5 py-3 sm:flex-row sm:items-center">
            <Lightbulb className="size-5 shrink-0 text-secondary" />
            <p className="flex-1 text-body-sm">
              <span className="font-semibold text-secondary">Oportunidad:</span> tiene {opportunity.has.join(", ")}. Un plan de{" "}
              <span className="font-semibold">{opportunity.suggest}</span> complementa su protección.
            </p>
            <Button size="sm" variant="success" onClick={() => setOffer(true)}>Enviar propuesta</Button>
          </div>
        )}
      </Card>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "polizas", label: "Pólizas", count: policies.length },
          { value: "asegurados", label: "Datos de asegurados", count: insured.length },
          { value: "historico", label: "Histórico de contratos" },
          { value: "notas", label: "Notas adicionales", count: client.notes.length },
        ]}
      />

      <div className="mt-4">
        {tab === "polizas" && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Link href={`/polizas/nueva?cliente=${client.id}`} className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                <ShieldPlus className="size-4" /> Nueva póliza para este cliente
              </Link>
            </div>
            {active.map((p, i) => <PolicyDetail key={p.id} policy={p} defaultOpen={i === 0} />)}
            {active.length === 0 && <EmptyState title="Sin pólizas activas" />}
          </div>
        )}

        {tab === "asegurados" && (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body-md">
              <thead className="bg-surface-container">
                <tr>
                  <th className={TH}>Asegurado</th>
                  <th className={TH}>Parentesco</th>
                  <th className={TH}>Nacimiento</th>
                  <th className={cn(TH, "text-right")}>Edad</th>
                  <th className={TH}>Póliza</th>
                </tr>
              </thead>
              <tbody>
                {insured.map((i) => (
                  <tr key={i.id} className="border-t border-outline-variant/60">
                    <td className={TD}>{i.name}</td>
                    <td className={cn(TD, "text-on-surface-variant")}>{i.relationship}</td>
                    <td className={cn(TD, "num")}>{formatDate(i.birthDate)}</td>
                    <td className={cn(TD, "num text-right")}>{ageOn(i.birthDate, today)}</td>
                    <td className={cn(TD, "num text-xs text-on-surface-variant")}>{i.policy.product} · {i.policy.number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {insured.length === 0 && <EmptyState title="Sin asegurados registrados" />}
          </Card>
        )}

        {tab === "historico" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-body-md">
                <thead className="bg-surface-container">
                  <tr>
                    <th className={TH}>Póliza</th>
                    <th className={TH}>Vigencia</th>
                    <th className={TH}>Estado</th>
                    <th className={cn(TH, "text-right")}>Prima</th>
                    <th className={cn(TH, "text-right")}>Pagado</th>
                  </tr>
                </thead>
                <tbody>
                  {policies.map((p) => {
                    const paid = sumMoney(db.installments.filter((i) => i.policyId === p.id && i.status === "verificado").map((i) => i.amount));
                    return (
                      <tr key={p.id} className="border-t border-outline-variant/60">
                        <td className={TD}>
                          <p>{p.product} · {indexes.companyName(p.companyId)}</p>
                          <p className="num text-xs text-on-surface-variant">{p.number}</p>
                        </td>
                        <td className={cn(TD, "num text-xs")}>{formatDate(p.startDate)} → {formatDate(p.endDate)}</td>
                        <td className={TD}><PolicyStatusBadge policy={p} /></td>
                        <td className={cn(TD, "num text-right")}>{formatMoney(p.annualPremium)}</td>
                        <td className={cn(TD, "num text-right text-secondary")}>{formatMoney(paid)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
            <Card>
              <div className="border-b border-outline-variant px-4 py-3 font-semibold">Contactos registrados</div>
              <ul className="max-h-96 divide-y divide-outline-variant/60 overflow-y-auto">
                {reminders.map((r) => (
                  <li key={r.id} className="px-4 py-3 text-body-sm">
                    <div className="flex justify-between">
                      <Badge tone={r.kind === "cobranza" ? "warning" : r.kind === "cumpleanos" ? "success" : "info"}>{r.kind}</Badge>
                      <span className="num text-xs text-outline">{formatDate(r.sentAt)} · {r.channel}</span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-on-surface-variant">{r.message}</p>
                  </li>
                ))}
                {reminders.length === 0 && <li className="px-4 py-6 text-center text-body-sm text-outline">Sin contactos registrados.</li>}
              </ul>
            </Card>
          </div>
        )}

        {tab === "notas" && (
          <div className="flex max-w-3xl flex-col gap-4">
            <Card className="p-4">
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={3}
                placeholder="Detalles de vida del cliente, intereses, comentarios de la póliza..."
                className="input-base resize-y"
              />
              <div className="mt-2 flex justify-end">
                <Button
                  disabled={!noteText.trim()}
                  onClick={async () => {
                    await run(api.addNote(client.id, noteText.trim(), user?.name ?? ""), "Nota agregada");
                    setNoteText("");
                  }}
                >
                  <Plus className="size-4" /> Añadir nota
                </Button>
              </div>
            </Card>
            {client.notes.map((n) => (
              <blockquote key={n.id} className="rounded border border-outline-variant bg-surface-container-low p-4 text-body-md">
                {n.text}
                <footer className="mt-2 text-right text-xs text-outline">— {n.author} · {formatDate(n.createdAt)}</footer>
              </blockquote>
            ))}
          </div>
        )}
      </div>

      {policies.some((p) => p.status !== "activa") && tab === "polizas" && (
        <p className="mt-4 text-body-sm text-outline">
          Pólizas anuladas o renovadas: ver <button className="text-primary hover:underline cursor-pointer" onClick={() => setTab("historico")}>histórico de contratos</button>.
        </p>
      )}

      <ClientFormModal key={client.id + String(editing)} open={editing} onClose={() => setEditing(false)} client={client} />
      {opportunity && offer && (
        <SendMessageModal
          open
          onClose={() => setOffer(false)}
          title={`Propuesta de ${opportunity.suggest}`}
          clientId={client.id}
          kind="producto"
          initialMessage={crossSellMessage(client, opportunity.suggest, db.settings.brokerName)}
          subject={`Propuesta: plan de ${opportunity.suggest}`}
          phone={client.phone}
          email={client.email}
        />
      )}
    </>
  );
}
