"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { todayISO } from "@/lib/domain/dates";
import { buildIndexes, type Indexes } from "@/lib/domain/metrics";
import type { Database, ISODate } from "@/lib/domain/types";
import * as api from "@/lib/mock-api/api";
import { useToast } from "./ToastContext";

type ApiModule = typeof api;

interface DataState {
  db: Database | null;
  indexes: Indexes | null;
  today: ISODate;
  busy: boolean;
  /**
   * Runs a mock-API call that returns the new database, updates state and shows feedback.
   * Returns the full API result so callers can read created entities.
   */
  run: <T extends Database | { db: Database }>(call: Promise<T>, successMessage?: string) => Promise<T>;
  api: ApiModule;
}

const DataContext = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const [db, setDb] = useState<Database | null>(null);
  const [busy, setBusy] = useState(false);
  // "Today" depends on the visitor's clock, so it is read in the browser only (never at prerender).
  const [today, setToday] = useState<ISODate>("");

  useEffect(() => {
    api.loadDatabase().then((loaded) => {
      setToday(todayISO());
      setDb(loaded);
    });
  }, []);

  const run = useCallback<DataState["run"]>(
    async (call, successMessage) => {
      setBusy(true);
      try {
        const result = await call;
        setDb("db" in result ? result.db : result);
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ocurrió un error");
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [toast],
  );

  const indexes = useMemo(() => (db ? buildIndexes(db) : null), [db]);

  const value = useMemo<DataState>(
    () => ({ db, indexes, today, busy, run, api }),
    [db, indexes, today, busy, run],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataState {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData must be used inside DataProvider");
  return ctx;
}

/** Use inside the authenticated app shell, where the database is guaranteed to be loaded. */
export function useDb(): Omit<DataState, "db" | "indexes"> & { db: Database; indexes: Indexes } {
  const ctx = useData();
  if (!ctx.db || !ctx.indexes) throw new Error("Database not loaded yet");
  return ctx as Omit<DataState, "db" | "indexes"> & { db: Database; indexes: Indexes };
}
