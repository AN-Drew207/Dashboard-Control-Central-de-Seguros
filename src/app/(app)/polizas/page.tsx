"use client";

import { Download, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PolicyStatusBadge } from "@/components/PolicyDetail";
import { Card, cn, EmptyState, PageHeader, Pagination, TD, TH } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { exportCsv } from "@/lib/browser";
import { formatDate } from "@/lib/domain/dates";
import { formatMoney, percentOf } from "@/lib/domain/money";
import { FREQUENCY_LABEL, POLICY_STATUS_LABEL, POLICY_TYPE_LABEL, PRODUCTS } from "@/lib/domain/policies";
import type { PolicyStatus } from "@/lib/domain/types";

const PAGE_SIZE = 12;

export default function PoliciesPage() {
  const { db, indexes, today } = useDb();
  const { can } = useAuth();
  const [query, setQuery] = useState("");
  const [company, setCompany] = useState("all");
  const [product, setProduct] = useState("all");
  const [status, setStatus] = useState<PolicyStatus | "all">("activa");
  const [page, setPage] = useState(1);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return db.policies
      .filter((p) => status === "all" || p.status === status)
      .filter((p) => company === "all" || p.companyId === company)
      .filter((p) => product === "all" || p.product === product)
      .filter((p) => {
        if (!term) return true;
        const c = indexes.clientById.get(p.clientId);
        return p.number.toLowerCase().includes(term) || c?.name.toLowerCase().includes(term);
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [db, indexes, query, company, product, status]);

  const reset = (fn: () => void) => {
    fn();
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Pólizas"
        subtitle="Todas tus pólizas, de todas las compañías, en un solo lugar."
        actions={
          <>
            <button
              className="inline-flex items-center gap-2 rounded border border-outline-variant bg-surface-container-high px-4 py-2 text-sm font-semibold hover:bg-surface-container-highest cursor-pointer"
              onClick={() =>
                exportCsv(
                  [
                    ["Número", "Cliente", "Compañía", "Producto", "Tipo", "Frecuencia", "Inicio", "Fin", "Prima anual", "Estado"],
                    ...rows.map((p) => [p.number, indexes.clientById.get(p.clientId)?.name ?? "", indexes.companyName(p.companyId), p.product, POLICY_TYPE_LABEL[p.policyType], FREQUENCY_LABEL[p.frequency], p.startDate, p.endDate, p.annualPremium.toFixed(2), POLICY_STATUS_LABEL[p.status]]),
                  ],
                  `polizas-${today}.csv`,
                )
              }
            >
              <Download className="size-4" /> Exportar
            </button>
            {can("managePolicies") && (
              <Link href="/polizas/nueva" className="inline-flex items-center gap-2 rounded bg-primary px-4 py-2 text-sm font-semibold text-on-primary">
                <Plus className="size-4" /> Nueva póliza
              </Link>
            )}
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input value={query} onChange={(e) => reset(() => setQuery(e.target.value))} placeholder="N° de póliza o cliente..." className="input-base" />
        <select value={company} onChange={(e) => reset(() => setCompany(e.target.value))} className="input-base" aria-label="Compañía">
          <option value="all">Todas las compañías</option>
          {db.companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={product} onChange={(e) => reset(() => setProduct(e.target.value))} className="input-base" aria-label="Producto">
          <option value="all">Todos los productos</option>
          {PRODUCTS.map((p) => <option key={p}>{p}</option>)}
        </select>
        <select value={status} onChange={(e) => reset(() => setStatus(e.target.value as PolicyStatus | "all"))} className="input-base" aria-label="Estado">
          <option value="all">Todos los estados</option>
          {Object.entries(POLICY_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-body-md">
            <thead className="bg-surface-container">
              <tr>
                <th className={TH}>Póliza / Cliente</th>
                <th className={TH}>Compañía</th>
                <th className={TH}>Producto</th>
                <th className={TH}>Frecuencia</th>
                <th className={TH}>Vigencia</th>
                <th className={cn(TH, "text-right")}>Prima anual</th>
                {can("viewFinancials") && <th className={cn(TH, "text-right")}>Comisión</th>}
                <th className={TH}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((p) => {
                const c = indexes.clientById.get(p.clientId);
                return (
                  <tr key={p.id} className="border-t border-outline-variant/60 hover:bg-surface-container">
                    <td className={TD}>
                      <Link href={`/clientes/${p.clientId}?tab=polizas`} className="font-semibold hover:text-primary">{c?.name}</Link>
                      <p className="num text-xs text-on-surface-variant">{p.number}</p>
                    </td>
                    <td className={cn(TD, "text-on-surface-variant")}>{indexes.companyName(p.companyId)}</td>
                    <td className={TD}>
                      {p.product}
                      <p className="text-xs text-outline">{POLICY_TYPE_LABEL[p.policyType]}</p>
                    </td>
                    <td className={cn(TD, "text-on-surface-variant")}>{FREQUENCY_LABEL[p.frequency]}</td>
                    <td className={cn(TD, "num whitespace-nowrap text-xs")}>{formatDate(p.startDate)} → {formatDate(p.endDate)}</td>
                    <td className={cn(TD, "num text-right")}>{formatMoney(p.annualPremium)}</td>
                    {can("viewFinancials") && (
                      <td className={cn(TD, "num text-right text-on-surface-variant")}>
                        {formatMoney(percentOf(p.annualPremium, p.commissionRate))}
                        <p className="text-[11px] text-outline">{p.commissionRate}%</p>
                      </td>
                    )}
                    <td className={TD}><PolicyStatusBadge policy={p} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 && <EmptyState icon={<FileText />} title="Sin pólizas con estos filtros" />}
        </div>
        <Pagination page={page} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />
      </Card>
    </>
  );
}
