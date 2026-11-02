"use client";

import { Mail, MessageCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDb } from "@/context/DataContext";
import { formatDate } from "@/lib/domain/dates";
import { collectionMessage, mailtoLink, whatsappLink } from "@/lib/domain/messages";
import { formatMoney } from "@/lib/domain/money";
import { protocolStage } from "@/lib/domain/policies";
import type { Installment, PaymentMethod, ReminderChannel, ReminderLog } from "@/lib/domain/types";
import { Badge, Button, Field, Modal } from "./ui/primitives";

const METHODS: PaymentMethod[] = ["Transferencia", "Pago Móvil", "Zelle", "Efectivo", "Domiciliación"];

/** Opens a prefilled WhatsApp or email and logs the contact in the mock backend. */
export function SendMessageModal({
  open,
  onClose,
  title,
  clientId,
  installmentId = null,
  kind,
  initialMessage,
  subject,
  phone,
  email,
  header,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  clientId: string;
  installmentId?: string | null;
  kind: ReminderLog["kind"];
  initialMessage: string;
  subject: string;
  phone: string;
  email: string;
  header?: React.ReactNode;
}) {
  const { run, api } = useDb();
  const { user } = useAuth();
  const [message, setMessage] = useState(initialMessage);

  async function send(channel: ReminderChannel) {
    const url = channel === "whatsapp" ? whatsappLink(phone, message) : mailtoLink(email, subject, message);
    window.open(url, "_blank", "noopener");
    await run(
      api.logReminder({ clientId, installmentId, channel, kind, message, sentBy: user?.name ?? "" }),
      channel === "whatsapp" ? "Mensaje de WhatsApp preparado y registrado" : "Correo preparado y registrado",
    );
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={() => send("email")} disabled={!email}>
            <Mail className="size-4" /> Correo
          </Button>
          <Button variant="success" onClick={() => send("whatsapp")} disabled={!phone}>
            <MessageCircle className="size-4" /> WhatsApp
          </Button>
        </>
      }
    >
      {header}
      <Field label="Mensaje" hint="Puedes editarlo antes de enviarlo. Se abrirá WhatsApp o tu cliente de correo.">
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="input-base resize-y" />
      </Field>
      <p className="mt-3 num text-xs text-on-surface-variant">
        {phone} · {email}
      </p>
    </Modal>
  );
}

export function ReminderModal({ installment, onClose }: { installment: Installment | null; onClose: () => void }) {
  const { db, indexes, today } = useDb();
  if (!installment) return null;
  const policy = indexes.policyById.get(installment.policyId)!;
  const client = indexes.clientById.get(policy.clientId)!;
  const stage = protocolStage(installment, today);
  const message = collectionMessage(stage, client, policy, installment, indexes.companyName(policy.companyId), db.settings.brokerName);
  const previous = db.reminders.filter((r) => r.installmentId === installment.id);

  return (
    <SendMessageModal
      key={installment.id}
      open
      onClose={onClose}
      title={`Recordatorio de cobro · ${client.name}`}
      clientId={client.id}
      installmentId={installment.id}
      kind="cobranza"
      initialMessage={message}
      subject={`Recordatorio de pago · Póliza ${policy.number}`}
      phone={client.phone}
      email={client.email}
      header={
        <div className="mb-4 rounded border border-outline-variant bg-surface-container-low p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-body-sm text-on-surface-variant">Protocolo de cobranza</p>
            <Badge tone={stage.key === "escalamiento" ? "danger" : stage.key === "firme" ? "warning" : "info"}>{stage.label}</Badge>
          </div>
          <p className="mt-1 text-body-sm text-outline">{stage.description}</p>
          <p className="mt-2 num text-xs text-on-surface-variant">
            Cuota {installment.sequence}/{installment.totalInSchedule} · {formatMoney(installment.amount)} · vence {formatDate(installment.dueDate)}
          </p>
          {previous.length > 0 && (
            <p className="mt-2 text-xs text-tertiary">
              {previous.length} recordatorio(s) previo(s); último el {formatDate(previous[0].sentAt)} por {previous[0].channel === "whatsapp" ? "WhatsApp" : "correo"}.
            </p>
          )}
        </div>
      }
    />
  );
}

export function PaymentModal({ installment, onClose }: { installment: Installment | null; onClose: () => void }) {
  const { indexes, run, api, today } = useDb();
  const [method, setMethod] = useState<PaymentMethod>("Transferencia");
  const [reference, setReference] = useState("");
  const [date, setDate] = useState(today);

  if (!installment) return null;
  const policy = indexes.policyById.get(installment.policyId)!;
  const client = indexes.clientById.get(policy.clientId)!;

  async function submit() {
    await run(api.reportPayment(installment!.id, { method, reference, date }), "Pago registrado. Queda pendiente de verificación.");
    setReference("");
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Registrar pago reportado"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={!reference.trim() || date > today}>Registrar pago</Button>
        </>
      }
    >
      <div className="mb-4 rounded border border-outline-variant bg-surface-container-low p-3">
        <p className="font-semibold">{client.name}</p>
        <p className="num text-xs text-on-surface-variant">
          {policy.number} · Cuota {installment.sequence}/{installment.totalInSchedule} · vence {formatDate(installment.dueDate)}
        </p>
        <p className="mt-2 num text-headline-sm text-on-surface">{formatMoney(installment.amount)}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Método de pago">
          <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="input-base">
            {METHODS.map((m) => <option key={m}>{m}</option>)}
          </select>
        </Field>
        <Field label="Fecha del pago">
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="input-base" />
        </Field>
        <Field label="Referencia / comprobante" className="sm:col-span-2">
          <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N° de referencia" className="input-base num" />
        </Field>
      </div>
      <p className="mt-3 text-xs text-outline">
        El pago queda como &quot;Por verificar&quot; hasta confirmarlo con la compañía.
      </p>
    </Modal>
  );
}
