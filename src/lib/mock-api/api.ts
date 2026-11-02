/**
 * Mock backend. Every function is async and behaves like a remote API call,
 * but data lives in localStorage. To plug a real backend, replace this module
 * keeping the same function signatures; the UI does not need to change.
 */
import { todayISO } from "../domain/dates";
import { buildSchedule, nextPolicyNumber, policyEndDate } from "../domain/policies";
import type {
  Client,
  Company,
  Database,
  Frequency,
  Installment,
  Insured,
  ISODate,
  PaymentMethod,
  Policy,
  PolicyDocument,
  PolicyType,
  Product,
  ReminderLog,
  Settings,
  User,
} from "../domain/types";
import { createSeed, DB_VERSION, DEMO_USERS } from "./seed";

const STORAGE_KEY = "insureflow:db";
const LATENCY_MS = 180;

const delay = () => new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function read(): Database {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const db = JSON.parse(raw) as Database;
      if (db.version === DB_VERSION) return db;
    }
  } catch {
    // Corrupt or unavailable storage: fall back to fresh demo data.
  }
  const seed = createSeed(todayISO());
  write(seed);
  return seed;
}

function write(db: Database): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Storage full or blocked: the session keeps working in memory.
  }
}

/** Runs a mutation over a copy of the database, persists it and returns the new state. */
async function mutate(fn: (db: Database) => void): Promise<Database> {
  await delay();
  const db = structuredClone(read());
  fn(db);
  write(db);
  return db;
}

function scheduleInstallments(policy: Policy): Installment[] {
  const schedule = buildSchedule(policy.startDate, policy.annualPremium, policy.frequency);
  return schedule.map((s) => ({
    id: uid("cuo"),
    policyId: policy.id,
    sequence: s.sequence,
    totalInSchedule: schedule.length,
    dueDate: s.dueDate,
    amount: s.amount,
    status: "pendiente",
    reportedAt: null,
    method: null,
    reference: null,
    verifiedAt: null,
    verifiedBy: null,
  }));
}

function findOrThrow<T extends { id: string }>(list: T[], id: string, what: string): T {
  const item = list.find((x) => x.id === id);
  if (!item) throw new Error(`${what} no encontrado`);
  return item;
}

// --- Auth ----------------------------------------------------------------------

export async function login(email: string, password: string): Promise<Omit<User, "password">> {
  await delay();
  const user = DEMO_USERS.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
  if (!user || user.password !== password) throw new Error("Correo o contraseña incorrectos");
  const { id, name, email: userEmail, role } = user;

  return { id, name, email: userEmail, role };
}

// --- Database --------------------------------------------------------------------

export async function loadDatabase(): Promise<Database> {
  await delay();
  return read();
}

export async function resetDatabase(): Promise<Database> {
  await delay();
  const seed = createSeed(todayISO());
  write(seed);
  return seed;
}

// --- Clients ---------------------------------------------------------------------

export type ClientInput = Omit<Client, "id" | "notes" | "createdAt">;

export async function createClient(input: ClientInput): Promise<{ db: Database; client: Client }> {
  let client!: Client;
  const db = await mutate((d) => {
    client = { ...input, id: uid("cli"), notes: [], createdAt: todayISO() };
    d.clients.push(client);
  });
  return { db, client };
}

export function updateClient(id: string, patch: Partial<ClientInput>): Promise<Database> {
  return mutate((d) => Object.assign(findOrThrow(d.clients, id, "Cliente"), patch));
}

export function addNote(clientId: string, text: string, author: string): Promise<Database> {
  return mutate((d) => {
    findOrThrow(d.clients, clientId, "Cliente").notes.unshift({
      id: uid("note"),
      text,
      author,
      createdAt: todayISO(),
    });
  });
}

// --- Policies --------------------------------------------------------------------

export interface PolicyInput {
  clientId: string;
  companyId: string;
  product: Product;
  policyType: PolicyType;
  sumInsured: number;
  annualPremium: number;
  frequency: Frequency;
  startDate: ISODate;
  commissionRate: number;
  insured: Omit<Insured, "id">[];
  coverage: string;
  number?: string;
}

