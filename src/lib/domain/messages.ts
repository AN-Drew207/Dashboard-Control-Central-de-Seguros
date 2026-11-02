import { formatDate } from "./dates";
import { formatMoney } from "./money";
import type { ProtocolStage } from "./policies";
import type { Client, Installment, Policy } from "./types";

function firstName(client: Client): string {
  return client.kind === "empresa" ? client.name : client.name.split(" ")[0];
}

export function collectionMessage(
  stage: ProtocolStage,
  client: Client,
  policy: Policy,
  inst: Installment,
  companyName: string,
  brokerName: string,
): string {
  const base = `póliza ${policy.number} (${policy.product}, ${companyName}) por ${formatMoney(inst.amount)} con vencimiento ${formatDate(inst.dueDate)}`;
  switch (stage.key) {
    case "previo":
      return `Hola ${firstName(client)}, ¿cómo estás? Te recuerdo que se acerca el pago de tu ${base}. Cualquier duda estoy a la orden. Saludos, ${brokerName}.`;
    case "dia":
      return `Hola ${firstName(client)}, hoy vence el pago de tu ${base}. Cuando lo realices, envíame el comprobante para registrarlo. ¡Gracias! ${brokerName}.`;
    case "amable":
      return `Hola ${firstName(client)}, espero que estés muy bien. Aún no tengo registrado el pago de tu ${base}. ¿Me confirmas si ya lo realizaste? Así mantenemos tu cobertura al día. ${brokerName}.`;
    case "firme":
      return `Estimado(a) ${client.name}: el pago de su ${base} presenta más de una semana de atraso. Le agradezco regularizarlo a la brevedad para evitar la suspensión de la cobertura. ${brokerName}.`;
    case "escalamiento":
      return `Estimado(a) ${client.name}: su ${base} supera los 14 días de mora y la cobertura está en riesgo de suspensión por parte de la compañía. Por favor comuníquese conmigo hoy mismo. ${brokerName}.`;
  }
}

export function birthdayMessage(name: string, brokerName: string): string {
  return `¡Feliz cumpleaños, ${name.split(" ")[0]}! 🎉 Te deseo un año lleno de salud y bendiciones. Gracias por confiar en nosotros. Un abrazo, ${brokerName}.`;
}

export function crossSellMessage(client: Client, product: string, brokerName: string): string {
  return `Hola ${firstName(client)}, ¿cómo estás? Revisando tu cartera de protección vi una oportunidad: un plan de ${product} complementaría muy bien lo que ya tienes. ¿Te parece si te envío una cotización sin compromiso? ${brokerName}.`;
}

export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export function mailtoLink(email: string, subject: string, body: string): string {
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
