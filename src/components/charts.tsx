"use client";

import { useState } from "react";
import { formatMonth } from "@/lib/domain/dates";
import { cn } from "./ui/primitives";

/** Single-series vertical bars with a hover tooltip. */
export function MonthlyBars({
  data,
  format,
  highlightLast = true,
  height = 180,
}: {
  data: { key: string; value: number }[];
  format: (v: number) => string;
  highlightLast?: boolean;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="relative">
      {/* recessive gridlines */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col justify-between" style={{ height }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border-t border-outline-variant/40" />
        ))}
      </div>
      <div className="relative flex items-end gap-[2px]" style={{ height }}>
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 8);
          const last = highlightLast && i === data.length - 1;
          return (
            <div
              key={d.key}
              className="group relative flex h-full flex-1 items-end justify-center"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div
                className={cn(
                  "w-full max-w-7 rounded-t transition-colors",
                  last ? "bg-primary-container" : "bg-primary-container/45",
                  hover === i && "bg-primary",
                )}
                style={{ height: Math.max(d.value > 0 ? 2 : 0, h) }}
              />
              {hover === i && (
                <div className="absolute bottom-full z-10 mb-1 whitespace-nowrap rounded border border-outline-variant bg-surface-container-highest px-2 py-1 text-xs shadow-lg"
                  style={{ bottom: h + 4 }}>
                  <p className="text-on-surface-variant">{formatMonth(d.key)}</p>
                  <p className="num font-semibold text-on-surface">{format(d.value)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {data.map((d, i) => (
          <span key={d.key} className={cn("flex-1 text-center num text-[10px] text-outline", i % 2 === 1 && "hidden sm:block")}>
            {formatMonth(d.key).split(" ")[0]}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Ranked horizontal bars: label, bar, value. Works as its own table view. */
export function RankedBars({
  rows,
  format,
}: {
  rows: { label: string; value: number; sub?: string }[];
  format: (v: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((a, r) => a + r.value, 0);
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}: ${format(r.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-body-sm">
            <span className="truncate text-on-surface">
              {r.label}
              {r.sub && <span className="ml-2 text-outline">{r.sub}</span>}
            </span>
            <span className="num shrink-0 text-on-surface-variant">
              {format(r.value)} <span className="text-outline">· {total ? ((r.value / total) * 100).toFixed(0) : 0}%</span>
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-container-highest">
            <div className="h-2 rounded-full bg-primary-container" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProgressBar({ value, tone = "secondary" }: { value: number; tone?: "secondary" | "tertiary" | "primary" }) {
  const color = tone === "secondary" ? "bg-secondary" : tone === "tertiary" ? "bg-tertiary" : "bg-primary-container";
  return (
    <div className="h-1.5 w-full rounded-full bg-surface-container-highest" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-1.5 rounded-full", color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
