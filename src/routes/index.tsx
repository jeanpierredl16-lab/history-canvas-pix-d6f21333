import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Paciente } from "@/lib/supabase";
import { patientService } from "@/services/patientService";
import { FiliationForm } from "@/components/FiliationForm";
import { PatientDashboard } from "@/components/PatientDashboard";

export const Route = createFileRoute("/")({
  component: Index,
  ssr: false,
  head: () => ({
    meta: [
      { title: "Flebo Perú · Historias Clínicas Digitales" },
      {
        name: "description",
        content:
          "Sistema profesional de historias clínicas digitales para la clínica Flebo Perú.",
      },
    ],
  }),
});

type Mode = "search" | "new" | "patient";

function Index() {
  const [dni, setDni] = useState("");
  const [mode, setMode] = useState<Mode>("search");
  const [paciente, setPaciente] = useState<Paciente | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function buscar(e?: React.FormEvent) {
    e?.preventDefault();
    setErr(null);
    if (!dni.trim()) return;
    setLoading(true);
    try {
      const data = await patientService.findByDni(dni.trim());
      if (data) {
        setPaciente(data);
        setMode("patient");
      } else {
        setMode("new");
      }
    } catch (e: any) {
      setErr(e?.message ?? "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setPaciente(null);
    setDni("");
    setMode("search");
    setErr(null);
  }

  // Auto-search when DNI reaches 8 digits
  useEffect(() => {
    if (mode === "search" && /^\d{8}$/.test(dni)) {
      buscar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dni]);

  if (mode === "patient" && paciente) {
    return (
      <Shell>
        <PatientDashboard paciente={paciente} onChangePaciente={reset} />
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl bg-card p-6 shadow-sm md:p-10">
          <div className="text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Flebo Perú
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">
              Historias Clínicas Digitales
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Busca al paciente por DNI o registra uno nuevo
            </p>
          </div>

          <form onSubmit={buscar} className="mt-8 flex gap-3">
            <input
              autoFocus
              value={dni}
              onChange={(e) => setDni(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="Ingresa DNI (8 dígitos)"
              inputMode="numeric"
              className="w-full rounded-2xl border border-input bg-background px-5 py-4 text-2xl font-semibold tracking-wider outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
            />
            <button
              type="submit"
              disabled={loading || !dni}
              className="rounded-2xl bg-primary px-8 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
            >
              {loading ? "…" : "Buscar"}
            </button>
          </form>

          {err && (
            <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {err}
            </p>
          )}

          {mode === "new" && (
            <div className="mt-6 rounded-2xl border-2 border-dashed border-warning/50 bg-warning/5 p-5">
              <p className="text-sm">
                <span className="font-semibold">DNI no encontrado.</span>{" "}
                Procede a registrar un nuevo paciente.
              </p>
            </div>
          )}
        </div>

        {mode === "new" && (
          <div className="mt-6">
            <FiliationForm
              initialDni={dni}
              onCancel={reset}
              onSaved={(p) => {
                setPaciente(p);
                setMode("patient");
              }}
            />
          </div>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background px-4 py-6 md:py-10">
      {children}
    </div>
  );
}
