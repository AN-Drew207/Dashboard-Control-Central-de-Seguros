"use client";

import { Download, FileText, Filter, NotebookPen, Plus, ShieldPlus, UserRound, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ClientFormModal } from "@/components/ClientFormModal";
import { Badge, Button, Card, cn, EmptyState, Initials, PageHeader, Pagination, TD, TH } from "@/components/ui/primitives";
import { useDb } from "@/context/DataContext";
import { exportCsv } from "@/lib/browser";
import { ageOn, formatDate, formatDateLong } from "@/lib/domain/dates";
import { formatMoney, sumMoney } from "@/lib/domain/money";
import { POLICY_TYPE_LABEL, POLICY_TYPES, overdueDays } from "@/lib/domain/policies";
import type { Client, PolicyType } from "@/lib/domain/types";

const PAGE_SIZE = 10;

export default function ClientsPage() {
  const { db, indexes, today } = useDb();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState<PolicyType | "all" | "vip" | "mora">("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return db.clients
      .map((c) => {
        const policies = db.policies.filter((p) => p.clientId === c.id);
        const active = policies.filter((p) => p.status === "activa");
        const overdue = db.installments.some(
          (i) => overdueDays(i, today) > 0 && active.some((p) => p.id === i.policyId),
        );
        return { client: c, policies, active, overdue, premium: sumMoney(active.map((p) => p.annualPremium)) };
      })
      .filter((r) => !term || r.client.name.toLowerCase().includes(term) || r.client.documentId.toLowerCase().includes(term))
      .filter((r) => {
        if (segment === "all") return true;
        if (segment === "vip") return r.client.vip;
        if (segment === "mora") return r.overdue;
        return r.active.some((p) => p.policyType === segment);
      })
      .sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [db, query, segment, today]);

  const visible = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = rows.find((r) => r.client.id === selectedId) ?? visible[0];

  return (
    <>
      <PageHeader
        title="Cartera de Clientes"
        subtitle="Gestión integral de titulares y pólizas activas."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() =>
                exportCsv(
                  [
                    ["Titular", "Documento", "Teléfono", "Correo", "Nacimiento", "Pólizas activas", "Prima anual"],
                    ...rows.map((r) => [r.client.name, r.client.documentId, r.client.phone, r.client.email, r.client.birthDate ?? "", String(r.active.length), r.premium.toFixed(2)]),
                  ],
                  `cartera-${today}.csv`,
                )
              }
            >
              <Download className="size-4" /> Exportar
            </Button>
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" /> Nuevo cliente
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder="Filtrar por nombre o cédula/RIF..."
          className="input-base sm:max-w-sm"
        />
        <div className="relative sm:w-64">
          <Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-outline" />
          <select
            value={segment}
            onChange={(e) => {
              setSegment(e.target.value as typeof segment);
              setPage(1);
            }}
            className="input-base pl-9"
            aria-label="Segmentación"
          >
            <option value="all">Segmentación: todos</option>
            <option value="vip">Clientes VIP</option>
            <option value="mora">Con cuotas en mora</option>
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>Póliza {POLICY_TYPE_LABEL[t].toLowerCase()}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Card className="min-w-0 self-start overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-body-md">
              <thead className="bg-surface-container">
                <tr>
                  <th className={TH}>Titular</th>
                  <th className={TH}>Tipo de póliza</th>
                  <th className={TH}>Compañía</th>
                  <th className={cn(TH, "text-right")}>Prima anual</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const main = r.active[0] ?? r.policies[0];
                  const isSel = selected?.client.id === r.client.id;
                  return (
                    <tr
                      key={r.client.id}
                      onClick={() => setSelectedId(r.client.id)}
                      className={cn(
                        "cursor-pointer border-t border-outline-variant/60 transition-colors",
                        isSel ? "bg-primary-container/10 shadow-[inset_3px_0_0_var(--color-primary-container)]" : "hover:bg-surface-container",
                      )}
                    >
                      <td className={TD}>
                        <div className="flex items-center gap-2">
                          <span className="text-on-surface">{r.client.name}</span>
                          {r.client.vip && <Badge tone="info">VIP</Badge>}
                          {r.overdue && <Badge tone="warning">Mora</Badge>}
                        </div>
                        <p className="num text-xs text-on-surface-variant">{r.client.documentId}</p>
                      </td>
                      <td className={cn(TD, "text-on-surface-variant")}>
                        {main ? `${main.product} · ${POLICY_TYPE_LABEL[main.policyType]}` : "—"}
                        {r.active.length > 1 && <span className="ml-1 text-outline">+{r.active.length - 1}</span>}
                      </td>
                      <td className={TD}>
                        {main && (
                          <span className="flex items-center gap-2">
                            <span className="flex size-5 items-center justify-center rounded bg-surface-container-highest text-[10px] font-bold text-on-surface-variant">
                              {indexes.companyName(main.companyId)[0]}
                            </span>
                            {indexes.companyName(main.companyId)}
                          </span>
                        )}
                      </td>
                      <td className={cn(TD, "text-right num")}>{formatMoney(r.premium)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length === 0 && <EmptyState icon={<Users />} title="Sin resultados" detail="Prueba con otro filtro o registra un cliente nuevo." />}
          </div>
          <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
        </Card>

        {selected && <ClientSidePanel client={selected.client} />}
      </div>

      <ClientFormModal open={creating} onClose={() => setCreating(false)} onSaved={(c) => setSelectedId(c.id)} />
    </>
  );
}

