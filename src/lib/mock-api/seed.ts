import { addDays, addMonths, diffDays, parts, toISO } from "../domain/dates";
import { buildSchedule, policyEndDate } from "../domain/policies";
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
  PolicyType,
  Product,
  User,
} from "../domain/types";

export const DB_VERSION = 1;

export const DEMO_USERS: User[] = [
  { id: "u-alex", name: "Alex Rodríguez", email: "admin@insureflow.demo", password: "demo123", role: "superadmin" },
  { id: "u-corredor", name: "Carolina Méndez", email: "corredor@insureflow.demo", password: "demo123", role: "corredor" },
  { id: "u-asistente", name: "Luis Pérez", email: "asistente@insureflow.demo", password: "demo123", role: "asistente" },
];

const COMPANIES: Company[] = [
  { id: "mercantil", name: "Mercantil Seguros", shortName: "MER", defaultCommissionRate: 15 },
  { id: "caracas", name: "Seguros Caracas", shortName: "SCA", defaultCommissionRate: 14 },
  { id: "oceanica", name: "Oceánica de Seguros", shortName: "OCE", defaultCommissionRate: 16 },
  { id: "piramide", name: "Seguros Pirámide", shortName: "PIR", defaultCommissionRate: 15 },
  { id: "panamerican", name: "Pan-American Life (Panamá)", shortName: "PAL", defaultCommissionRate: 18 },
  { id: "internacional", name: "La Internacional", shortName: "INT", defaultCommissionRate: 15 },
];

