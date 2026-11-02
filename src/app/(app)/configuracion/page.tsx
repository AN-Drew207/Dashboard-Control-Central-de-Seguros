"use client";

import { Building2, Database, Plus, RotateCcw, Target } from "lucide-react";
import { useState } from "react";
import { RequirePermission } from "@/components/layout/AppShell";
import { Button, Card, CardHeader, cn, Field, Modal, PageHeader, TD, TH } from "@/components/ui/primitives";
import { useDb } from "@/context/DataContext";

function SettingsView() {
  const { db, run, api } = useDb();
  const [brokerName, setBrokerName] = useState(db.settings.brokerName);
  const [goal, setGoal] = useState(String(db.settings.monthlyEmissionGoal));
  const [confirmReset, setConfirmReset] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", shortName: "", rate: "15" });

  return (
    <>
      <PageHeader title="Configuración" subtitle="Ajusta la herramienta a tu cartera." />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader icon={<Target />} title="Perfil y metas" />
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field label="Nombre del corredor" hint="Se usa como firma en los mensajes a clientes.">
              <input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} className="input-base" />
            </Field>
            <Field label="Meta mensual de emisiones (pólizas)" hint="Recibirás una notificación al superarla.">
              <input type="number" min="1" value={goal} onChange={(e) => setGoal(e.target.value)} className="input-base num" />
            </Field>
            <div className="sm:col-span-2 flex justify-end">
              <Button
                disabled={!brokerName.trim() || Number(goal) < 1}
                onClick={() => run(api.updateSettings({ brokerName: brokerName.trim(), monthlyEmissionGoal: Number(goal) }), "Configuración guardada")}
              >
                Guardar
              </Button>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader icon={<Database />} title="Datos de la demo" />
          <div className="p-4 text-body-md text-on-surface-variant">
            <p>
              Todo se guarda en el <span className="text-on-surface">localStorage</span> de este navegador: {db.clients.length} clientes,{" "}
              {db.policies.length} pólizas, {db.installments.length} cuotas y {db.reminders.length} contactos registrados.
            </p>
            <p className="mt-2">Restablecer genera de nuevo la cartera de ejemplo con fechas relativas a hoy.</p>
            <div className="mt-4 flex justify-end">
              <Button variant="danger" onClick={() => setConfirmReset(true)}>
                <RotateCcw className="size-4" /> Restablecer datos demo
              </Button>
            </div>
          </div>
        </Card>

        <Card className="overflow-hidden xl:col-span-2">
          <CardHeader icon={<Building2 />} title="Compañías aseguradoras y comisiones" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-body-md">
              <thead className="bg-surface-container-lowest/60">
                <tr>
                  <th className={TH}>Compañía</th>
                  <th className={TH}>Siglas</th>
                  <th className={cn(TH, "text-right")}>Comisión por defecto (%)</th>
                  <th className={cn(TH, "text-right")}>Pólizas</th>
                </tr>
              </thead>
              <tbody>
                {db.companies.map((c) => (
                  <tr key={c.id} className="border-t border-outline-variant/60">
                    <td className={TD}>{c.name}</td>
                    <td className={cn(TD, "num text-on-surface-variant")}>{c.shortName}</td>
                    <td className={cn(TD, "text-right")}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        defaultValue={c.defaultCommissionRate}
                        onBlur={(e) => {
                          const v = Number(e.target.value);
                          if (v !== c.defaultCommissionRate && v >= 0 && v <= 100) {
                            run(api.updateCompany(c.id, { defaultCommissionRate: v }), `Comisión de ${c.shortName} actualizada`);
                          }
                        }}
                        className="input-base num !w-24 text-right"
                        aria-label={`Comisión ${c.name}`}
                      />
                    </td>
                    <td className={cn(TD, "num text-right")}>{db.policies.filter((p) => p.companyId === c.id && p.status === "activa").length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 border-t border-outline-variant p-4 sm:grid-cols-[1fr_120px_120px_auto] sm:items-end">
            <Field label="Nueva compañía">
              <input value={newCompany.name} onChange={(e) => setNewCompany((s) => ({ ...s, name: e.target.value }))} className="input-base" placeholder="Nombre" />
            </Field>
            <Field label="Siglas">
              <input value={newCompany.shortName} maxLength={4} onChange={(e) => setNewCompany((s) => ({ ...s, shortName: e.target.value.toUpperCase() }))} className="input-base num" />
            </Field>
            <Field label="Comisión %">
              <input type="number" value={newCompany.rate} onChange={(e) => setNewCompany((s) => ({ ...s, rate: e.target.value }))} className="input-base num" />
            </Field>
            <Button
              disabled={!newCompany.name.trim() || !newCompany.shortName.trim()}
              onClick={async () => {
                await run(
                  api.addCompany({ name: newCompany.name.trim(), shortName: newCompany.shortName.trim(), defaultCommissionRate: Number(newCompany.rate) }),
                  "Compañía agregada",
                );
                setNewCompany({ name: "", shortName: "", rate: "15" });
              }}
            >
              <Plus className="size-4" /> Agregar
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="¿Restablecer datos de la demo?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmReset(false)}>Cancelar</Button>
            <Button
              variant="danger"
              onClick={async () => {
                await run(api.resetDatabase(), "Datos demo restablecidos");
                setConfirmReset(false);
              }}
            >
              Restablecer
            </Button>
          </>
        }
      >
        <p className="text-body-md text-on-surface-variant">Se perderán los clientes, pólizas y pagos que hayas registrado en esta demo.</p>
      </Modal>
    </>
  );
}

export default function SettingsPage() {
  return (
    <RequirePermission permission="manageSettings">
      <SettingsView />
    </RequirePermission>
  );
}
