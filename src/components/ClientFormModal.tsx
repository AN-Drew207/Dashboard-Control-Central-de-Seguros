"use client";

import { useState } from "react";
import { useDb } from "@/context/DataContext";
import type { Client, ClientKind } from "@/lib/domain/types";
import { Button, Field, Modal } from "./ui/primitives";

export function ClientFormModal({
  open,
  onClose,
  client,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  client?: Client;
  onSaved?: (client: Client) => void;
}) {
  const { run, api, today } = useDb();
  const [kind, setKind] = useState<ClientKind>(client?.kind ?? "persona");
  const [name, setName] = useState(client?.name ?? "");
  const [documentId, setDocumentId] = useState(client?.documentId ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "+58 ");
  const [birthDate, setBirthDate] = useState(client?.birthDate ?? "");
  const [vip, setVip] = useState(client?.vip ?? false);

  const valid = name.trim() && documentId.trim() && (kind === "empresa" || (birthDate && birthDate <= today));

  async function save() {
    const input = {
      kind,
      name: name.trim(),
      documentId: documentId.trim(),
      email: email.trim(),
      phone: phone.trim(),
      birthDate: kind === "persona" ? birthDate : null,
      vip,
    };
    if (client) {
      await run(api.updateClient(client.id, input), "Cliente actualizado");
      onSaved?.({ ...client, ...input });
    } else {
      const res = await run(api.createClient(input), "Cliente registrado");
      onSaved?.(res.client);
    }
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? "Editar cliente" : "Nuevo cliente"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={!valid}>Guardar</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo de cliente">
          <select value={kind} onChange={(e) => setKind(e.target.value as ClientKind)} className="input-base">
            <option value="persona">Persona natural</option>
            <option value="empresa">Empresa</option>
          </select>
        </Field>
        <Field label={kind === "empresa" ? "RIF" : "Cédula"}>
          <input value={documentId} onChange={(e) => setDocumentId(e.target.value)} placeholder={kind === "empresa" ? "J-12345678-9" : "V-12.345.678"} className="input-base num" />
        </Field>
        <Field label={kind === "empresa" ? "Razón social" : "Nombre completo"} className="sm:col-span-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="input-base" />
        </Field>
        <Field label="Teléfono (WhatsApp)">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="input-base num" />
        </Field>
        <Field label="Correo">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input-base" />
        </Field>
        {kind === "persona" && (
          <Field label="Fecha de nacimiento" hint="Se usa para felicitaciones y cálculo exacto de edad.">
            <input type="date" value={birthDate} max={today} onChange={(e) => setBirthDate(e.target.value)} className="input-base" />
          </Field>
        )}
        <label className="flex items-center gap-2 self-end pb-2 text-body-md text-on-surface-variant">
          <input type="checkbox" checked={vip} onChange={(e) => setVip(e.target.checked)} className="accent-primary-container" />
          Cliente VIP
        </label>
      </div>
    </Modal>
  );
}