/** Small deterministic PRNG so the demo data is the same on every reset. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rng = () => number;
const int = (r: Rng, min: number, max: number) => Math.floor(r() * (max - min + 1)) + min;
const pick = <T,>(r: Rng, list: readonly T[]): T => list[Math.floor(r() * list.length)];

const FIRST_M = ["Carlos", "José", "Luis", "Miguel", "Andrés", "Rafael", "Gabriel", "Daniel", "Javier", "Ricardo", "Víctor", "César"];
const FIRST_F = ["María", "Ana", "Yanniris", "Gabriela", "Andreína", "Valentina", "Carmen", "Daniela", "Joyfer", "Mariela", "Rosa", "Patricia"];
const LAST = ["Mendoza", "Rivas", "Castillo", "Sánchez", "Fuentes", "Pino", "Ramos", "González", "Rodríguez", "Pérez", "Hernández", "Martínez", "Rojas", "Briceño", "Contreras", "Villegas", "Faftosky", "Urdaneta"];
const KIDS = ["Sofía", "Santiago", "Isabella", "Mateo", "Victoria", "Sebastián", "Camila", "Diego"];
const COMPANIES_CLIENTS = [
  "Inversiones ACME C.A.",
  "Constructora Bolívar C.A.",
  "Logística Integral Sur",
  "Grupo Logístico Andes C.A.",
  "Distribuidora Ávila 2020",
];

const PREMIUM_RANGES: Record<Product, [number, number]> = {
  Salud: [900, 2600],
  Vida: [300, 1200],
  "Accidentes Personales": [120, 420],
  Funerario: [96, 300],
  Automóvil: [320, 1500],
  Hogar: [220, 820],
  Incendio: [1500, 9000],
};

const SUM_INSURED: Record<Product, number[]> = {
  Salud: [50_000, 100_000, 200_000, 500_000],
  Vida: [50_000, 100_000, 150_000],
  "Accidentes Personales": [20_000, 50_000],
  Funerario: [5_000, 10_000],
  Automóvil: [15_000, 25_000, 40_000],
  Hogar: [60_000, 120_000],
  Incendio: [300_000, 800_000, 1_500_000],
};

const COVERAGE: Record<Product, string> = {
  Salud: "Hospitalización, cirugía y maternidad. Emergencias 24h. Deducible según plan. Preexistencias con carencia de 12 meses.",
  Vida: "Muerte por cualquier causa e invalidez total y permanente. Doble indemnización por muerte accidental.",
  "Accidentes Personales": "Muerte accidental, invalidez y gastos médicos por accidente.",
  Funerario: "Servicio funerario completo, traslado y parcela para el grupo asegurado.",
  Automóvil: "Cobertura amplia: pérdida total, daños parciales, robo y responsabilidad civil.",
  Hogar: "Incendio, terremoto, inundación y robo de contenido.",
  Incendio: "Incendio y líneas aliadas sobre edificación, maquinaria e inventario.",
};

const METHODS: PaymentMethod[] = ["Transferencia", "Pago Móvil", "Zelle", "Domiciliación"];

function phone(r: Rng) {
  return `+58 ${pick(r, ["412", "414", "424", "416"])}-${int(r, 100, 999)}-${String(int(r, 0, 9999)).padStart(4, "0")}`;
}

function birthBetween(r: Rng, today: ISODate, minAge: number, maxAge: number): ISODate {
  const { y } = parts(today);
  const year = y - int(r, minAge, maxAge);
  const month = int(r, 1, 12);
  return toISO(year, month, int(r, 1, 28));
}

function slug(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
}

export function createSeed(today: ISODate): Database {
  const r = mulberry32(20261031);
  const clients: Client[] = [];
  const policies: Policy[] = [];
  const installments: Installment[] = [];

  const makeId = (() => {
    let n = 0;
    return (p: string) => `${p}-${(++n).toString(36)}`;
  })();

  // --- Clients ---------------------------------------------------------------
  const personCount = 30;
  for (let i = 0; i < personCount; i++) {
    const female = r() > 0.5;
    const first = female ? pick(r, FIRST_F) : pick(r, FIRST_M);
    const name = `${first} ${pick(r, LAST)} ${pick(r, LAST)}`;
    let birthDate = birthBetween(r, today, 24, 72);
    // Guarantee birthdays today and during this week so the demo always has events.
    if (i < 4) {
      const target = addDays(today, [0, 2, 5, 9][i]);
      const t = parts(target);
      birthDate = toISO(parts(birthDate).y, t.m, t.d);
    }
    clients.push({
      id: makeId("cli"),
      kind: "persona",
      name,
      documentId: `V-${int(r, 6, 28)}.${int(r, 100, 999)}.${int(r, 100, 999)}`,
      email: `${slug(name.split(" ").slice(0, 2).join(" "))}@correo.com`,
      phone: phone(r),
      birthDate,
      vip: r() > 0.82,
      notes: [],
      createdAt: addDays(today, -int(r, 30, 900)),
    });
  }
  for (const name of COMPANIES_CLIENTS) {
    clients.push({
      id: makeId("cli"),
      kind: "empresa",
      name,
      documentId: `J-${int(r, 10, 50)}${int(r, 100000, 999999)}-${int(r, 0, 9)}`,
      email: `administracion@${slug(name.split(" ")[0])}.com.ve`,
      phone: `+58 212-${int(r, 200, 999)}-${String(int(r, 0, 9999)).padStart(4, "0")}`,
      birthDate: null,
      vip: r() > 0.5,
      notes: [],
      createdAt: addDays(today, -int(r, 60, 1200)),
    });
  }

  // --- Policies ----------------------------------------------------------------
  const counters = new Map<string, number>();
  const policyNumber = (company: Company, start: ISODate) => {
    const key = `${company.shortName}-${start.slice(0, 4)}`;
    const n = (counters.get(key) ?? 1000 + int(r, 0, 300)) + int(r, 3, 40);
    counters.set(key, n);
    return `${key}-${n}`;
  };

  let kidTurning18Placed = false;

  const addPolicy = (client: Client, product: Product, policyType: PolicyType, startOffsetDays: number) => {
    const company = pick(r, COMPANIES);
    const startDate = addDays(today, -startOffsetDays);
    const [min, max] = PREMIUM_RANGES[product];
    let premium = int(r, min, max);
    if (policyType === "familiar") premium = Math.round(premium * 2.3);
    if (policyType === "pareja") premium = Math.round(premium * 1.7);
    if (policyType === "adulto_mayor") premium = Math.round(premium * 2.8);
    if (policyType === "colectivo") premium = Math.round(premium * 6.5);
    premium += pick(r, [0, 0.5, 0.25, 0.75]);

    const frequency: Frequency =
      policyType === "colectivo" ? pick(r, ["trimestral", "mensual"] as Frequency[])
      : premium > 3000 ? pick(r, ["mensual", "trimestral", "semestral"] as Frequency[])
      : pick(r, ["mensual", "mensual", "trimestral", "semestral", "anual"] as Frequency[]);

    const insured: Insured[] = [];
    const lastName = client.name.split(" ").slice(1).join(" ");
    if (client.kind === "persona" && policyType !== "menor") {
      insured.push({ id: makeId("ins"), name: client.name, relationship: "Titular", birthDate: client.birthDate! });
    }
    if (policyType === "familiar" || policyType === "pareja") {
      insured.push({
        id: makeId("ins"),
        name: `${pick(r, FIRST_F)} ${pick(r, LAST)}`,
        relationship: "Cónyuge",
        birthDate: birthBetween(r, today, 25, 60),
      });
    }
    if (policyType === "familiar" || policyType === "menor") {
      const kids = policyType === "menor" ? 1 : int(r, 1, 3);
      for (let k = 0; k < kids; k++) {
        let birthDate = birthBetween(r, today, 2, 16);
        if (!kidTurning18Placed) {
          // One dependent turns 18 in ~3 months: growth opportunity for the insights engine.
          birthDate = addMonths(addMonths(today, 3), -18 * 12);
          kidTurning18Placed = true;
        }
        insured.push({ id: makeId("ins"), name: `${pick(r, KIDS)} ${lastName}`, relationship: "Hijo(a)", birthDate });
      }
    }
    if (policyType === "adulto_mayor") {
      insured.push({
        id: makeId("ins"),
        name: `${pick(r, [...FIRST_F, ...FIRST_M])} ${lastName}`,
        relationship: "Padre/Madre",
        birthDate: birthBetween(r, today, 64, 82),
      });
    }
    if (policyType === "colectivo") {
      const n = int(r, 4, 7);
      for (let k = 0; k < n; k++) {
        insured.push({
          id: makeId("ins"),
          name: `${pick(r, [...FIRST_F, ...FIRST_M])} ${pick(r, LAST)}`,
          relationship: "Otro",
          birthDate: birthBetween(r, today, 22, 58),
        });
      }
    }

    const number = policyNumber(company, startDate);
    const policy: Policy = {
      id: makeId("pol"),
      number,
      clientId: client.id,
      companyId: company.id,
      product,
      policyType,
      sumInsured: pick(r, SUM_INSURED[product]),
      annualPremium: premium,
      frequency,
      startDate,
      endDate: policyEndDate(startDate),
      status: "activa",
      commissionRate: company.defaultCommissionRate,
      insured,
      coverage: COVERAGE[product],
      documents:
        r() > 0.35
          ? [
              { id: makeId("doc"), name: `Poliza_${number}.pdf`, sizeBytes: int(r, 300, 2600) * 1024, kind: "poliza", uploadedAt: startDate },
              { id: makeId("doc"), name: `Condicionado_${product.replace(/\s/g, "_")}_${company.shortName}.pdf`, sizeBytes: int(r, 800, 4200) * 1024, kind: "condicionado", uploadedAt: startDate },
            ]
          : [],
      isRenewal: r() > 0.55,
      renewedFromId: null,
      cancelledAt: null,
      cancelReason: null,
      createdAt: startDate,
    };
    policies.push(policy);

    // Payment behaviour profile for this policy.
    const profile = r();
    const lateCount = profile > 0.84 ? 2 : profile > 0.68 ? 1 : 0;
    const reportsLast = profile > 0.58 && profile <= 0.68;

    const schedule = buildSchedule(startDate, premium, frequency);
    const past = schedule.filter((s) => diffDays(s.dueDate, today) > 0);
    schedule.forEach((s) => {
      const isPast = diffDays(s.dueDate, today) > 0;
      const idxFromEnd = past.length - past.findIndex((p) => p.sequence === s.sequence);
      let status: Installment["status"] = "pendiente";
      if (isPast) {
        // Only recent installments stay unpaid, so overdue ages look realistic (max ~45 days).
        const recent = diffDays(s.dueDate, today) <= 45;
        status = idxFromEnd <= lateCount && recent ? "pendiente" : "verificado";
        if (reportsLast && idxFromEnd === 1) status = "reportado";
      }
      const paidOffset = int(r, -3, 9);
      const paidAt = diffDays(addDays(s.dueDate, paidOffset), today) >= 0 ? addDays(s.dueDate, paidOffset) : today;
      installments.push({
        id: makeId("cuo"),
        policyId: policy.id,
        sequence: s.sequence,
        totalInSchedule: schedule.length,
        dueDate: s.dueDate,
        amount: s.amount,
        status,
        reportedAt: status !== "pendiente" ? paidAt : null,
        method: status !== "pendiente" ? pick(r, METHODS) : null,
        reference: status !== "pendiente" ? String(int(r, 10000000, 99999999)) : null,
        verifiedAt: status === "verificado" ? paidAt : null,
        verifiedBy: status === "verificado" ? "Luis Pérez" : null,
      });
    });
    return policy;
  };

  const personTypes: PolicyType[] = ["individual", "familiar", "familiar", "pareja", "adulto_mayor", "menor", "individual"];
  clients.forEach((client, i) => {
    // Spread start dates across the last year; a few start this month (new emissions)
    // and a few started ~11 months ago (upcoming renewals).
    const offset = i % 9 === 0 ? int(r, 0, Math.max(0, parts(today).d - 1)) : i % 7 === 0 ? int(r, 330, 362) : int(r, 15, 360);
    if (client.kind === "empresa") {
      addPolicy(client, pick(r, ["Salud", "Incendio", "Automóvil"] as Product[]), "colectivo", offset);
      if (r() > 0.5) addPolicy(client, "Incendio", "colectivo", int(r, 20, 340));
      return;
    }
    addPolicy(client, r() > 0.25 ? "Salud" : pick(r, ["Vida", "Automóvil"] as Product[]), pick(r, personTypes), offset);
    if (r() > 0.55) addPolicy(client, pick(r, ["Vida", "Funerario", "Automóvil", "Hogar", "Accidentes Personales"] as Product[]), "individual", int(r, 10, 355));
  });

  // A few cancelled policies (left the portfolio).
  const reasons = ["Cliente migró a otra compañía", "Falta de pago", "Venta del vehículo", "Ajuste de presupuesto"];
  policies
    .filter((p) => p.product !== "Salud")
    .slice(0, 4)
    .forEach((p, i) => {
      p.status = "anulada";
      p.cancelledAt = i === 0 ? today : addDays(today, -int(r, 5, 200));
      p.cancelReason = reasons[i % reasons.length];
      // Pending installments after cancellation are dropped.
      for (let k = installments.length - 1; k >= 0; k--) {
        const inst = installments[k];
        if (inst.policyId === p.id && inst.status !== "verificado") installments.splice(k, 1);
      }
    });

  // Commercial notes.
  const noteSamples = [
    "Cliente interesado en ampliar cobertura de gastos mayores para el próximo período de renovación.",
    "Prefiere contacto por WhatsApp en horario de la tarde.",
    "Tiene dos hijos en edad universitaria: ofrecer póliza individual al cumplir 18.",
    "Comentó que su empresa evalúa una póliza colectiva para 25 empleados.",
  ];
  clients.slice(0, 10).forEach((c, i) => {
    c.notes.push({ id: makeId("note"), text: noteSamples[i % noteSamples.length], author: "Carolina Méndez", createdAt: addDays(today, -int(r, 1, 60)) });
  });

  return {
    version: DB_VERSION,
    companies: COMPANIES,
    clients,
    policies,
    installments,
    reminders: [],
    settings: { brokerName: "Carolina Méndez", monthlyEmissionGoal: 3, currency: "USD" },
  };
}
