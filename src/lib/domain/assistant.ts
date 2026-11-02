/**
 * Demo assistant: answers portfolio questions with deterministic rules over the local data.
 * In production this is where an LLM would receive the same structured context
 * (metrics, client profile, attached policy conditions) and write the answer.
 */
import { ageOn, formatDate, MONTHS_LONG_ES, parts } from "./dates";
import { portfolioInsights } from "./insights";
import {
  dashboardMetrics,
  liveInstallments,
  monthlySeries,
  upcomingBirthdays,
  upcomingRenewals,
} from "./metrics";
import { formatMoney } from "./money";
import { FREQUENCY_LABEL, overdueDays, POLICY_TYPE_LABEL } from "./policies";
import type { Database, ISODate } from "./types";

export interface AssistantReply {
  text: string;
  links?: { label: string; href: string }[];
}

function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w));

export const SUGGESTED_QUESTIONS = [
  "¿Cómo va mi cartera este mes?",
  "¿Quiénes están en mora?",
  "¿Qué cumpleaños hay esta semana?",
  "¿Cuánto llevo en comisiones?",
  "Dame ideas para crecer mi cartera",
  "¿Cuáles son mis mejores meses?",
  "¿Qué renovaciones vienen?",
];

export function answerQuestion(db: Database, today: ISODate, question: string): AssistantReply {
  const q = normalize(question);
  const m = dashboardMetrics(db, today);
  const policyById = new Map(db.policies.map((p) => [p.id, p]));
  const clientById = new Map(db.clients.map((c) => [c.id, c]));
  const companyName = (id: string) => db.companies.find((c) => c.id === id)?.name ?? "";

  // A specific client mentioned by name (two consecutive words match).
  const client = db.clients.find((c) => {
    const words = normalize(c.name).split(" ");
    return words.some((w, i) => i < words.length - 1 && q.includes(`${w} ${words[i + 1]}`)) || q.includes(normalize(c.name));
  });

  if (client && has(q, "cubre", "cobertura", "condicionado", "preexist", "cubierto", "enfermedad", "cirugia")) {
    const policies = db.policies.filter((p) => p.clientId === client.id && p.status === "activa");
    if (policies.length === 0) return { text: `${client.name} no tiene pólizas activas.` };
    const lines = policies.map((p) => {
      const cond = p.documents.find((d) => d.kind === "condicionado");
      return `• ${p.product} (${companyName(p.companyId)}, ${p.number}) – suma asegurada ${formatMoney(p.sumInsured)}.\n  Cobertura registrada: ${p.coverage || "sin detalle"}\n  Condicionado: ${cond ? cond.name : "no adjuntado"}`;
    });
    return {
      text: `Esto es lo que tengo registrado de ${client.name}:\n\n${lines.join("\n\n")}\n\nNota de la demo: en la versión productiva el asistente leerá el PDF del condicionado adjunto para responder si una condición de salud específica tiene cobertura, citando la cláusula.`,
      links: [{ label: `Ver ficha de ${client.name}`, href: `/clientes/${client.id}?tab=polizas` }],
    };
  }

  if (client) {
    const policies = db.policies.filter((p) => p.clientId === client.id && p.status === "activa");
    const ids = new Set(policies.map((p) => p.id));
    const overdue = db.installments.filter((i) => ids.has(i.policyId) && overdueDays(i, today) > 0);
    const next = db.installments.filter((i) => ids.has(i.policyId) && i.status === "pendiente" && i.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const insured = policies.flatMap((p) => p.insured);
    return {
      text: [
        `${client.name} (${client.documentId})${client.birthDate ? `, ${ageOn(client.birthDate, today)} años` : ""}.`,
        `Pólizas activas: ${policies.map((p) => `${p.product} ${POLICY_TYPE_LABEL[p.policyType].toLowerCase()} con ${companyName(p.companyId)} – ${formatMoney(p.annualPremium)} ${FREQUENCY_LABEL[p.frequency].toLowerCase()}`).join("; ") || "ninguna"}.`,
        `Asegurados: ${insured.length}.`,
        overdue.length ? `⚠️ Tiene ${overdue.length} cuota(s) en mora por ${formatMoney(overdue.reduce((a, i) => a + i.amount, 0))}.` : "Está al día con sus pagos.",
        next ? `Próximo pago: ${formatMoney(next.amount)} el ${formatDate(next.dueDate)}.` : "",
        client.notes[0] ? `Última nota: “${client.notes[0].text}”` : "",
      ].filter(Boolean).join("\n"),
      links: [{ label: "Abrir ficha", href: `/clientes/${client.id}` }],
    };
  }

  if (has(q, "mora", "moroso", "atrasad", "deben", "vencid")) {
    const overdue = liveInstallments(db)
      .filter((i) => overdueDays(i, today) > 0)
      .sort((a, b) => overdueDays(b, today) - overdueDays(a, today));
    if (overdue.length === 0) return { text: "¡Excelente! No tienes clientes en mora hoy." };
    const lines = overdue.slice(0, 10).map((i) => {
      const p = policyById.get(i.policyId)!;
      return `• ${clientById.get(p.clientId)?.name} – ${formatMoney(i.amount)} · ${overdueDays(i, today)} días (${p.number})`;
    });
    return {
      text: `Tienes ${m.overdueClients} clientes en mora por un total de ${formatMoney(m.overdueAmount)}. ${m.criticalOverdueCount} cuotas superan 14 días.\n\nLos más atrasados:\n${lines.join("\n")}\n\nRecomendación: llama hoy a los de más de 14 días y envía recordatorio amable al resto.`,
      links: [{ label: "Gestionar mora", href: "/cobranza?filtro=mora" }],
    };
  }

  if (has(q, "cumple")) {
    const list = upcomingBirthdays(db, today, 7);
    if (list.length === 0) return { text: "No hay cumpleaños en los próximos 7 días." };
    return {
      text: `Cumpleaños de los próximos 7 días:\n${list.map((b) => `• ${b.name} – ${b.daysAway === 0 ? "HOY" : formatDate(b.date)} (cumple ${b.turning})${b.isHolder ? "" : " · asegurado"}`).join("\n")}\n\nUn mensaje personal en su día fortalece la relación y abre conversaciones de renovación.`,
      links: [{ label: "Enviar felicitaciones", href: "/dashboard#eventos" }],
    };
  }

  if (has(q, "comision")) {
    return {
      text: `Comisiones:\n• Cobradas este mes: ${formatMoney(m.commissionsCollectedMonth)}\n• Cobradas en el año: ${formatMoney(m.commissionsCollectedYear)}\n• Por cobrar (cuotas vencidas o del mes): ${formatMoney(m.commissionsReceivable)}\n• Estimado anual según cuotas programadas: ${formatMoney(m.commissionsEstimatedYear)}`,
      links: [{ label: "Ver detalle por compañía", href: "/reportes" }],
    };
  }

  if (has(q, "renova", "vence", "vencimiento")) {
    const list = upcomingRenewals(db, today, 30);
    return {
      text: list.length
        ? `${list.length} pólizas vencen en los próximos 30 días:\n${list.map((r) => `• ${clientById.get(r.policy.clientId)?.name} – ${r.policy.product} (${formatDate(r.policy.endDate)})`).join("\n")}`
        : "No hay renovaciones en los próximos 30 días.",
      links: [{ label: "Ir a renovaciones", href: "/renovaciones" }],
    };
  }

  if (has(q, "mejor", "mes", "temporada", "estacional")) {
    const series = monthlySeries(db, today, 12);
    const best = [...series].sort((a, b) => b.emissionsPremium - a.emissionsPremium).slice(0, 3);
    return {
      text: `Tus meses con más primas emitidas (últimos 12 meses):\n${best.map((b) => `• ${MONTHS_LONG_ES[parts(`${b.key}-01`).m - 1]}: ${formatMoney(b.emissionsPremium)} en ${b.emissionsCount} póliza(s)`).join("\n")}\n\nAprovecha el mes previo a esos picos para prospectar y pedir referidos.`,
    };
  }

  if (has(q, "idea", "crecer", "crecimiento", "recomend", "sugerencia", "oportunidad", "estrategia")) {
    const insights = portfolioInsights(db, today);
    return {
      text: `Esto es lo que veo en tu cartera:\n\n${insights.map((i) => `• ${i.title}\n  ${i.detail}`).join("\n\n")}`,
      links: [{ label: "Ver reporte completo", href: "/reportes" }],
    };
  }

  if (has(q, "resumen", "cartera", "como voy", "como va", "estado", "general")) {
    return {
      text: `Resumen al ${formatDate(today)}:\n• Primas de cartera: ${formatMoney(m.portfolioPremium)} en ${m.activePolicies} pólizas activas (${m.activeClients} clientes)\n• Primas cobradas este mes: ${formatMoney(m.premiumsCollectedThisMonth)} (${m.collectionRate.toFixed(0)}% de lo que vence)\n• Por cobrar este mes: ${formatMoney(m.premiumsDueThisMonth)}\n• En mora: ${m.overdueClients} clientes, ${formatMoney(m.overdueAmount)}\n• Emisiones del mes: ${m.emissionsMonthCount} (meta ${db.settings.monthlyEmissionGoal})\n• Pagos por verificar: ${m.pendingVerificationCount}`,
      links: [{ label: "Ir al dashboard", href: "/dashboard" }],
    };
  }

  return {
    text: "Puedo ayudarte con tu cartera: resumen del mes, clientes en mora, cumpleaños, comisiones, renovaciones, mejores meses e ideas de crecimiento. También puedes preguntarme por un cliente por su nombre, o qué cubre su póliza.",
  };
}
