import { addMonths, diffDays } from "./dates";
import { splitAmount } from "./money";
import type {
  Frequency,
  Installment,
  ISODate,
  Policy,
  PolicyStatus,
  PolicyType,
  Product,
} from "./types";

export const FREQUENCY_INSTALLMENTS: Record<Frequency, number> = {
  mensual: 12,
  trimestral: 4,
  semestral: 2,
  anual: 1,
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const POLICY_TYPE_LABEL: Record<PolicyType, string> = {
  individual: "Individual",
  familiar: "Familiar",
  menor: "Menor de edad",
  pareja: "Pareja sin hijos",
  adulto_mayor: "Adulto mayor",
  colectivo: "Colectivo / Empresa",
};

export const POLICY_STATUS_LABEL: Record<PolicyStatus, string> = {
  activa: "Activa",
  anulada: "Anulada",
  renovada: "Renovada",
  vencida: "Vencida",
};

export const PRODUCTS: Product[] = [
  "Salud",
  "Vida",
  "Accidentes Personales",
  "Funerario",
  "Automóvil",
  "Hogar",
  "Incendio",
];

export const POLICY_TYPES = Object.keys(POLICY_TYPE_LABEL) as PolicyType[];
export const FREQUENCIES = Object.keys(FREQUENCY_LABEL) as Frequency[];

/** Months between installments for each frequency. */
const FREQUENCY_STEP: Record<Frequency, number> = {
  mensual: 1,
  trimestral: 3,
  semestral: 6,
  anual: 12,
};

export interface ScheduleItem {
  sequence: number;
  dueDate: ISODate;
  amount: number;
}

/**
 * Builds the exact payment schedule for one policy year.
 * Each due date is computed from the start date (not chained), so day clamping never accumulates.
 */
export function buildSchedule(
  startDate: ISODate,
  annualPremium: number,
  frequency: Frequency,
): ScheduleItem[] {
  const count = FREQUENCY_INSTALLMENTS[frequency];
  const step = FREQUENCY_STEP[frequency];
  const amounts = splitAmount(annualPremium, count);
  return amounts.map((amount, i) => ({
    sequence: i + 1,
    dueDate: addMonths(startDate, i * step),
    amount,
  }));
}

export function policyEndDate(startDate: ISODate): ISODate {
  return addMonths(startDate, 12);
}

/** Collection state as shown to users. Derived from the stored status and today's date. */
export type CollectionState =
  | "verificado"
  | "reportado"
  | "por_vencer"
  | "vence_hoy"
  | "mora"
  | "mora_critica";

export const CRITICAL_OVERDUE_DAYS = 14;

export function collectionState(inst: Installment, today: ISODate): CollectionState {
  if (inst.status === "verificado") return "verificado";
  if (inst.status === "reportado") return "reportado";
  const days = diffDays(inst.dueDate, today);
  if (days === 0) return "vence_hoy";
  if (days < 0) return "por_vencer";
  return days > CRITICAL_OVERDUE_DAYS ? "mora_critica" : "mora";
}

/** Positive number of days past due (0 when not overdue). */
export function overdueDays(inst: Installment, today: ISODate): number {
  if (inst.status !== "pendiente") return 0;
  return Math.max(0, diffDays(inst.dueDate, today));
}

export const COLLECTION_STATE_LABEL: Record<CollectionState, string> = {
  verificado: "Verificado",
  reportado: "Por verificar",
  por_vencer: "Pendiente",
  vence_hoy: "Vence hoy",
  mora: "Mora",
  mora_critica: "Mora +14d",
};

/** Collection protocol stages, from friendly reminder to escalation. */
export interface ProtocolStage {
  key: "previo" | "dia" | "amable" | "firme" | "escalamiento";
  label: string;
  description: string;
}

export function protocolStage(inst: Installment, today: ISODate): ProtocolStage {
  const days = diffDays(inst.dueDate, today);
  if (days < 0)
    return { key: "previo", label: "Recordatorio previo", description: "Aviso amable antes del vencimiento." };
  if (days === 0)
    return { key: "dia", label: "Día de vencimiento", description: "Recordatorio el mismo día." };
  if (days <= 7)
    return { key: "amable", label: "Recordatorio amable", description: "1 a 7 días de atraso." };
  if (days <= CRITICAL_OVERDUE_DAYS)
    return { key: "firme", label: "Seguimiento firme", description: "8 a 14 días de atraso." };
  return {
    key: "escalamiento",
    label: "Escalamiento",
    description: "Más de 14 días: llamada directa y riesgo de suspensión de cobertura.",
  };
}

export function isActive(policy: Policy): boolean {
  return policy.status === "activa";
}

export function nextPolicyNumber(companyShort: string, existing: Policy[], today: ISODate): string {
  const year = today.slice(0, 4);
  const prefix = `${companyShort.toUpperCase()}-${year}-`;
  const max = existing
    .filter((p) => p.number.startsWith(prefix))
    .map((p) => Number(p.number.slice(prefix.length)) || 0)
    .reduce((a, b) => Math.max(a, b), 1000);
  return `${prefix}${max + 1}`;
}
