/**
 * Money is stored as a number of dollars but every calculation goes through integer cents,
 * so splitting a premium into installments is exact (no floating point leftovers).
 */

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function sumMoney(values: number[]): number {
  return fromCents(values.reduce((acc, v) => acc + toCents(v), 0));
}

export function percentOf(amount: number, ratePercent: number): number {
  return fromCents(Math.round((toCents(amount) * ratePercent) / 100));
}

/** Splits `total` into `parts` amounts; the remainder cents go to the last installment. */
export function splitAmount(total: number, parts: number): number[] {
  const cents = toCents(total);
  const base = Math.floor(cents / parts);
  const result = Array.from({ length: parts }, () => base);
  result[parts - 1] += cents - base * parts;
  return result.map(fromCents);
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: number): string {
  return usd.format(amount);
}

export function formatCompactMoney(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `$${(amount / 1_000).toFixed(1)}K`;
  return formatMoney(amount);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}
