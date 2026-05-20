import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { authService } from "@/services/authService";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    authService.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = authService.onAuthStateChange((s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        Cargando…
      </div>
    );
  }

  if (!session) return <LoginScreen />;
  return <>{children}</>;
}

function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    const { error } = await authService.signInWithPassword(email.trim(), password);
    setLoading(false);
    if (error) setErr("Credenciales incorrectas. Verifica tu correo y contraseña.");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl bg-card p-8 shadow-lg md:p-10">
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Flebo Perú
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Acceso Clínico
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresa tus credenciales para continuar
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Correo electrónico
            </label>
            <input
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Contraseña
            </label>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
          </div>

          {err && (
            <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {err}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-primary px-6 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Cargando…" : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