function ClientSidePanel({ client }: { client: Client }) {
  const { db, today } = useDb();
  const policies = db.policies.filter((p) => p.clientId === client.id && p.status === "activa");
  const family = [...new Set(policies.flatMap((p) => p.insured.filter((i) => i.relationship !== "Titular").map((i) => i.relationship)))];
  const docs = policies.flatMap((p) => p.documents).slice(0, 3);
  const note = client.notes[0];

  return (
    <Card className="self-start">
      <div className="flex items-start gap-4 border-b border-outline-variant p-5">
        <Initials name={client.name} className="size-14 text-lg" />
        <div className="min-w-0">
          <h3 className="text-headline-sm">{client.name}</h3>
          <p className="num text-xs text-on-surface-variant">ID: {client.documentId}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {client.vip && <Badge tone="info">Cliente VIP</Badge>}
            <Badge>{policies.length} pólizas activas</Badge>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <UserRound className="size-4" /> Datos vitales
          </h4>
          <dl className="rounded border border-outline-variant bg-surface-container-lowest/50 p-3 text-body-md">
            {client.birthDate ? (
              <>
                <div className="flex justify-between py-1"><dt className="text-on-surface-variant">Cumpleaños</dt><dd>{formatDateLong(client.birthDate)}</dd></div>
                <div className="flex justify-between py-1"><dt className="text-on-surface-variant">Edad actual</dt><dd className="num">{ageOn(client.birthDate, today)} años</dd></div>
              </>
            ) : (
              <div className="flex justify-between py-1"><dt className="text-on-surface-variant">Tipo</dt><dd>Empresa</dd></div>
            )}
            <div className="flex justify-between py-1"><dt className="text-on-surface-variant">Grupo asegurado</dt><dd className="text-right">{family.length ? family.join(", ") : "Solo titular"}</dd></div>
            <div className="flex justify-between py-1"><dt className="text-on-surface-variant">Teléfono</dt><dd className="num text-xs">{client.phone}</dd></div>
          </dl>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <FileText className="size-4" /> Documentos adjuntos
          </h4>
          {docs.length === 0 && <p className="text-body-sm text-outline">Sin documentos.</p>}
          <ul className="flex flex-col gap-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center gap-3">
                <span className="flex size-8 items-center justify-center rounded bg-error/10 text-[9px] font-bold text-error">PDF</span>
                <div className="min-w-0">
                  <p className="truncate text-body-sm">{d.name}</p>
                  <p className="text-[11px] text-outline">{(d.sizeBytes / 1024 / 1024).toFixed(1)} MB · {formatDate(d.uploadedAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">
            <NotebookPen className="size-4" /> Notas comerciales
          </h4>
          {note ? (
            <blockquote className="rounded border border-outline-variant bg-surface-container-lowest/50 p-3 text-body-sm italic text-on-surface">
              &ldquo;{note.text}&rdquo;
              <footer className="mt-2 text-right text-[11px] not-italic text-outline">— {note.author} ({formatDate(note.createdAt)})</footer>
            </blockquote>
          ) : (
            <p className="text-body-sm text-outline">Sin notas todavía.</p>
          )}
        </section>

        <div className="flex gap-2">
          <Link href={`/clientes/${client.id}`} className="flex-1 rounded bg-primary py-2 text-center text-sm font-semibold text-on-primary">
            Ver ficha completa
          </Link>
          <Link href={`/polizas/nueva?cliente=${client.id}`} className="flex items-center gap-1 rounded border border-outline-variant px-3 py-2 text-sm font-semibold hover:bg-surface-container-high">
            <ShieldPlus className="size-4" /> Póliza
          </Link>
        </div>
      </div>
    </Card>
  );
}
