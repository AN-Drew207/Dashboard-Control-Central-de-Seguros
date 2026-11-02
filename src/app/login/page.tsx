"use client";

import { LogIn, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button, Field } from "@/components/ui/primitives";
import { useAuth } from "@/context/AuthContext";
import { ROLE_LABEL } from "@/lib/domain/permissions";
import { DEMO_USERS } from "@/lib/mock-api/seed";

const ROLE_SCOPE: Record<string, string> = {
  superadmin: "Acceso total a la plataforma.",
  corredor: "Finanzas, comisiones, reportes y asistente IA.",
  asistente: "Registro de pólizas, cobranza y verificación de pagos.",
};

export default function LoginPage() {
  const { login, user, ready } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password, remember);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="grid w-full max-w-4xl gap-6 md:grid-cols-[1fr_1fr]">
        <form onSubmit={submit} className="rounded-lg border border-outline-variant bg-surface-container-low p-6 sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-md border border-primary/30 bg-primary-container/20 text-primary">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h1 className="text-headline-md font-bold text-primary">InsureFlow</h1>
              <p className="text-body-sm text-on-surface-variant">Control Central de Seguros</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Correo electrónico">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="input-base"
                autoComplete="username"
              />
            </Field>
            <Field label="Contraseña">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input-base"
                autoComplete="current-password"
              />
            </Field>
            <label className="flex items-center gap-2 text-body-md text-on-surface-variant">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="accent-primary-container" />
              Recordarme
            </label>
            {error && <p className="rounded bg-error/10 px-3 py-2 text-body-sm text-error">{error}</p>}
            <Button type="submit" disabled={loading} className="mt-2 w-full">
              <LogIn className="size-4" />
              {loading ? "Ingresando..." : "Iniciar sesión"}
            </Button>
            <button
              type="button"
              className="text-left text-body-sm text-primary hover:underline cursor-pointer"
              onClick={() => setError("Demo: usa una de las cuentas de prueba de la derecha.")}
            >
              ¿Olvidaste tu contraseña?
            </button>
          </div>
        </form>

        <div className="rounded-lg border border-tertiary/30 bg-tertiary/5 p-6 sm:p-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-tertiary">Cuentas demo</p>
          <p className="mb-6 text-body-sm text-on-surface-variant">
            Toca una cuenta para entrar. Todos los datos viven en este navegador (localStorage).
          </p>
          <div className="flex flex-col gap-3">
            {DEMO_USERS.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => {
                  setEmail(u.email);
                  setPassword(u.password);
                }}
                className="rounded border border-outline-variant bg-surface-container p-4 text-left transition-colors hover:border-primary-container cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-on-surface">{u.name}</p>
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                    {ROLE_LABEL[u.role]}
                  </span>
                </div>
                <p className="num mt-1 text-xs text-on-surface-variant">{u.email} · {u.password}</p>
                <p className="mt-2 text-body-sm text-outline">{ROLE_SCOPE[u.role]}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
