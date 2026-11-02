"use client";

import { useEffect, useState } from "react";

/** Downloads rows as a UTF-8 CSV that opens correctly in Excel. */
export function exportCsv(rows: (string | number)[][], filename: string): void {
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Reads a query-string value once on mount.
 * Avoids useSearchParams so pages don't need a Suspense boundary for prerendering.
 */
export function useInitialQueryParam<T extends string>(name: string, fallback: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const v = new URLSearchParams(window.location.search).get(name);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v) setValue(v as T);
  }, [name]);
  return [value, setValue];
}
