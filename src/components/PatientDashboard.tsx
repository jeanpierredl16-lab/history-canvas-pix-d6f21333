import { useEffect, useRef, useState } from "react";
import { supabase, type DocumentoGrafico, type Paciente, type Visita } from "@/lib/supabase";
import { uploadDataUrl, uploadFile } from "@/lib/upload";
import { DrawingCanvas } from "./DrawingCanvas";
import { ConsentForm } from "./ConsentForm";
import legMap from "@/assets/leg-veins-map.png";

type Props = {
  paciente: Paciente;
  onChangePaciente: () => void;
};

type Modal =
  | null
  | "nota-choice"
  | "nota"
  | "scanner"
  | "historial"
  | "consentimiento";

export function PatientDashboard({ paciente, onChangePaciente }: Props) {
  const [docs, setDocs] = useState<DocumentoGrafico[]>([]);
  const [visitas, setVisitas] = useState<Visita[]>([]);
  const [modal, setModal] = useState<Modal>(null);
  const [notaBg, setNotaBg] = useState<string | undefined>(undefined);
  const [notaContinuandoDe, setNotaContinuandoDe] = useState<DocumentoGrafico | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  // Visit panel state (inside note view)
  const [fecha, setFecha] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [escleros, setEscleros] = useState<string>("");
  const [trombectomias, setTrombectomias] = useState<string>("");
  const [savingVisita, setSavingVisita] = useState(false);
  const [sessionVisits, setSessionVisits] = useState<Visita[]>([]);
  const [visitMsg, setVisitMsg] = useState<string | null>(null);

  async function load() {
    const [d, v] = await Promise.all([
      supabase
        .from("documentos_graficos")
        .select("*")
        .eq("paciente_dni", paciente.dni)
        .order("created_at", { ascending: false }),
      supabase
        .from("visitas")
        .select("*")
        .eq("paciente_dni", paciente.dni)
        .order("created_at", { ascending: false }),
    ]);
    if (d.data) setDocs(d.data as DocumentoGrafico[]);
    if (v.data) setVisitas(v.data as Visita[]);
  }

  useEffect(() => {
    load();
  }, [paciente.dni]);

  const ultimaNota = docs.find((d) => d.tipo === "nota_manuscrita");

  function abrirNuevaNota() {
    if (ultimaNota) {
      setModal("nota-choice");
    } else {
      setNotaBg(undefined);
      setNotaContinuandoDe(null);
      setSessionVisits([]);
      setModal("nota");
    }
  }

  function continuarNota() {
    setNotaBg(ultimaNota?.url);
    setNotaContinuandoDe(ultimaNota ?? null);
    setSessionVisits([]);
    setModal("nota");
  }

  function nuevaPagina() {
    setNotaBg(undefined);
    setNotaContinuandoDe(null);
    setSessionVisits([]);
    setModal("nota");
  }

  async function saveDoc(
    dataUrl: string,
    tipoDoc: DocumentoGrafico["tipo"],
    descripcion: string
  ) {
    setBusy(true);
    try {
      const url = await uploadDataUrl(dataUrl, paciente.dni, tipoDoc);
      const { error } = await supabase.from("documentos_graficos").insert({
        paciente_dni: paciente.dni,
        tipo: tipoDoc,
        url,
        descripcion,
      });
      if (error) throw error;
      await load();
    } catch (e: any) {
      alert("Error al guardar: " + e.message);
    } finally {
      setBusy(false);
      setModal(null);
    }
  }

  async function onPickPhotos(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true);
    try {
      for (const f of Array.from(files)) {
        const url = await uploadFile(f, paciente.dni, "registro_antiguo");
        await supabase.from("documentos_graficos").insert({
          paciente_dni: paciente.dni,
          tipo: "registro_antiguo",
          url,
          descripcion: "Registro antiguo (papel)",
        });
      }
      await load();
    } catch (e: any) {
      alert("Error subiendo fotos: " + e.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function guardarVisita() {
    setVisitMsg(null);
    const e = parseInt(escleros || "0", 10);
    const t = parseInt(trombectomias || "0", 10);
    if (!e && !t) {
      setVisitMsg("Ingresa al menos una cantidad");
      return;
    }
    setSavingVisita(true);
    try {
      // Use the chosen date as created_at (noon to avoid TZ shifts)
      const createdAt = new Date(fecha + "T12:00:00").toISOString();
      const payload: any = {
        paciente_dni: paciente.dni,
        tipo: "Procedimiento",
        monto_pagado: 0,
        escleros_hoy: e,
        trombectomias_hoy: t,
        notas: null,
        firma_paciente_url: null,
        firma_medico_url: null,
        created_at: createdAt,
      };
      const { data, error } = await supabase
        .from("visitas")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      setSessionVisits((prev) => [data as Visita, ...prev]);
      setVisitas((prev) => [data as Visita, ...prev]);
      setEscleros("");
      setTrombectomias("");
      setVisitMsg("✓ Visita guardada");
      setTimeout(() => setVisitMsg(null), 2000);
    } catch (err: any) {
      setVisitMsg("Error: " + (err?.message ?? "desconocido"));
    } finally {
      setSavingVisita(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Patient header */}
      <div className="space-y-5 rounded-3xl bg-card p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Paciente
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {paciente.nombre}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              DNI {paciente.dni}
              {paciente.edad ? ` · ${paciente.edad} años` : ""}
              {paciente.sexo ? ` · ${paciente.sexo}` : ""}
              {paciente.celular ? ` · ${paciente.celular}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setModal("historial")}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90"
            >
              <span aria-hidden>📋</span> Historial de Procedimientos
            </button>
            <button
              onClick={onChangePaciente}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-secondary"
            >
              Cambiar paciente
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <DataField label="Ocupación" value={paciente.ocupacion} />
          <DataField
            label="Procedencia"
            value={
              [paciente.provincia, paciente.distrito].filter(Boolean).join(" — ") ||
              null
            }
          />
          <DataField label="Medio" value={paciente.medio} />
          <DataField
            label="N° de Hijos"
            value={
              paciente.n_hijos !== null && paciente.n_hijos !== undefined
                ? String(paciente.n_hijos)
                : null
            }
          />
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            className={`rounded-2xl border p-4 ${
              paciente.alergias && paciente.alergias.trim()
                ? "border-destructive/40 bg-destructive/10"
                : "border-border bg-secondary/40"
            }`}
          >
            <p
              className={`text-xs font-semibold uppercase tracking-wider ${
                paciente.alergias && paciente.alergias.trim()
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              ⚠️ Alergias
            </p>
            <p
              className={`mt-1 text-sm font-medium ${
                paciente.alergias && paciente.alergias.trim()
                  ? "text-destructive"
                  : "text-foreground"
              }`}
            >
              {paciente.alergias && paciente.alergias.trim()
                ? paciente.alergias
                : "Niega"}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Patologías
            </p>
            <p className="mt-1 text-sm font-medium">
              {paciente.patologias && paciente.patologias.trim()
                ? paciente.patologias
                : "No registra"}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* Action buttons */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ActionCard
            title="Nueva Nota a Mano"
            desc="Continúa la hoja actual o crea una nueva"
            onClick={abrirNuevaNota}
            icon="✍️"
          />
          <ActionCard
            title="Digitalizar Historia Física"
            desc="Toma foto a hojas antiguas de papel"
            onClick={() => fileRef.current?.click()}
            icon="📷"
            loading={busy}
          />
          <ActionCard
            title="Scanner Venoso"
            desc="Mapa de piernas — várices y trombos"
            onClick={() => setModal("scanner")}
            icon="🦵"
          />
          <ActionCard
            title="Consentimiento Informado"
            desc="Firma digital del paciente y médico"
            onClick={() => setModal("consentimiento")}
            icon="📝"
          />
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={(e) => onPickPhotos(e.target.files)}
        />

        {/* Documents history */}
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Historial de documentos</h2>
          {docs.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Aún no hay documentos. Crea una nota o digitaliza una historia.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {docs.map((d) => (
                <a
                  key={d.id}
                  href={d.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative overflow-hidden rounded-xl border border-border bg-white"
                >
                  <img
                    src={d.url}
                    alt={d.descripcion ?? d.tipo}
                    className="aspect-[3/4] w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs font-medium text-white">
                    {tipoLabel(d.tipo)}
                    <br />
                    <span className="text-[10px] opacity-80">
                      {new Date(d.created_at!).toLocaleDateString("es-PE")}
                    </span>
                  </span>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal: choice continue vs new */}
      {modal === "nota-choice" && (
        <Modal title="Nueva Nota a Mano" onClose={() => setModal(null)}>
          <p className="text-sm text-muted-foreground">
            Existe una nota previa de{" "}
            <strong>
              {ultimaNota ? new Date(ultimaNota.created_at!).toLocaleDateString("es-PE") : ""}
            </strong>
            . ¿Qué deseas hacer?
          </p>
          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <button
              onClick={continuarNota}
              className="rounded-2xl border-2 border-primary bg-primary/5 p-5 text-left hover:bg-primary/10"
            >
              <div className="text-2xl">✍️</div>
              <div className="mt-2 font-semibold">Continuar en la hoja actual</div>
              <div className="text-xs text-muted-foreground">
                Carga la última nota como fondo y permite escribir encima
              </div>
            </button>
            <button
              onClick={nuevaPagina}
              className="rounded-2xl border border-border bg-card p-5 text-left hover:bg-secondary"
            >
              <div className="text-2xl">📄</div>
              <div className="mt-2 font-semibold">Crear página nueva</div>
              <div className="text-xs text-muted-foreground">
                Comienza con un lienzo en blanco
              </div>
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: drawing note + visit panel */}
      {modal === "nota" && (
        <Modal title="Nota manuscrita" onClose={() => setModal(null)} wide>
          {notaContinuandoDe && (
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/40 px-3 py-1 text-xs font-medium text-accent-foreground">
              📅 Última modificación:{" "}
              {new Date(notaContinuandoDe.created_at!).toLocaleString("es-PE")}
            </div>
          )}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <div>
              <DrawingCanvas
                width={900}
                height={1100}
                backgroundImage={notaBg}
                onCancel={() => setModal(null)}
                onSave={(d) => saveDoc(d, "nota_manuscrita", "Nota a mano")}
              />
            </div>

            {/* Visit panel */}
            <aside className="space-y-4 rounded-2xl border border-border bg-secondary/30 p-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Registro de Visita
                </h3>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Fecha</span>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-base outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">ESCLEROS</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  value={escleros}
                  onChange={(e) => setEscleros(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">
                  TROMBECTOMIAS
                </span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  min={0}
                  value={trombectomias}
                  onChange={(e) => setTrombectomias(e.target.value.replace(/\D/g, ""))}
                  placeholder="0"
                  className="w-full rounded-xl border border-input bg-background px-3 py-3 text-2xl font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              {visitMsg && (
                <p
                  className={`rounded-lg p-2 text-xs ${
                    visitMsg.startsWith("✓")
                      ? "bg-success/15 text-success"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {visitMsg}
                </p>
              )}

              <button
                onClick={guardarVisita}
                disabled={savingVisita}
                className="w-full rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 hover:opacity-90 disabled:opacity-50"
              >
                {savingVisita ? "Guardando…" : "Guardar Visita"}
              </button>

              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Historial reciente
                </h4>
                {visitas.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Sin registros aún.</p>
                ) : (
                  <ul className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                    {visitas.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between rounded-lg bg-card px-3 py-2 text-xs shadow-sm"
                      >
                        <span className="font-medium">
                          {new Date(v.created_at!).toLocaleDateString("es-PE")}
                        </span>
                        <span className="text-muted-foreground">
                          E:{v.escleros_hoy ?? 0} · T:{(v as any).trombectomias_hoy ?? 0}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          </div>
        </Modal>
      )}

      {modal === "scanner" && (
        <Modal title="Scanner venoso" onClose={() => setModal(null)}>
          <DrawingCanvas
            width={768}
            height={1024}
            backgroundImage={legMap}
            showColorTools
            onCancel={() => setModal(null)}
            onSave={(d) => saveDoc(d, "scanner_venoso", "Mapa venoso")}
          />
        </Modal>
      )}

      {modal === "historial" && (
        <Modal title="Historial de Procedimientos" onClose={() => setModal(null)}>
          {visitas.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Sin procedimientos registrados.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">Fecha</th>
                    <th className="px-4 py-3 text-right">Escleros</th>
                    <th className="px-4 py-3 text-right">Trombectomías</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visitas.map((v) => (
                    <tr key={v.id}>
                      <td className="px-4 py-3 font-medium">
                        {new Date(v.created_at!).toLocaleDateString("es-PE", {
                          day: "2-digit",
                          month: "long",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {v.escleros_hoy ?? 0}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {(v as any).trombectomias_hoy ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-secondary/40 text-sm font-semibold">
                  <tr>
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">
                      {visitas.reduce((s, v) => s + (v.escleros_hoy ?? 0), 0)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {visitas.reduce(
                        (s, v) => s + ((v as any).trombectomias_hoy ?? 0),
                        0
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Modal>
      )}

      {modal === "consentimiento" && (
        <Modal
          title="Consentimiento Informado para Escleroterapia"
          onClose={() => setModal(null)}
        >
          <ConsentForm
            paciente={paciente}
            onSaved={(v) => setVisitas((prev) => [v, ...prev])}
          />
        </Modal>
      )}
    </div>
  );
}

function tipoLabel(t: DocumentoGrafico["tipo"]) {
  if (t === "nota_manuscrita") return "Nota manuscrita";
  if (t === "registro_antiguo") return "Registro antiguo";
  return "Scanner venoso";
}

function DataField({ label, value }: { label: string; value: string | null | undefined }) {
  const has = !!(value && String(value).trim());
  return (
    <div className="rounded-xl border border-border bg-secondary/30 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`mt-0.5 text-sm ${has ? "font-medium" : "text-muted-foreground"}`}>
        {has ? value : "No registra"}
      </p>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  icon,
  onClick,
  loading,
}: {
  title: string;
  desc: string;
  icon: string;
  onClick: () => void;
  loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="group flex flex-col items-start gap-2 rounded-3xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-primary hover:shadow-md disabled:opacity-50"
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-base font-semibold">{title}</span>
      <span className="text-xs text-muted-foreground">
        {loading ? "Subiendo…" : desc}
      </span>
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        className={`max-h-[95vh] w-full overflow-y-auto rounded-3xl bg-card p-6 shadow-2xl ${
          wide ? "max-w-6xl" : "max-w-4xl"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-secondary"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
