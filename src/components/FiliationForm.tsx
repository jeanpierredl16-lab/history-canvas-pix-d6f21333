import { useState } from "react";
import type { Paciente } from "@/lib/supabase";
import { patientService } from "@/services/patientService";
import { useDraft, isOffline } from "@/lib/drafts";

type Props = {
  initialDni: string;
  onSaved: (p: Paciente) => void;
  onCancel: () => void;
};

const empty = (dni: string): Paciente => ({
  dni,
  nombre: "",
  edad: null,
  sexo: null,
  celular: "",
  ocupacion: "",
  provincia: "",
  distrito: "",
  medio: "",
  alergias: "",
  patologias: "",
  n_hijos: null,
});

export function FiliationForm({ initialDni, onSaved, onCancel }: Props) {
  const draftKey = `flebo:draft:filiation:${initialDni}`;
  const [p, setP, clearDraft] = useDraft<Paciente>(draftKey, empty(initialDni));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof Paciente>(k: K, v: Paciente[K]) {
    setP((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setErr(null);
    if (!p.dni || !p.nombre) {
      setErr("DNI y Nombre son obligatorios");
      return;
    }
    if (isOffline()) {
      alert(
        "Sin conexión. El avance del formulario queda guardado en la tablet y podrás reintentar el registro cuando vuelva la señal."
      );
      return;
    }
    setSaving(true);
    try {
      const data = await patientService.create(p);
      clearDraft();
      onSaved(data);
    } catch (e: any) {
      const msg = e?.message ?? "Error al guardar";
      setErr(
        /network|fetch|failed/i.test(msg)
          ? "Sin conexión estable. El avance quedó guardado en la tablet. Reintenta cuando vuelva la señal."
          : msg
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl bg-card p-6 shadow-sm md:p-8">
      <h2 className="text-2xl font-semibold tracking-tight">Nueva Filiación</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Datos del paciente — Flebo Perú
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="DNI">
          <input
            value={p.dni}
            onChange={(e) => set("dni", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Nombre completo">
          <input
            value={p.nombre}
            onChange={(e) => set("nombre", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Edad">
          <input
            type="number"
            value={p.edad ?? ""}
            onChange={(e) => set("edad", e.target.value ? +e.target.value : null)}
            className={inputCls}
          />
        </Field>
        <Field label="Sexo">
          <select
            value={p.sexo ?? ""}
            onChange={(e) => set("sexo", e.target.value)}
            className={inputCls}
          >
            <option value="">—</option>
            <option value="F">Femenino</option>
            <option value="M">Masculino</option>
          </select>
        </Field>
        <Field label="Celular">
          <input
            value={p.celular ?? ""}
            onChange={(e) => set("celular", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Ocupación">
          <input
            value={p.ocupacion ?? ""}
            onChange={(e) => set("ocupacion", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Provincia">
          <input
            value={p.provincia ?? ""}
            onChange={(e) => set("provincia", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Distrito">
          <input
            value={p.distrito ?? ""}
            onChange={(e) => set("distrito", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="¿Cómo nos conoció? (Medio)">
          <input
            value={p.medio ?? ""}
            onChange={(e) => set("medio", e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="N° de Hijos">
          <input
            type="number"
            value={p.n_hijos ?? ""}
            onChange={(e) =>
              set("n_hijos", e.target.value ? +e.target.value : null)
            }
            className={inputCls}
          />
        </Field>
        <Field label="Alergias" full>
          <textarea
            value={p.alergias ?? ""}
            onChange={(e) => set("alergias", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
        <Field label="Patologías" full>
          <textarea
            value={p.patologias ?? ""}
            onChange={(e) => set("patologias", e.target.value)}
            rows={2}
            className={inputCls}
          />
        </Field>
      </div>

      {err && (
        <p className="mt-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
          {err}
        </p>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          onClick={onCancel}
          className="rounded-full border border-border bg-card px-6 py-3 font-medium hover:bg-secondary"
        >
          Cancelar
        </button>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-primary px-6 py-3 font-semibold text-primary-foreground shadow-lg shadow-primary/20 hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar paciente"}
        </button>
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? "md:col-span-2" : ""}`}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