export async function createPolicy(input: PolicyInput): Promise<{ db: Database; policy: Policy }> {
  let policy!: Policy;
  const db = await mutate((d) => {
    const company = findOrThrow(d.companies, input.companyId, "Compañía");
    policy = {
      id: uid("pol"),
      number: input.number?.trim() || nextPolicyNumber(company.shortName, d.policies, input.startDate),
      clientId: input.clientId,
      companyId: input.companyId,
      product: input.product,
      policyType: input.policyType,
      sumInsured: input.sumInsured,
      annualPremium: input.annualPremium,
      frequency: input.frequency,
      startDate: input.startDate,
      endDate: policyEndDate(input.startDate),
      status: "activa",
      commissionRate: input.commissionRate,
      insured: input.insured.map((i) => ({ ...i, id: uid("ins") })),
      coverage: input.coverage,
      documents: [],
      isRenewal: false,
      renewedFromId: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: todayISO(),
    };
    d.policies.push(policy);
    d.installments.push(...scheduleInstallments(policy));
  });
  return { db, policy };
}

export function cancelPolicy(id: string, reason: string): Promise<Database> {
  return mutate((d) => {
    const policy = findOrThrow(d.policies, id, "Póliza");
    policy.status = "anulada";
    policy.cancelledAt = todayISO();
    policy.cancelReason = reason;
    // Unpaid installments no longer count once the policy leaves the portfolio.
    d.installments = d.installments.filter((i) => i.policyId !== id || i.status === "verificado");
  });
}

export function renewPolicy(
  id: string,
  changes: { annualPremium: number; frequency: Frequency; sumInsured: number },
): Promise<Database> {
  return mutate((d) => {
    const old = findOrThrow(d.policies, id, "Póliza");
    old.status = "renovada";
    const renewed: Policy = {
      ...structuredClone(old),
      ...changes,
      id: uid("pol"),
      startDate: old.endDate,
      endDate: policyEndDate(old.endDate),
      status: "activa",
      isRenewal: true,
      renewedFromId: old.id,
      documents: [],
      createdAt: todayISO(),
    };
    d.policies.push(renewed);
    d.installments.push(...scheduleInstallments(renewed));
  });
}

export function addDocument(policyId: string, doc: Omit<PolicyDocument, "id" | "uploadedAt">): Promise<Database> {
  return mutate((d) => {
    findOrThrow(d.policies, policyId, "Póliza").documents.unshift({
      ...doc,
      id: uid("doc"),
      uploadedAt: todayISO(),
    });
  });
}

export function removeDocument(policyId: string, docId: string): Promise<Database> {
  return mutate((d) => {
    const p = findOrThrow(d.policies, policyId, "Póliza");
    p.documents = p.documents.filter((x) => x.id !== docId);
  });
}

// --- Collections -----------------------------------------------------------------

export function reportPayment(
  installmentId: string,
  data: { method: PaymentMethod; reference: string; date: ISODate },
): Promise<Database> {
  return mutate((d) => {
    const inst = findOrThrow(d.installments, installmentId, "Cuota");
    inst.status = "reportado";
    inst.method = data.method;
    inst.reference = data.reference;
    inst.reportedAt = data.date;
  });
}

export function verifyPayment(installmentId: string, verifiedBy: string): Promise<Database> {
  return mutate((d) => {
    const inst = findOrThrow(d.installments, installmentId, "Cuota");
    if (inst.status === "pendiente") throw new Error("Primero registra el pago reportado");
    inst.status = "verificado";
    inst.verifiedAt = todayISO();
    inst.verifiedBy = verifiedBy;
  });
}

export function rejectPayment(installmentId: string): Promise<Database> {
  return mutate((d) => {
    const inst = findOrThrow(d.installments, installmentId, "Cuota");
    inst.status = "pendiente";
    inst.method = null;
    inst.reference = null;
    inst.reportedAt = null;
  });
}

export function logReminder(entry: Omit<ReminderLog, "id" | "sentAt">): Promise<Database> {
  return mutate((d) => {
    d.reminders.unshift({ ...entry, id: uid("rem"), sentAt: todayISO() });
  });
}

// --- Settings --------------------------------------------------------------------

export function updateSettings(patch: Partial<Settings>): Promise<Database> {
  return mutate((d) => Object.assign(d.settings, patch));
}

export function updateCompany(id: string, patch: Partial<Omit<Company, "id">>): Promise<Database> {
  return mutate((d) => Object.assign(findOrThrow(d.companies, id, "Compañía"), patch));
}

export function addCompany(input: Omit<Company, "id">): Promise<Database> {
  return mutate((d) => {
    d.companies.push({ ...input, id: uid("cia") });
  });
}

