/** ISO date string without time: YYYY-MM-DD. Dates are kept as strings to avoid timezone drift. */
export type ISODate = string;

export type Role = "superadmin" | "corredor" | "asistente";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface Company {
  id: string;
  name: string;
  shortName: string;
  /** Default commission rate as a percentage (e.g. 15 = 15%). */
  defaultCommissionRate: number;
}

export type ClientKind = "persona" | "empresa";

export interface Note {
  id: string;
  text: string;
  author: string;
  createdAt: ISODate;
}

export interface Client {
  id: string;
  kind: ClientKind;
  name: string;
  documentId: string;
  email: string;
  phone: string;
  birthDate: ISODate | null;
  vip: boolean;
  notes: Note[];
  createdAt: ISODate;
}

export type Product =
  | "Salud"
  | "Vida"
  | "Accidentes Personales"
  | "Funerario"
  | "Automóvil"
  | "Hogar"
  | "Incendio";

export type PolicyType =
  | "individual"
  | "familiar"
  | "menor"
  | "pareja"
  | "adulto_mayor"
  | "colectivo";

export type Frequency = "mensual" | "trimestral" | "semestral" | "anual";

export type PolicyStatus = "activa" | "anulada" | "renovada" | "vencida";

export type Relationship = "Titular" | "Cónyuge" | "Hijo(a)" | "Padre/Madre" | "Otro";

export interface Insured {
  id: string;
  name: string;
  relationship: Relationship;
  birthDate: ISODate;
}

export interface PolicyDocument {
  id: string;
  name: string;
  sizeBytes: number;
  kind: "poliza" | "condicionado" | "anexo";
  uploadedAt: ISODate;
}

export interface Policy {
  id: string;
  number: string;
  clientId: string;
  companyId: string;
  product: Product;
  policyType: PolicyType;
  sumInsured: number;
  annualPremium: number;
  frequency: Frequency;
  startDate: ISODate;
  endDate: ISODate;
  status: PolicyStatus;
  commissionRate: number;
  insured: Insured[];
  coverage: string;
  documents: PolicyDocument[];
  isRenewal: boolean;
  renewedFromId: string | null;
  cancelledAt: ISODate | null;
  cancelReason: string | null;
  createdAt: ISODate;
}

/**
 * Payment lifecycle:
 * pendiente -> reportado (client says they paid) -> verificado (confirmed with the insurer).
 */
export type InstallmentStatus = "pendiente" | "reportado" | "verificado";

export type PaymentMethod = "Transferencia" | "Pago Móvil" | "Zelle" | "Efectivo" | "Domiciliación";

export interface Installment {
  id: string;
  policyId: string;
  sequence: number;
  totalInSchedule: number;
  dueDate: ISODate;
  amount: number;
  status: InstallmentStatus;
  reportedAt: ISODate | null;
  method: PaymentMethod | null;
  reference: string | null;
  verifiedAt: ISODate | null;
  verifiedBy: string | null;
}

export type ReminderChannel = "whatsapp" | "email";

export interface ReminderLog {
  id: string;
  installmentId: string | null;
  clientId: string;
  channel: ReminderChannel;
  kind: "cobranza" | "cumpleanos" | "producto";
  message: string;
  sentAt: ISODate;
  sentBy: string;
}

export interface Settings {
  brokerName: string;
  monthlyEmissionGoal: number;
  currency: "USD";
}

export interface Database {
  version: number;
  companies: Company[];
  clients: Client[];
  policies: Policy[];
  installments: Installment[];
  reminders: ReminderLog[];
  settings: Settings;
}
